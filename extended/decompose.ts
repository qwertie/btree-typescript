import BTree, { areOverlapping, BNode, BNodeInternal, check } from '../b+tree';
import type { BTreeWithInternals } from './shared';
import { createCursor, getKey, MergeCursor, MergeCursorPayload, moveForwardOne, moveTo, noop } from "./parallelWalk";
import { flushToLeaves } from './bulkLoad';

export type DecomposeResult<K, V> = { disjoint: (number | BNode<K, V>)[], tallestIndex: number };

/**
 * Decomposes two trees into disjoint nodes. Reuses interior nodes when they do not overlap/intersect with any leaf nodes
 * in the other tree. Overlapping leaf nodes are broken down into new leaf nodes containing merged entries.
 * The algorithm is a parallel tree walk using two cursors. The trailing cursor (behind in key space) is walked forward
 * until it is at or after the leading cursor. As it does this, any whole nodes or subtrees it passes are guaranteed to 
 * be disjoint. This is true because the leading cursor was also previously walked in this way, and is thus pointing to 
 * the first key at or after the trailing cursor's previous position.
 * The cursor walk is efficient, meaning it skips over disjoint subtrees entirely rather than visiting every leaf.
 */
export function decompose<K, V>(
  left: BTreeWithInternals<K, V>,
  right: BTreeWithInternals<K, V>,
  mergeValues: (key: K, leftValue: V, rightValue: V) => V | undefined,
  ignoreRight: boolean = false
): DecomposeResult<K, V> {
  const cmp = left._compare;
  check(left._root.size() > 0 && right._root.size() > 0, "decompose requires non-empty inputs");
  // Holds the disjoint nodes that result from decomposition.
  // Alternating entries of (height, node) to avoid creating small tuples
  const disjoint: (number | BNode<K, V>)[] = [];
  // During the decomposition, leaves that are not disjoint are decomposed into individual entries
  // that accumulate in this array in sorted order. They are flushed into leaf nodes whenever a reused
  // disjoint subtree is added to the disjoint set.
  // Note that there are unavoidable cases in which this will generate underfilled leaves.
  // An example of this would be a leaf in one tree that contained keys [0, 100, 101, 102].
  // In the other tree, there is a leaf that contains [2, 3, 4, 5]. This leaf can be reused entirely,
  // but the first tree's leaf must be decomposed into [0] and [100, 101, 102]
  const pending: (K | V)[] = [];
  let tallestIndex = -1, tallestHeight = -1;

  // During the upward part of the cursor walk, this holds the highest disjoint node seen so far.
  // This is done because we cannot know immediately whether we can add the node to the disjoint set
  // because its ancestor may also be disjoint and should be reused instead.
  let highestDisjoint: { node: BNode<K, V>, height: number } | undefined
    // Have to do this as cast to convince TS it's ever assigned
    = undefined as { node: BNode<K, V>, height: number } | undefined;

  const onLeafCreation = (leaf: BNode<K, V>) => {
    alternatingPush(disjoint, 0, leaf);
  }

  const flushPendingEntries = () => {
    const createdLeaves = flushToLeaves(pending, left._maxNodeSize, onLeafCreation);
    if (createdLeaves > 0) {
      tallestIndex = alternatingCount(disjoint) - 1;
      tallestHeight = 0;
    }
  };

  const addSharedNodeToDisjointSet = (node: BNode<K, V>, height: number) => {
    flushPendingEntries();
    node.isShared = true;
    alternatingPush<number, BNode<K, V>>(disjoint, height, node);
    if (height > tallestHeight) {
      tallestIndex = alternatingCount(disjoint) - 1;
      tallestHeight = height;
    }
  };

  const addHighestDisjoint = () => {
    if (highestDisjoint !== undefined) {
      addSharedNodeToDisjointSet(highestDisjoint.node, highestDisjoint.height);
      highestDisjoint = undefined;
    }
  };

  // Mark all nodes at or above depthFrom in the cursor spine as disqualified (non-disjoint)
  const disqualifySpine = (cursor: MergeCursor<K, V, MergeCursorPayload>, depthFrom: number) => {
    const spine = cursor.spine;
    for (let i = depthFrom; i >= 0; --i) {
      const payload = spine[i].payload;
      // Safe to early out because we always disqualify all ancestors of a disqualified node
      // That is correct because every ancestor of a non-disjoint node is also non-disjoint
      // because it must enclose the non-disjoint range.
      if (payload.disqualified)
        break;
      payload.disqualified = true;
    }
  };

  // Cursor payload factory
  const makePayload = (): MergeCursorPayload => ({ disqualified: false });

  const pushLeafRange = (leaf: BNode<K, V>, from: number, toExclusive: number) => {
    const keys = leaf.keys;
    const values = leaf.values;
    for (let i = from; i < toExclusive; ++i)
      alternatingPush<K, V>(pending, keys[i], values[i]);
  };

  const onMoveInLeaf = (
    leaf: BNode<K, V>,
    payload: MergeCursorPayload,
    fromIndex: number,
    toIndex: number,
    startedEqual: boolean
  ) => {
    check(payload.disqualified === true, "onMoveInLeaf: leaf must be disqualified");
    const start = startedEqual ? fromIndex + 1 : fromIndex;
    if (start < toIndex)
      pushLeafRange(leaf, start, toIndex);
  };

  const onExitLeaf = (
    leaf: BNode<K, V>,
    payload: MergeCursorPayload,
    startingIndex: number,
    startedEqual: boolean,
    cursorThis: MergeCursor<K, V, MergeCursorPayload>,
  ) => {
    highestDisjoint = undefined;
    if (!payload.disqualified) {
      highestDisjoint = { node: leaf, height: 0 };
      if (cursorThis.spine.length === 0) {
        // if we are exiting a leaf and there are no internal nodes, we will reach the end of the tree.
        // In this case we need to add the leaf now because step up will not be called.
        addHighestDisjoint();
      }
    } else {
      const start = startedEqual ? startingIndex + 1 : startingIndex;
      const leafSize = leaf.keys.length;
      if (start < leafSize)
        pushLeafRange(leaf, start, leafSize);
    }
  };

  const onStepUp = (
    parent: BNodeInternal<K, V>,
    height: number,
    payload: MergeCursorPayload,
    fromIndex: number,
    spineIndex: number,
    stepDownIndex: number,
    cursorThis: MergeCursor<K, V, MergeCursorPayload>
  ) => {
    const children = parent.children;
    const nextHeight = height - 1;
    if (stepDownIndex !== stepDownIndex /* NaN: still walking up */
      || stepDownIndex === Number.POSITIVE_INFINITY /* target key is beyond edge of tree, done with walk */) {
      if (!payload.disqualified) {
        highestDisjoint = { node: parent, height };
        if (stepDownIndex === Number.POSITIVE_INFINITY) {
          // We have finished our walk, and we won't be stepping down, so add the root
          addHighestDisjoint();
        }
      } else {
        addHighestDisjoint();
        const len = children.length;
        for (let i = fromIndex + 1; i < len; ++i)
          addSharedNodeToDisjointSet(children[i], nextHeight);
      }
    } else {
      // We have a valid step down index, so we need to disqualify the spine if needed.
      // This is identical to the step down logic, but we must also perform it here because
      // in the case of stepping down into a leaf, the step down callback is never called.
      if (stepDownIndex > 0) {
        disqualifySpine(cursorThis, spineIndex);
      }
      addHighestDisjoint();
      for (let i = fromIndex + 1; i < stepDownIndex; ++i)
        addSharedNodeToDisjointSet(children[i], nextHeight);
    }
  };

  const onStepDown = (
    node: BNodeInternal<K, V>,
    height: number,
    spineIndex: number,
    stepDownIndex: number,
    cursorThis: MergeCursor<K, V, MergeCursorPayload>
  ) => {
    if (stepDownIndex > 0) {
      // When we step down into a node, we know that we have walked from a key that is less than our target.
      // Because of this, if we are not stepping down into the first child, we know that all children before
      // the stepDownIndex must overlap with the other tree because they must be before our target key. Since
      // the child we are stepping into has a key greater than our target key, this node must overlap.
      // If a child overlaps, the entire spine overlaps because a parent in a btree always encloses the range
      // of its children.
      disqualifySpine(cursorThis, spineIndex);
      const children = node.children;
      const nextHeight = height - 1;
      for (let i = 0; i < stepDownIndex; ++i)
        addSharedNodeToDisjointSet(children[i], nextHeight);
    }
  };

  const onEnterLeaf = (
    leaf: BNode<K, V>,
    destIndex: number,
    cursorThis: MergeCursor<K, V, MergeCursorPayload>,
    cursorOther: MergeCursor<K, V, MergeCursorPayload>
  ) => {
    if (destIndex > 0
      || areOverlapping(leaf.minKey()!, leaf.maxKey(), getKey(cursorOther), cursorOther.leaf.maxKey(), cmp)) {
      // Similar logic to the step-down case, except in this case we also know the leaf in the other
      // tree overlaps a leaf in this tree (this leaf, specifically). Thus, we can disqualify both spines.
      cursorThis.leafPayload.disqualified = true;
      cursorOther.leafPayload.disqualified = true;
      disqualifySpine(cursorThis, cursorThis.spine.length - 1);
      disqualifySpine(cursorOther, cursorOther.spine.length - 1);
      pushLeafRange(leaf, 0, destIndex);
    }
  };

  // Need the max key of both trees to perform the "finishing" walk of which ever cursor finishes second
  const maxKeyLeft = left._root.maxKey() as K;
  const maxKeyRight = right._root.maxKey() as K;
  const maxKey = cmp(maxKeyLeft, maxKeyRight) >= 0 ? maxKeyLeft : maxKeyRight;

  // Initialize cursors at minimum keys.
  const curA = createCursor<K, V, MergeCursorPayload>(left, makePayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown);

  let curB: typeof curA;
  if (ignoreRight) {
    const dummyPayload: MergeCursorPayload = { disqualified: true };
    curB = createCursor<K, V, MergeCursorPayload>(right, () => dummyPayload, noop, noop, noop, noop, noop);
  } else {
    curB = createCursor<K, V, MergeCursorPayload>(right, makePayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown);
  }

  // The guarantee that no overlapping interior nodes are accidentally reused relies on the careful
  // alternating hopping walk of the cursors: WLOG, cursorA always--with one exception--walks from a key just behind (in key space)
  // the key of cursorB to the first key >= cursorB. Call this transition a "crossover point." All interior nodes that
  // overlap cause a crossover point, and all crossover points are guaranteed to be walked using this method. Thus,
  // all overlapping interior nodes will be found if they are checked for on step-down.
  // The one exception mentioned above is when they start at the same key. In this case, they are both advanced forward and then
  // their new ordering determines how they walk from there.
  // The one issue then is detecting any overlaps that occur based on their very initial position (minimum key of each tree).
  // This is handled by the initial disqualification step below, which essentially emulates the step down disqualification for each spine.
  // Initialize disqualification w.r.t. opposite leaf.
  const initDisqualify = (cur: MergeCursor<K, V, MergeCursorPayload>, other: MergeCursor<K, V, MergeCursorPayload>) => {
    const minKey = getKey(cur);
    const otherMin = getKey(other);
    const otherMax = other.leaf.maxKey();
    if (areOverlapping(minKey, cur.leaf.maxKey(), otherMin, otherMax, cmp))
      cur.leafPayload.disqualified = true;
    for (let i = 0; i < cur.spine.length; ++i) {
      const entry = cur.spine[i];
      // Since we are on the left side of the tree, we can use the leaf min key for every spine node
      if (areOverlapping(minKey, entry.node.maxKey(), otherMin, otherMax, cmp))
        entry.payload.disqualified = true;
    }
  };

  initDisqualify(curA, curB);
  initDisqualify(curB, curA);

  let leading = curA;
  let trailing = curB;
  let order = cmp(getKey(leading), getKey(trailing));

  // Walk both cursors in alternating hops
  while (true) {
    const areEqual = order === 0;

    if (areEqual) {
      const key = getKey(leading);
      const vA = curA.leaf.values[curA.leafIndex];
      const vB = curB.leaf.values[curB.leafIndex];
      // Perform the actual merge of values here. The cursors will avoid adding a duplicate of this key/value
      // to pending because they respect the areEqual flag during their moves.
      const merged = mergeValues(key, vA, vB);
      if (merged !== undefined)
        alternatingPush<K, V>(pending, key, merged);
      const outTrailing = moveForwardOne(trailing, leading, key, cmp);
      const outLeading = moveForwardOne(leading, trailing, key, cmp);
      if (outTrailing || outLeading) {
        if (!outTrailing || !outLeading) {
          // In these cases, we pass areEqual=false because a return value of "out of tree" means
          // the cursor did not move. This must be true because they started equal and one of them had more tree
          // to walk (one is !out), so they cannot be equal at this point.
          if (outTrailing) {
            moveTo(leading, trailing, maxKey, false, false, cmp);
          } else {
            moveTo(trailing, leading, maxKey, false, false, cmp);
          }
        }
        break;
      }
      order = cmp(getKey(leading), getKey(trailing));
    } else {
      if (order < 0) {
        const tmp = trailing;
        trailing = leading;
        leading = tmp;
      }
      const [out, nowEqual] = moveTo(trailing, leading, getKey(leading), true, areEqual, cmp);
      if (out) {
        moveTo(leading, trailing, maxKey, false, areEqual, cmp);
        break;
      } else if (nowEqual) {
        order = 0;
      } else {
        order = -1;
      }
    }
  }

  // Ensure any trailing non-disjoint entries are added
  flushPendingEntries();
  return { disjoint, tallestIndex };
}

