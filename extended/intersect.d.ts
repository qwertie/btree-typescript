import BTree from '../b+tree';
/**
 * Returns a new tree containing only keys present in both input trees.
 * Neither tree is modified.
 *
 * Complexity is O(N + M) in the fully overlapping case and additionally bounded by O(log(N + M) * D),
 * where `D` is the number of disjoint key ranges, because disjoint subtrees are skipped entirely.
 * In practice, that means for keys of random distribution the performance is linear and for keys with significant
 * numbers of non-overlapping key ranges it is much faster.
 * @param treeA First tree to intersect.
 * @param treeB Second tree to intersect.
 * @param combineFn Called for keys that appear in both trees. Return the desired value.
 * @returns A new tree populated with the intersection.
 * @throws Error if the trees were created with different comparators.
 */
export default function intersect<TBTree extends BTree<K, V>, K, V>(treeA: TBTree, treeB: TBTree, combineFn: (key: K, leftValue: V, rightValue: V) => V): TBTree;
