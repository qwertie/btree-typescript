import BTree, { BNode, BNodeInternal, check } from '../b+tree';
import { BTreeConstructor, makeLeavesFrom, type BTreeWithInternals } from './shared';
import { buildFromDecomposition, decomposeLoadFactor, type DecomposeResult } from './decompose';
import { createCursor, Cursor, moveTo } from './parallelWalk';

/**
 * Error message used when `omit` is called without either bound.
 * @internal
 */
export const omitUnboundedErrorMsg = "omit requires at least one of `start` or `end` to be defined.";

/**
 * Returns a new tree containing every entry of `tree` except those whose keys fall in the given range.
 * The input tree is not modified.
 *
 * The range is `[start, end)` by default, or `[start, end]` if `includeEnd` is true. Exactly one bound may be
 * `undefined` to make the range open-ended: `omit(tree, undefined, end)` removes every key before `end`, and
 * `omit(tree, start, undefined)` removes every key from `start` onward.
 *
 * Subtrees that lie entirely outside the range are shared with the input tree rather than copied, and keys
 * inside the range are never visited. Let `H` be the tree height (counting a leaf as height 1) and `B` the
 * max node size. The tree is decomposed into `O(B * H)` disjoint pieces, so the runtime is
 * `O(B^2 * H)`, i.e. `O(log N)` for a fixed max node size, regardless of how many keys are omitted.
 * @param tree The tree to omit keys from.
 * @param start The first key to omit (inclusive), or `undefined` to omit from the beginning of the tree.
 * @param end The key at which omission stops (exclusive unless `includeEnd`), or `undefined` to omit to the end of the tree.
 * @param includeEnd If true, `end` itself is also omitted. Defaults to false.
 * @returns A new tree without the keys in the range.
 * @throws Error if both `start` and `end` are `undefined`.
 */
export default function omit<TBTree extends BTree<K, V>, K, V>(tree: TBTree, start: K, end: K | undefined, includeEnd?: boolean): TBTree;
export default function omit<TBTree extends BTree<K, V>, K, V>(tree: TBTree, start: K | undefined, end: K, includeEnd?: boolean): TBTree;
export default function omit<TBTree extends BTree<K, V>, K, V>(
  tree: TBTree,
  start: K | undefined,
  end: K | undefined,
  includeEnd: boolean = false
): TBTree {
  if (start === undefined && end === undefined)
    throw new Error(omitUnboundedErrorMsg);

  const _tree = tree as unknown as BTreeWithInternals<K, V>;
  const root = _tree._root;
  const cmp = _tree._compare;
  if (root.size() === 0)
    return tree.clone();

  // Find the first key that would be omitted. If there is none, nothing changes.
  let firstOmitted: K | undefined;
  if (start === undefined) {
    firstOmitted = root.minKey();
  } else {
    const pair = tree.getPairOrNextHigher(start);
    if (pair === undefined)
      return tree.clone();
    firstOmitted = pair[0];
  }
  if (end !== undefined) {
    const order = cmp(firstOmitted as K, end);
    if (order > 0 || (order === 0 && !includeEnd))
      return tree.clone();
  }

  const decomposed = decomposeOmittingRange(_tree, start, end, includeEnd);
  const constructor = tree.constructor as BTreeConstructor<TBTree, K, V>;
  return buildFromDecomposition(constructor, _tree._maxNodeSize, decomposed, cmp, _tree._maxNodeSize);
}

type OmitPayload = { disqualified: boolean };

/**
 * Decomposes a tree into the maximal disjoint subtrees (and loose leaf entries) that lie outside of a key range.
 * A single cursor walks the tree in three phases:
 *   1. keep: from the minimum key to the first key >= `start`
 *   2. omit: from there to the first key at/after `end`
 *   3. keep: from there off the end of the tree
 * During the keep phases, every subtree the cursor skips over is wholly kept and is reused as-is. Nodes that contain
 * any omitted key are "disqualified": they cannot be reused, so only their kept children/entries are collected.
 * The caller must guarantee the range contains at least one key of the (non-empty) tree.
 * @internal
 */