export function buildFromDecomposition<TBTree extends BTree<K, V>, K, V>(
  constructor: new (entries?: [K, V][], compare?: (a: K, b: K) => number, maxNodeSize?: number) => TBTree,
  branchingFactor: number,
  decomposed: DecomposeResult<K, V>,
  cmp: (a: K, b: K) => number,
  maxNodeSize: number
): TBTree {
  const { disjoint, tallestIndex } = decomposed;
  const disjointEntryCount = alternatingCount(disjoint);

  // Now we have a set of disjoint subtrees and we need to merge them into a single tree.
  // To do this, we start with the tallest subtree from the disjoint set and, for all subtrees
  // to the "right" and "left" of it in sorted order, we append them onto the appropriate side
  // of the current tree, splitting nodes as necessary to maintain balance.
  // A "side" is referred to as a frontier, as it is a linked list of nodes from the root down to
  // the leaf level on that side of the tree. Each appended subtree is appended to the node at the
  // same height as itself on the frontier. Each tree is guaranteed to be at most as tall as the
  // current frontier because we start from the tallest subtree and work outward.
  const initialRoot = alternatingGetSecond<number, BNode<K, V>>(disjoint, tallestIndex);
  const frontier: BNode<K, V>[] = [initialRoot];

  // Process all subtrees to the right of the tallest subtree
  if (tallestIndex + 1 <= disjointEntryCount - 1) {
    updateFrontier(frontier, 0, getRightmostIndex);
    processSide(
      branchingFactor,
      disjoint,
      frontier,
      tallestIndex + 1,
      disjointEntryCount, 1,
      getRightmostIndex,
      getRightInsertionIndex,
      splitOffRightSide,
      updateRightMax
    );
  }

  // Process all subtrees to the left of the current tree
  if (tallestIndex - 1 >= 0) {
    // Note we need to update the frontier here because the right-side processing may have grown the tree taller.
    updateFrontier(frontier, 0, getLeftmostIndex);
    processSide(
      branchingFactor,
      disjoint,
      frontier,
      tallestIndex - 1,
      -1,
      -1,
      getLeftmostIndex,
      getLeftmostIndex,
      splitOffLeftSide,
      noop // left side appending doesn't update max keys
    );
  }

  const merged = new constructor(undefined, cmp, maxNodeSize);
  (merged as unknown as BTreeWithInternals<K, V>)._root = frontier[0];

  // Return the resulting tree
  return merged;
}

