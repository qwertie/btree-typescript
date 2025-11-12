import BTree from '../b+tree';
/**
 * Intersects the two trees, calling the supplied `intersection` callback for each intersecting key/value pair.
 * Neither tree is modified.
 * @param treeA First tree to intersect.
 * @param treeB Second tree to intersect.
 * @param intersection Called for keys that appear in both trees.
 * @description Complexity is bounded O(N + M) time and O(log(N + M)) for allocations.
 * However, time is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
 * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
 * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than calling `toArray`
 * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
 */
export declare function intersect<K, V>(treeA: BTree<K, V>, treeB: BTree<K, V>, intersection: (key: K, leftValue: V, rightValue: V) => void): void;
