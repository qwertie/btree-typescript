import { BNode, BNodeInternal } from '../b+tree';
import type { BTreeWithInternals } from './shared';

/**
 * A walkable cursor for BTree set operations.
 * @internal
 */
export interface Cursor<K, V, TPayload> {
  tree: BTreeWithInternals<K, V>;
  leaf: BNode<K, V>;
  leafIndex: number;
  spine: Array<{ node: BNodeInternal<K, V>, childIndex: number, payload: TPayload }>;
  leafPayload: TPayload;
  makePayload: () => TPayload;
  onMoveInLeaf: (leaf: BNode<K, V>, payload: TPayload, fromIndex: number, toIndex: number, isInclusive: boolean) => void;
  onExitLeaf: (leaf: BNode<K, V>, payload: TPayload, startingIndex: number, isInclusive: boolean, cursorThis: Cursor<K, V, TPayload>) => void;
  onStepUp: (parent: BNodeInternal<K, V>, height: number, payload: TPayload, fromIndex: number, spineIndex: number, stepDownIndex: number, cursorThis: Cursor<K, V, TPayload>, cursorOther: Cursor<K, V, TPayload>) => void;
  onStepDown: (node: BNodeInternal<K, V>, height: number, spineIndex: number, stepDownIndex: number, cursorThis: Cursor<K, V, TPayload>, cursorOther: Cursor<K, V, TPayload>) => void;
  onEnterLeaf: (leaf: BNode<K, V>, destIndex: number, cursorThis: Cursor<K, V, TPayload>, cursorOther: Cursor<K, V, TPayload>) => void;
}

/**
 * Walks the cursor forward by one key.
 * Returns true if end-of-tree was reached (cursor not structurally mutated).
 * Optimized for this case over the more general `moveTo` function.
 * @internal
 */
export function moveForwardOne<K, V, TP>(
  cur: Cursor<K, V, TP>,
  other: Cursor<K, V, TP>
): boolean {
  const leaf = cur.leaf;
  const nextIndex = cur.leafIndex + 1;
  if (nextIndex < leaf.keys.length) {
    // Still within current leaf
    cur.onMoveInLeaf(leaf, cur.leafPayload, cur.leafIndex, nextIndex, true);
    cur.leafIndex = nextIndex;
    return false;
  }

  // If our optimized step within leaf failed, use full moveTo logic
  // Pass isInclusive=false to ensure we walk forward to the key exactly after the current
  return moveTo(cur, other, getKey(cur), false, true)[0];
}

/**
 * Create a cursor pointing to the leftmost key of the supplied tree.
 * @internal
 */
export function createCursor<K, V, TP>(
  tree: BTreeWithInternals<K, V>,
  makePayload: Cursor<K, V, TP>["makePayload"],
  onEnterLeaf: Cursor<K, V, TP>["onEnterLeaf"],
  onMoveInLeaf: Cursor<K, V, TP>["onMoveInLeaf"],
  onExitLeaf: Cursor<K, V, TP>["onExitLeaf"],
  onStepUp: Cursor<K, V, TP>["onStepUp"],
  onStepDown: Cursor<K, V, TP>["onStepDown"],
): Cursor<K, V, TP> {
  const spine: Array<{ node: BNodeInternal<K, V>, childIndex: number, payload: TP }> = [];
  let n: BNode<K, V> = tree._root;
  while (!n.isLeaf) {
    const ni = n as BNodeInternal<K, V>;
    const payload = makePayload();
    spine.push({ node: ni, childIndex: 0, payload });
    n = ni.children[0];
  }
  const leafPayload = makePayload();
  const cur: Cursor<K, V, TP> = {
    tree, leaf: n, leafIndex: 0, spine, leafPayload, makePayload: makePayload,
    onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown
  };
  return cur;
}

/**
 * Gets the key at the current cursor position.
 * @internal
 */
export function getKey<K, V, TP>(c: Cursor<K, V, TP>): K {
  return c.leaf.keys[c.leafIndex];
}

/**
 * Move cursor strictly forward to the first key >= (inclusive) or > (exclusive) target.
 * Returns a boolean indicating if end-of-tree was reached (cursor not structurally mutated).
 * Also returns a boolean indicating if the target key was landed on exactly.
 * @internal
 */
