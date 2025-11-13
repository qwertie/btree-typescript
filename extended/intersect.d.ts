import BTree from '../b+tree';
/**
 * Returns a new tree containing only keys present in both input trees.
 * Neither tree is modified.
 * @param treeA First tree to intersect.
 * @param treeB Second tree to intersect.
 * @param combineFn Called for keys that appear in both trees. Return the desired value.
 * @description Complexity is bounded O(N + M) for both time and allocations.
 * However, it is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
 * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
 * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully intersecting keys) performance is faster than calling `toArray`
 * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
 */
export default function intersect<TBTree extends BTree<K, V>, K, V>(treeA: TBTree, treeB: TBTree, combineFn: (key: K, leftValue: V, rightValue: V) => V): TBTree;