/**
 * Processes one side (left or right) of the disjoint subtree set during a merge operation.
 * Merges each subtree in the disjoint set from start to end (exclusive) into the given spine.
 */
function processSide<K, V>(
  branchingFactor: number,
  disjoint: (number | BNode<K, V>)[],
  spine: BNode<K, V>[],
  start: number,
  end: number,
  step: number,
  sideIndex: (node: BNodeInternal<K, V>) => number,
  sideInsertionIndex: (node: BNodeInternal<K, V>) => number,
  splitOffSide: (node: BNodeInternal<K, V>) => BNodeInternal<K, V>,
  updateMax: (node: BNodeInternal<K, V>, maxBelow: K) => void
): void {
  // Determine the depth of the first shared node on the frontier.
  // Appending subtrees to the frontier must respect the copy-on-write semantics by cloning
  // any shared nodes down to the insertion point. We track it by depth to avoid a log(n) walk of the
  // frontier for each insertion as that would fundamentally change our asymptotics.
  let isSharedFrontierDepth = 0;
  let cur = spine[0];
  // Find the first shared node on the frontier
  while (!cur.isShared && isSharedFrontierDepth < spine.length - 1) {
    isSharedFrontierDepth++;
    cur = (cur as BNodeInternal<K, V>).children[sideIndex(cur as BNodeInternal<K, V>)];
  }

  // This array holds the sum of sizes of nodes that have been inserted but not yet propagated upward.
  // For example, if a subtree of size 5 is inserted at depth 2, then unflushedSizes[1] += 5.
  // These sizes are added to the depth above the insertion point because the insertion updates the direct parent of the insertion.
  // These sizes are flushed upward any time we need to insert at level higher than pending unflushed sizes.
  // E.g. in our example, if we later insert at depth 0, we will add 5 to the node at depth 1 and the root at depth 0 before inserting.
  // This scheme enables us to avoid a log(n) propagation of sizes for each insertion.
  const unflushedSizes: number[] = new Array(spine.length).fill(0); // pre-fill to avoid "holey" array

  for (let i = start; i != end; i += step) {
    const currentHeight = spine.length - 1; // height is number of internal levels; 0 means leaf
    const subtree = alternatingGetSecond<number, BNode<K, V>>(disjoint, i);
    const subtreeHeight = alternatingGetFirst<number, BNode<K, V>>(disjoint, i);
    const insertionDepth = currentHeight - (subtreeHeight + 1); // node at this depth has children of height 'subtreeHeight'

    // Ensure path is unshared before mutation
    ensureNotShared(spine, isSharedFrontierDepth, insertionDepth, sideIndex);

    // Calculate expansion depth (first ancestor with capacity)
    const expansionDepth = Math.max(0, findCascadeEndDepth(spine, insertionDepth, branchingFactor));

    // Update sizes on spine above the shared ancestor before we expand
    updateSizeAndMax(spine, unflushedSizes, isSharedFrontierDepth, expansionDepth, updateMax);

    // Append and cascade splits upward
    const newRoot = appendAndCascade(spine, insertionDepth, branchingFactor, subtree, sideIndex, sideInsertionIndex, splitOffSide);
    if (newRoot) {
      // Set the spine root to the highest up new node; the rest of the spine is updated below
      spine[0] = newRoot;
      unflushedSizes.forEach((count) => check(count === 0, "Unexpected unflushed size after root split."));
      unflushedSizes.push(0); // new root level
      isSharedFrontierDepth = insertionDepth + 2;
      unflushedSizes[insertionDepth + 1] += subtree.size();
    } else {
      isSharedFrontierDepth = insertionDepth + 1;
      unflushedSizes[insertionDepth] += subtree.size();
    }

    // Finally, update the frontier from the highest new node downward
    // Note that this is often the point where the new subtree is attached,
    // but in the case of cascaded splits it may be higher up.
    updateFrontier(spine, expansionDepth, sideIndex);
    check(isSharedFrontierDepth === spine.length - 1 || spine[isSharedFrontierDepth].isShared === true, "Non-leaf subtrees must be shared.");
    check(unflushedSizes.length === spine.length, "Unflushed sizes length mismatch after root split.");
  }

  // Finally, propagate any remaining unflushed sizes upward and update max keys
  updateSizeAndMax(spine, unflushedSizes, isSharedFrontierDepth, 0, updateMax);
};

