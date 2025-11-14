import BTree from '../b+tree';
/**
 * Returns a new tree containing only the keys that are present in `targetTree` but not `subtractTree` (set subtraction).
 * Neither tree is modified.
 *
 * Complexity is O(N + M) for time and O(N) for allocations in the worst case. Additionally, time is bounded by
 * O(log(N + M) * D1) and space by O(log N * D2), where `D1` is the number of disjoint key ranges between the trees
 * and `D2` is the number of disjoint ranges inside `targetTree`, because disjoint subtrees are skipped entirely.
 * In practice, that means for keys of random distribution the performance is linear and for keys with significant
 * numbers of non-overlapping key ranges it is much faster.
 * @param targetTree The tree to subtract from.
 * @param subtractTree The tree whose keys will be removed from the result.
 * @returns A new tree that contains the subtraction result.
 * @throws Error if the trees were created with different comparators or max node sizes.
 */
export default function subtract<TBTree extends BTree<K, V>, K, V>(targetTree: TBTree, subtractTree: TBTree): TBTree;
