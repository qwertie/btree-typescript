import BTree, { BNode } from '../b+tree';
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
import { createCursor, Cursor, getKey, moveTo, noop } from './parallelWalk';

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
  // O(1) checks for cases in which nothing can be omitted
  if (root.size() === 0)
    return tree.clone();
  if (start !== undefined) {
    if (cmp(start, root.maxKey()) > 0)
      return tree.clone();
    if (end !== undefined) {
      const order = cmp(start, end);
      if (order > 0 || (order === 0 && !includeEnd))
        return tree.clone();
    }
  }

  const decomposed = decomposeOmittingRange(_tree, start, end, includeEnd);
  if (decomposed === undefined)
    return tree.clone();
  const constructor = tree.constructor as BTreeConstructor<TBTree, K, V>;
  return buildFromDecomposition(constructor, _tree._maxNodeSize, decomposed, cmp, _tree._maxNodeSize);
}

/**
 * Decomposes a tree into the maximal disjoint subtrees (and loose leaf entries) that lie outside of a key range.
 * A cursor is first placed directly on the first key >= `start` with a single descent. Every node on its spine
 * contains that (omitted) key, so none can be reused whole; everything to the left of the spine is kept and is
 * collected straight from the spine. The cursor then walks:
 *   1. omit: to the first key after the range, collecting nothing
 *   2. keep: off the end of the tree, reusing every subtree it skips over
 * Returns undefined if the range contains no keys.
 * `start`, if supplied, must not be greater than the tree's max key.
 */
function decomposeOmittingRange<K, V>(
  tree: BTreeWithInternals<K, V>,
  start: K | undefined,
  end: K | undefined,
  includeEnd: boolean
): DecomposeResult<K, V> | undefined {
  // The cursor starts out omitting: it collects nothing and only disqualifies nodes containing omitted keys.
  const onEnterLeafOmitting = (_: BNode<K, V>, destIndex: number, cursor: Cursor<K, V, DecomposePayload>) => {
    // Keys before the destination are omitted, so the leaf cannot be reused whole.
    if (destIndex > 0) {
      cursor.leafPayload.disqualified = true;
      disqualifySpine(cursor, cursor.spine.length - 1);
    }
  };
  const cursor = createCursor<K, V, DecomposePayload>(
    tree, makeDecomposePayload, onEnterLeafOmitting, noop, noop, disqualifyOnStepUp, disqualifyOnStepDown, start);

  if (end !== undefined) {
    const order = tree._compare(getKey(cursor), end);
    if (order > 0 || (order === 0 && !includeEnd))
      return undefined;
  }

  // The cursor sits on an omitted key, so its leaf and every ancestor cannot be reused whole.
  cursor.leafPayload.disqualified = true;
  disqualifySpine(cursor, cursor.spine.length - 1);

  const decomposer = createDecomposer<K, V>(tree._maxNodeSize);

  // Keep everything left of the spine. Visiting the spine top-down yields these in key order.
  const spine = cursor.spine;
  for (let depth = 0; depth < spine.length; ++depth) {
    const { node, childIndex } = spine[depth];
    const childHeight = spine.length - depth - 1;
    for (let i = 0; i < childIndex; ++i)
      decomposer.addSharedNodeToDisjointSet(node.children[i], childHeight);
  }
  decomposer.pushLeafRange(cursor.leaf, 0, cursor.leafIndex);

  // When `end` is undefined, everything from the cursor onward is omitted.
  if (end !== undefined) {
    // Phase 1 (omit): walk to the first key after the range.
    const [out] = moveTo(cursor, cursor, end, !includeEnd, false);
    if (!out) {
      // Phase 2 (keep): walk off the end of the tree, collecting everything passed.
      // This walk never enters a new leaf, so onEnterLeaf is not needed.
      cursor.onMoveInLeaf = decomposer.onMoveInLeaf;
      cursor.onExitLeaf = decomposer.onExitLeaf;
      cursor.onStepUp = decomposer.onStepUp;
      cursor.onStepDown = decomposer.onStepDown;
      moveTo(cursor, cursor, tree._root.maxKey(), false, false);
    }
  }

  return decomposer.finish();
}
