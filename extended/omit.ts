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

type LowerBound<K> = { gt: K, gte?: never } | { gte: K, gt?: never };
type UpperBound<K> = { lt: K, lte?: never } | { lte: K, lt?: never };
type OptionalLowerBound<K> = { gt?: K, gte?: never } | { gte?: K, gt?: never };
type OptionalUpperBound<K> = { lt?: K, lte?: never } | { lte?: K, lt?: never };

/**
 * A range of keys, described by a lower bound (`gt` or `gte`), an upper bound (`lt` or `lte`), or both.
 * At least one bound is required, and at most one of each kind may be given. A missing (or `undefined`)
 * bound leaves that end of the range open.
 * @example { gte: 5, lt: 10 } // 5 <= key < 10
 * @example { gt: 5 }          // key > 5
 * @example { lte: 10 }        // key <= 10
 */
export type KeyRange<K> = (LowerBound<K> & OptionalUpperBound<K>) | (OptionalLowerBound<K> & UpperBound<K>);

/** The key type of a tree. The range's key type is derived from the tree so that it is not inferred from the range. */
type KeyOf<TBTree> = TBTree extends BTree<infer K, any> ? K : never;

/**
 * Error message used when `omit` is called with an invalid key range.
 * @internal
 */
export const omitInvalidRangeErrorMsg =
  "omit requires a range with at least one bound, and at most one of `gt`/`gte` and one of `lt`/`lte`.";

/**
 * Returns a new tree containing every entry of `tree` except those whose keys fall in the given range.
 * The input tree is not modified.
 *
 * The runtime is `O(log(n))`. Subtrees that lie entirely outside the range are shared with the input tree rather
 * than copied.
 * @param tree The tree to omit keys from.
 * @param range The keys to omit, e.g. `{ gte: 5, lt: 10 }`. Omit a bound to leave that end of the range open.
 * @returns A new tree without the keys in the range.
 * @throws Error if the range has no bounds, or has both `gt` and `gte` or both `lt` and `lte`.
 */
export default function omit<TBTree extends BTree<any, any>>(tree: TBTree, range: KeyRange<KeyOf<TBTree>>): TBTree {
  const { gt, gte, lt, lte } = range;
  if ((gt !== undefined && gte !== undefined) || (lt !== undefined && lte !== undefined))
    throw new Error(omitInvalidRangeErrorMsg);
  const start = gt !== undefined ? gt : gte;
  const end = lt !== undefined ? lt : lte;
  if (start === undefined && end === undefined)
    throw new Error(omitInvalidRangeErrorMsg);
  const includeStart = gt === undefined;
  const includeEnd = lt === undefined;

  const _tree = tree as unknown as BTreeWithInternals<KeyOf<TBTree>, unknown>;
  const root = _tree._root;
  const cmp = _tree._compare;
  // O(1) checks for cases in which nothing can be omitted
  if (root.size() === 0)
    return tree.clone();
  if (start !== undefined) {
    const startVsMax = cmp(start, root.maxKey());
    if (startVsMax > 0 || (startVsMax === 0 && !includeStart))
      return tree.clone();
    if (end !== undefined) {
      const order = cmp(start, end);
      if (order > 0 || (order === 0 && !(includeStart && includeEnd)))
        return tree.clone();
    }
  }

  const decomposed = decomposeOmittingRange(_tree, start, includeStart, end, includeEnd);
  // If decomposd is undefined, then the key range is empty and there is nothig to omit
  if (decomposed === undefined)
    return tree.clone();
  const constructor = tree.constructor as BTreeConstructor<TBTree, KeyOf<TBTree>, unknown>;
  return buildFromDecomposition(constructor, _tree._maxNodeSize, decomposed, cmp, _tree._maxNodeSize);
}

/**
 * Decomposes a tree into the maximal disjoint subtrees (and loose leaf entries) that lie outside of a key range.
 * A cursor is first placed directly on the first key past the lower bound with a single descent. If that key is in
 * the range, every node on its spine contains it, so none can be reused whole; everything to the left of the spine is
 * kept and is collected straight from the spine. The cursor then walks:
 *   1. omit: to the first key after the range, collecting nothing
 *   2. keep: off the end of the tree, reusing every subtree it skips over
 * Returns undefined if the range contains no keys.
 * If `start` is supplied, the tree must contain a key after it (or equal to it, if `includeStart`).
 */
function decomposeOmittingRange<K, V>(
  tree: BTreeWithInternals<K, V>,
  start: K | undefined,
  includeStart: boolean,
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
    tree, makeDecomposePayload, onEnterLeafOmitting, noop, noop, disqualifyOnStepUp, disqualifyOnStepDown, start, includeStart);

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