/**
 * Append a subtree at a given depth on the chosen side; cascade splits upward if needed.
 * All un-propagated sizes must have already been applied to the spine up to the end of any cascading expansions.
 * This method guarantees that the size of the inserted subtree will not propagate upward beyond the insertion point.
 * Returns a new root if the root was split, otherwise undefined.
 */
function appendAndCascade<K, V>(
  spine: BNode<K, V>[],
  insertionDepth: number,
  branchingFactor: number,
  subtree: BNode<K, V>,
  sideIndex: (node: BNodeInternal<K, V>) => number,
  sideInsertionIndex: (node: BNodeInternal<K, V>) => number,
  splitOffSide: (node: BNodeInternal<K, V>) => BNodeInternal<K, V>
): BNodeInternal<K, V> | undefined {
  // We must take care to avoid accidental propagation upward of the size of the inserted su
  // To do this, we first split nodes upward from the insertion point until we find a node with capacity
  // or create a new root. Since all un-propagated sizes have already been applied to the spine up to this point,
  // inserting at the end ensures no accidental propagation.

  // Depth is -1 if the subtree is the same height as the current tree
  if (insertionDepth >= 0) {
    let carry: BNode<K, V> | undefined = undefined;
    // Determine initially where to insert after any splits
    let insertTarget: BNodeInternal<K, V> = spine[insertionDepth] as BNodeInternal<K, V>;
    if (insertTarget.keys.length >= branchingFactor) {
      insertTarget = carry = splitOffSide(insertTarget);
    }

    let d = insertionDepth - 1;
    while (carry && d >= 0) {
      const parent = spine[d] as BNodeInternal<K, V>;
      const idx = sideIndex(parent);
      // Refresh last key since child was split
      parent.keys[idx] = parent.children[idx].maxKey();
      if (parent.keys.length < branchingFactor) {
        // We have reached the end of the cascade
        insertNoCount(parent, sideInsertionIndex(parent), carry);
        carry = undefined;
      } else {
        // Splitting the parent here requires care to avoid incorrectly double counting sizes
        // Example: a node is at max capacity 4, with children each of size 4 for 16 total.
        // We split the node into two nodes of 2 children each, but this does *not* modify the size
        // of its parent. Therefore when we insert the carry into the torn-off node, we must not
        // increase its size or we will double-count the size of the carry su
        const tornOff = splitOffSide(parent);
        insertNoCount(tornOff, sideInsertionIndex(tornOff), carry);
        carry = tornOff;
      }
      d--;
    }

    let newRoot: BNodeInternal<K, V> | undefined = undefined;
    if (carry !== undefined) {
      // Expansion reached the root, need a new root to hold carry
      const oldRoot = spine[0] as BNodeInternal<K, V>;
      newRoot = new BNodeInternal<K, V>([oldRoot], oldRoot.size() + carry.size());
      insertNoCount(newRoot, sideInsertionIndex(newRoot), carry);
    }

    // Finally, insert the subtree at the insertion point
    insertNoCount(insertTarget, sideInsertionIndex(insertTarget), subtree);
    return newRoot;
  } else {
    // Insertion of subtree with equal height to current tree
    const oldRoot = spine[0] as BNodeInternal<K, V>;
    const newRoot = new BNodeInternal<K, V>([oldRoot], oldRoot.size());
    insertNoCount(newRoot, sideInsertionIndex(newRoot), subtree);
    return newRoot;
  }
};

