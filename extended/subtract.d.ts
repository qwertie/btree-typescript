import BTree from '../b+tree';
/**
 * Returns a new tree containing only the keys that are present in `targetTree` but not `subtractTree` (set subtraction).
 * Neither tree is modified.
 *
 * Let `A` and `B` be the input sizes, `H` the larger tree height (counting a leaf as height 1),
 * and `S` the number of maximal contiguous runs of keys from one tree in the totally ordered
 * list of keys from both trees.
 * The runtime of this method is `O(min(A + B, S * H))`.
 * Allocations are O(A) in the worst case, but disjoint subtrees from `targetTree` are reused.
 * @param targetTree The tree to subtract from.
 * @param subtractTree The tree whose keys will be removed from the result.
 * @returns A new tree that contains the subtraction result.
 * @throws Error if the trees were created with different comparators or max node sizes.
 */
export default function subtract<TBTree extends BTree<K, V>, K, V>(targetTree: TBTree, subtractTree: TBTree): TBTree;
