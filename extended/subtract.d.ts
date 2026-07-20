import BTree from '../b+tree';
/**
 * Returns a new tree containing only the keys that are present in `targetTree` but not `subtractTree` (set subtraction).
 * Neither tree is modified.
 *
 * Let `N` and `M` be the input sizes, `I` the number of keys present in both trees, `U = N + M - 2I`
 * the number of keys present in exactly one tree, `H` the larger tree height, and `G` the number of maximal
 * runs of keys belonging exclusively to one particular tree in merged key order. With a fixed max node size
 * and normally occupied nodes, the time complexity is `O(min(I + U, I + G * H^2))`.
 * Allocations are O(N) in the worst case, but disjoint subtrees from `targetTree` are reused.
 * @param targetTree The tree to subtract from.
 * @param subtractTree The tree whose keys will be removed from the result.
 * @returns A new tree that contains the subtraction result.
 * @throws Error if the trees were created with different comparators or max node sizes.
 */
export default function subtract<TBTree extends BTree<K, V>, K, V>(targetTree: TBTree, subtractTree: TBTree): TBTree;