/**
 * Clone along the spine from [isSharedFrontierDepth to depthTo] inclusive so path is safe to mutate.
 * Short-circuits if first shared node is deeper than depthTo (the insertion depth).
 */
function ensureNotShared<K, V>(
  spine: BNode<K, V>[],
  isSharedFrontierDepth: number,
  depthToInclusive: number,
  sideIndex: (node: BNodeInternal<K, V>) => number) {
  if (spine.length === 1 /* only a leaf */ || depthToInclusive < 0 /* new root case */)
    return; // nothing to clone when root is a leaf; equal-height case will handle this

  // Clone root if needed first (depth 0)
  if (isSharedFrontierDepth === 0) {
    const root = spine[0];
    spine[0] = root.clone() as BNodeInternal<K, V>;
  }

  // Clone downward along the frontier to 'depthToInclusive'
  for (let depth = Math.max(isSharedFrontierDepth, 1); depth <= depthToInclusive; depth++) {
    const parent = spine[depth - 1] as BNodeInternal<K, V>;
    const childIndex = sideIndex(parent);
    const clone = parent.children[childIndex].clone();
    parent.children[childIndex] = clone;
    spine[depth] = clone as BNodeInternal<K, V>;
  }
};

/**
 * Propagates size updates and updates max keys for nodes in (isSharedFrontierDepth, depthTo)
 */
