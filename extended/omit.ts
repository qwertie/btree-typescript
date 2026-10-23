import BTree, { check } from '../b+tree';
import { BTreeConstructor, type BTreeWithInternals } from './shared';
import {
  buildFromDecomposition,
  createDecomposer,
  disqualifyOnStepDown,
  disqualifyOnStepUp,
  disqualifySpine,
  makeDecomposePayload,
  type DecomposePayload,
  type DecomposeResult
} from './decompose';
import { createCursor, Cursor, moveTo, noop } from './parallelWalk';

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

/**
 * Decomposes a tree into the maximal disjoint subtrees (and loose leaf entries) that lie outside of a key range.
 * A single cursor walks the tree in three phases:
 *   1. keep: from the minimum key to the first key >= `start`
 *   2. omit: from there to the first key after the range
 *   3. keep: from there off the end of the tree
 * The keep phases use the standard decomposition callbacks, which reuse every subtree the cursor skips over.
 * The omit phase swaps in callbacks that collect nothing and only disqualify the nodes containing omitted keys,
 * so that those nodes are not reused whole.
 * The caller must guarantee the range contains at least one key of the (non-empty) tree.
 */
function decomposeOmittingRange<K, V>(
  tree: BTreeWithInternals<K, V>,
  start: K | undefined,
  end: K | undefined,
  includeEnd: boolean
): DecomposeResult<K, V> {
  type Callbacks = Pick<Cursor<K, V, DecomposePayload>, 'onEnterLeaf' | 'onMoveInLeaf' | 'onExitLeaf' | 'onStepUp' | 'onStepDown'>;
  const decomposer = createDecomposer<K, V>(tree._maxNodeSize);
  const keep: Callbacks = {
    // A leaf is only entered while walking to `start` (phase 3 walks off the end), so its keys before the destination are kept.
    onEnterLeaf: (leaf, destIndex) => decomposer.pushLeafRange(leaf, 0, destIndex),
    onMoveInLeaf: decomposer.onMoveInLeaf,
    onExitLeaf: decomposer.onExitLeaf,
    onStepUp: decomposer.onStepUp,
    onStepDown: decomposer.onStepDown,
  };
  const omit: Callbacks = {
    onEnterLeaf: (_, destIndex, cursor) => {
      // Keys before the destination are omitted, so the leaf cannot be reused whole.
      if (destIndex > 0) {
        cursor.leafPayload.disqualified = true;
        disqualifySpine(cursor, cursor.spine.length - 1);
      }
    },
    onMoveInLeaf: noop,
    onExitLeaf: noop,
    onStepUp: disqualifyOnStepUp,
    onStepDown: disqualifyOnStepDown,
  };

  const cursor = createCursor<K, V, DecomposePayload>(
    tree, makeDecomposePayload, keep.onEnterLeaf, keep.onMoveInLeaf, keep.onExitLeaf, keep.onStepUp, keep.onStepDown);

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
    Object.assign(cursor, omit);
    const [out] = moveTo(cursor, cursor, end, !includeEnd, false);
    if (!out) {
      // Phase 3 (keep): walk off the end of the tree, collecting everything passed.
      Object.assign(cursor, keep);
      moveTo(cursor, cursor, tree._root.maxKey(), false, false);
    }
  }
  // When `end` is undefined, everything from the cursor onward is omitted, so the walk simply stops.

  return decomposer.finish();
}