export function decomposeOmittingRange<K, V>(
  tree: BTreeWithInternals<K, V>,
  start: K | undefined,
  end: K | undefined,
  includeEnd: boolean
): DecomposeResult<K, V> {
  const maxNodeSize = tree._maxNodeSize;
  const minSize = Math.floor(maxNodeSize / 2);
  const heights: number[] = [];
  const nodes: BNode<K, V>[] = [];
  // Kept entries from partially-kept leaves accumulate here until a reused subtree is added after them.
  const pendingKeys: K[] = [];
  const pendingValues: V[] = [];
  // While stepping up through wholly-kept nodes, we defer adding them because an ancestor may also be wholly kept.
  let highestDisjoint: BNode<K, V> | undefined = undefined as BNode<K, V> | undefined;
  let highestDisjointHeight = 0;
  let keeping = true;

  const onLeafCreation = (leaf: BNode<K, V>) => {
    heights.push(leaf.keys.length < minSize ? -1 : 0);
    nodes.push(leaf);
  };

  const flushPending = () => {
    makeLeavesFrom(pendingKeys, pendingValues, maxNodeSize, decomposeLoadFactor, onLeafCreation);
    pendingKeys.length = 0;
    pendingValues.length = 0;
  };

  const addSharedNode = (node: BNode<K, V>, height: number) => {
    flushPending();
    // Don't share underfilled leaves; instead mark them as needing merging
    if (node.isLeaf && node.keys.length < minSize) {
      heights.push(-1);
      nodes.push(node.clone());
    } else {
      node.isShared = true;
      heights.push(height);
      nodes.push(node);
    }
  };

  const addHighestDisjoint = () => {
    if (highestDisjoint !== undefined) {
      addSharedNode(highestDisjoint, highestDisjointHeight);
      highestDisjoint = undefined;
    }
  };

  const addChildren = (parent: BNodeInternal<K, V>, from: number, toExclusive: number, height: number) => {
    const children = parent.children;
    for (let i = from; i < toExclusive; ++i)
      addSharedNode(children[i], height);
  };

  const pushLeafRange = (leaf: BNode<K, V>, from: number, toExclusive: number) => {
    const keys = leaf.keys;
    const values = leaf.values;
    for (let i = from; i < toExclusive; ++i) {
      pendingKeys.push(keys[i]);
      pendingValues.push(values[i]);
    }
  };

  // Every ancestor of a node containing an omitted key also contains it, so disqualify upward.
  const disqualifySpine = (cursor: Cursor<K, V, OmitPayload>, depthFrom: number) => {
    const spine = cursor.spine;
    for (let i = depthFrom; i >= 0; --i) {
      const payload = spine[i].payload;
      if (payload.disqualified)
        break;
      payload.disqualified = true;
    }
  };

  const onEnterLeaf = (leaf: BNode<K, V>, destIndex: number, cursor: Cursor<K, V, OmitPayload>) => {
    if (keeping) {
      pushLeafRange(leaf, 0, destIndex);
    } else if (destIndex > 0) {
      cursor.leafPayload.disqualified = true;
      disqualifySpine(cursor, cursor.spine.length - 1);
    }
  };

  const onMoveInLeaf = (leaf: BNode<K, V>, _: OmitPayload, fromIndex: number, toIndex: number, startedEqual: boolean) => {
    if (keeping)
      pushLeafRange(leaf, startedEqual ? fromIndex + 1 : fromIndex, toIndex);
  };

  const onExitLeaf = (
    leaf: BNode<K, V>,
    payload: OmitPayload,
    startIndex: number,
    startedEqual: boolean,
    cursor: Cursor<K, V, OmitPayload>
  ) => {
    if (!keeping)
      return;
    if (payload.disqualified) {
      pushLeafRange(leaf, startedEqual ? startIndex + 1 : startIndex, leaf.keys.length);
    } else {
      highestDisjoint = leaf;
      highestDisjointHeight = 0;
      if (cursor.spine.length === 0)
        addHighestDisjoint();
    }
  };

  const onStepUp = (
    parent: BNodeInternal<K, V>,
    height: number,
    payload: OmitPayload,
    fromIndex: number,
    spineIndex: number,
    stepDownIndex: number,
    cursor: Cursor<K, V, OmitPayload>
  ) => {
    const isDescending = stepDownIndex === stepDownIndex /* not NaN */ && stepDownIndex !== Number.POSITIVE_INFINITY;
    if (!keeping) {
      if (isDescending && stepDownIndex > 0)
        disqualifySpine(cursor, spineIndex);
      return;
    }
    if (isDescending) {
      addHighestDisjoint();
      addChildren(parent, fromIndex + 1, stepDownIndex, height - 1);
    } else if (payload.disqualified) {
      addHighestDisjoint();
      addChildren(parent, fromIndex + 1, parent.children.length, height - 1);
    } else {
      // The root always contains an omitted key, so a wholly-kept node is never the last one stepped out of.
      check(stepDownIndex !== Number.POSITIVE_INFINITY, "omit: root unexpectedly kept whole");
      highestDisjoint = parent;
      highestDisjointHeight = height;
    }
  };

  const onStepDown = (
    node: BNodeInternal<K, V>,
    height: number,
    spineIndex: number,
    stepDownIndex: number,
    cursor: Cursor<K, V, OmitPayload>
  ) => {
    if (stepDownIndex <= 0)
      return;
    if (keeping)
      addChildren(node, 0, stepDownIndex, height - 1);
    else
      disqualifySpine(cursor, spineIndex);
  };

  const cursor = createCursor<K, V, OmitPayload>(
    tree, () => ({ disqualified: false }), onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown);

  // Phase 1 (keep): walk to the first omitted key.
  if (start !== undefined) {
    const [out] = moveTo(cursor, cursor, start, true, false);
    check(!out, "omit: range unexpectedly beyond end of tree");
  }

  if (end !== undefined) {
    // The cursor now sits on an omitted key, so its leaf and every ancestor cannot be reused whole.
    cursor.leafPayload.disqualified = true;
    disqualifySpine(cursor, cursor.spine.length - 1);

    // Phase 2 (omit): walk to the first key after the range.
    keeping = false;
    const [out] = moveTo(cursor, cursor, end, !includeEnd, false);
    if (!out) {
      // Phase 3 (keep): walk off the end of the tree, collecting everything passed.
      keeping = true;
      moveTo(cursor, cursor, tree._root.maxKey(), false, false);
    }
  }
  // When `end` is undefined, everything from the cursor onward is omitted, so the walk simply stops.

  flushPending();
  check(highestDisjoint === undefined, "omit: unflushed disjoint subtree");

  let tallestIndex = 0;
  for (let i = 1; i < heights.length; ++i) {
    if (heights[i] > heights[tallestIndex])
      tallestIndex = i;
  }
  return { heights, nodes, tallestIndex };
}