export function moveTo<K, V, TP>(
  cur: Cursor<K, V, TP>,
  other: Cursor<K, V, TP>,
  targetKey: K,
  isInclusive: boolean,
  startedEqual: boolean,
): [outOfTree: boolean, targetExactlyReached: boolean] {
  // Cache for perf
  const cmp = cur.tree._compare
  const onMoveInLeaf = cur.onMoveInLeaf;
  // Fast path: destination within current leaf
  const leaf = cur.leaf;
  const leafPayload = cur.leafPayload;
  const i = leaf.indexOf(targetKey, -1, cmp);
  let destInLeaf: number;
  let targetExactlyReached: boolean;
  if (i < 0) {
    destInLeaf = ~i;
    targetExactlyReached = false;
  } else {
    if (isInclusive) {
      destInLeaf = i;
      targetExactlyReached = true;
    } else {
      destInLeaf = i + 1;
      targetExactlyReached = false;
    }
  }
  const leafKeyCount = leaf.keys.length;
  if (destInLeaf < leafKeyCount) {
    onMoveInLeaf(leaf, leafPayload, cur.leafIndex, destInLeaf, startedEqual);
    cur.leafIndex = destInLeaf;
    return [false, targetExactlyReached];
  }

  // Find first ancestor with a viable right step
  const spine = cur.spine;
  const initialSpineLength = spine.length;
  let descentLevel = -1;
  let descentIndex = -1;

  for (let s = initialSpineLength - 1; s >= 0; s--) {
    const parent = spine[s].node;
    const indexOf = parent.indexOf(targetKey, -1, cmp);
    let stepDownIndex: number;
    if (indexOf < 0) {
      stepDownIndex = ~indexOf;
    } else {
      stepDownIndex = isInclusive ? indexOf : indexOf + 1;
    }

    // Note: when key not found, indexOf with failXor=0 already returns insertion index
    if (stepDownIndex < parent.keys.length) {
      descentLevel = s;
      descentIndex = stepDownIndex;
      break;
    }
  }

  // Exit leaf; even if no spine, we did walk out of it conceptually
  const startIndex = cur.leafIndex;
  cur.onExitLeaf(leaf, leafPayload, startIndex, startedEqual, cur);

  const onStepUp = cur.onStepUp;
  if (descentLevel < 0) {
    // No descent point; step up all the way; last callback gets infinity
    for (let depth = initialSpineLength - 1; depth >= 0; depth--) {
      const entry = spine[depth];
      const sd = depth === 0 ? Number.POSITIVE_INFINITY : Number.NaN;
      onStepUp(entry.node, initialSpineLength - depth, entry.payload, entry.childIndex, depth, sd, cur, other);
    }
    return [true, false];
  }

  // Step up through ancestors above the descentLevel
  for (let depth = initialSpineLength - 1; depth > descentLevel; depth--) {
    const entry = spine[depth];
    onStepUp(entry.node, initialSpineLength - depth, entry.payload, entry.childIndex, depth, Number.NaN, cur, other);
  }

  const entry = spine[descentLevel];
  onStepUp(entry.node, initialSpineLength - descentLevel, entry.payload, entry.childIndex, descentLevel, descentIndex, cur, other);
  entry.childIndex = descentIndex;

  const onStepDown = cur.onStepDown;
  const makePayload = cur.makePayload;

  // Descend, invoking onStepDown and creating payloads
  let height = initialSpineLength - descentLevel - 1; // calculate height before changing length
  spine.length = descentLevel + 1;
  let node: BNode<K, V> = spine[descentLevel].node.children[descentIndex];

  while (!node.isLeaf) {
    const ni = node as BNodeInternal<K, V>;
    const keys = ni.keys;
    let stepDownIndex = ni.indexOf(targetKey, 0, cmp);
    if (!isInclusive && stepDownIndex < keys.length && cmp(keys[stepDownIndex], targetKey) === 0)
      stepDownIndex++;
    const payload = makePayload();
    const spineIndex = spine.length;
    spine.push({ node: ni, childIndex: stepDownIndex, payload });
    onStepDown(ni, height, spineIndex, stepDownIndex, cur, other);
    node = ni.children[stepDownIndex];
    height -= 1;
  }

  // Enter destination leaf
  const idx = node.indexOf(targetKey, -1, cmp);
  let destIndex: number;
  if (idx < 0) {
    destIndex = ~idx;
    targetExactlyReached = false;
  } else {
    if (isInclusive) {
      destIndex = idx;
      targetExactlyReached = true;
    } else {
      destIndex = idx + 1;
      targetExactlyReached = false;
    }
  }
  cur.leaf = node;
  cur.leafPayload = makePayload();
  cur.leafIndex = destIndex;
  cur.onEnterLeaf(node, destIndex, cur, other);
  return [false, targetExactlyReached];
}

/**
 * A no-operation function.
 * @internal
 */
export function noop(): void { }