function updateSizeAndMax<K, V>(
  spine: BNode<K, V>[],
  unflushedSizes: number[],
  isSharedFrontierDepth: number,
  depthUpToInclusive: number,
  updateMax: (node: BNodeInternal<K, V>, maxBelow: K) => void) {
  // If isSharedFrontierDepth is <= depthUpToInclusive there is nothing to update because
  // the insertion point is inside a shared node which will always have correct sizes
  const maxKey = spine[isSharedFrontierDepth].maxKey();
  const startDepth = isSharedFrontierDepth - 1;
  for (let depth = startDepth; depth >= depthUpToInclusive; depth--) {
    const sizeAtLevel = unflushedSizes[depth];
    unflushedSizes[depth] = 0; // we are propagating it now
    if (depth > 0) {
      // propagate size upward, will be added lazily, either when a subtree is appended at or above that level or
      // at the end of processing the entire side
      unflushedSizes[depth - 1] += sizeAtLevel;
    }
    const node = spine[depth] as BNodeInternal<K, V>;
    node._size += sizeAtLevel;
    // No-op if left side, as max keys in parents are unchanged by appending to the beginning of a node
    updateMax(node, maxKey);
  }
};

/**
 * Update a spine (frontier) from a specific depth down, inclusive.
 * Extends the frontier array if it is not already as long as the frontier.
 */
