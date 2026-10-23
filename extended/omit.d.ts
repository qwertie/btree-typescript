import BTree from '../b+tree';
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
