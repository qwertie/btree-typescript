import BTree from '../b+tree';
/**
 * Calls the supplied `callback` for each key/value pair that is in includeTree but not in excludeTree.
 * This is also known as set subtraction.
 * The callback will be called in sorted key order.
 * Neither tree is modified.
 * @param includeTree The first tree. This is the tree from which keys will be taken.
 * @param excludeTree The second tree. Keys present in this tree will be excluded.
 * @param callback Invoked for keys that are in includeTree but not in excludeTree. It can cause iteration to early exit by returning `{ break: R }`.
 * @description Complexity is bounded by O(N + M) for time.
 * However, time is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
 * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
 * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully interleaved keys, none intersecting) performance is faster than calling `toArray`
 * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
 */
export default function forEachKeyNotIn<K, V, R = void>(includeTree: BTree<K, V>, excludeTree: BTree<K, V>, callback: (key: K, value: V) => {
    break?: R;
} | void): R | undefined;
