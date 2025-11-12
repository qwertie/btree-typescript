import BTree from '../b+tree';
/**
 * Calls the supplied `callback` for each key/value pair shared by both trees.
 * Neither tree is modified.
 * @param treeA First tree to compare.
 * @param treeB Second tree to compare.
 * @param callback Invoked for keys that appear in both trees.
 * @description Complexity is bounded by O(N + M) for time.
 * However, time is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
 * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
 * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than calling `toArray`
 * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
 */
export default function forEachKeyInBoth<K, V>(treeA: BTree<K, V>, treeB: BTree<K, V>, callback: (key: K, leftValue: V, rightValue: V) => void): void;