function updateFrontier<K, V>(frontier: BNode<K, V>[], depthLastValid: number, sideIndex: (node: BNodeInternal<K, V>) => number): void {
  check(frontier.length > depthLastValid, "updateFrontier: depthLastValid exceeds frontier height");
  const startingAncestor = frontier[depthLastValid];
  if (startingAncestor.isLeaf)
    return;
  const internal = startingAncestor as BNodeInternal<K, V>;
  let cur: BNode<K, V> = internal.children[sideIndex(internal)];
  let depth = depthLastValid + 1;
  while (!cur.isLeaf) {
    const ni = cur as BNodeInternal<K, V>;
    frontier[depth] = ni;
    cur = ni.children[sideIndex(ni)];
    depth++;
  }
  frontier[depth] = cur;
};

/**
 * Find the first ancestor (starting at insertionDepth) with capacity.
 */
function findCascadeEndDepth<K, V>(spine: BNode<K, V>[], insertionDepth: number, branchingFactor: number): number {
  for (let depth = insertionDepth; depth >= 0; depth--) {
    if (spine[depth].keys.length < branchingFactor)
      return depth;
  }
  return -1; // no capacity, will need a new root
};

/**
 * Inserts the child without updating cached size counts.
 */
function insertNoCount<K, V>(
  parent: BNodeInternal<K, V>,
  index: number,
  child: BNode<K, V>
): void {
  parent.children.splice(index, 0, child);
  parent.keys.splice(index, 0, child.maxKey());
}

// ---- Side-specific delegates for merging subtrees into a frontier ----

function getLeftmostIndex<K, V>(): number {
  return 0;
}

function getRightmostIndex<K, V>(node: BNodeInternal<K, V>): number {
  return node.children.length - 1;
}

function getRightInsertionIndex<K, V>(node: BNodeInternal<K, V>): number {
  return node.children.length;
}

function splitOffRightSide<K, V>(node: BNodeInternal<K, V>): BNodeInternal<K, V> {
  return node.splitOffRightSide();
}

function splitOffLeftSide<K, V>(node: BNodeInternal<K, V>): BNodeInternal<K, V> {
  return node.splitOffLeftSide();
}

function updateRightMax<K, V>(node: BNodeInternal<K, V>, maxBelow: K): void {
  node.keys[node.keys.length - 1] = maxBelow;
}

// ------- Alternating list helpers -------
// These helpers manage a list that alternates between two types of entries.
// Storing data this way avoids small tuple allocations and shows major improvements
// in GC time in benchmarks.

export function alternatingCount(list: unknown[]): number {
  return list.length >> 1;
}

export function alternatingGetFirst<TFirst, TSecond>(list: Array<TFirst | TSecond>, index: number): TFirst {
  return list[index << 1] as TFirst;
}

export function alternatingGetSecond<TFirst, TSecond>(list: Array<TFirst | TSecond>, index: number): TSecond {
  return list[(index << 1) + 1] as TSecond;
}

export function alternatingPush<TFirst, TSecond>(list: Array<TFirst | TSecond>, first: TFirst, second: TSecond): void {
  // Micro benchmarks show this is the fastest way to do this
  list.push(first, second);
}