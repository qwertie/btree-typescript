import BTree from '../b+tree';
/**
 * Calls the supplied `callback` for each key/value pair shared by both trees, in sorted key order.
 * Neither tree is modified.
 *
 * Complexity is O(N + M) when the trees overlap heavily, and additionally bounded by O(log(N + M) * D)
 * where `D` is the number of disjoint key ranges between the trees, because whole non-intersecting subtrees
 * are skipped.
 * In practice, that means for keys of random distribution the performance is linear and for keys with significant
 * numbers of non-overlapping key ranges it is much faster.
 * @param treeA First tree to compare.
 * @param treeB Second tree to compare.
 * @param callback Invoked for keys that appear in both trees. It can cause iteration to early exit by returning `{ break: R }`.
 * @returns The first `break` payload returned by the callback, or `undefined` if the walk finishes.
 * @throws Error if the trees were built with different comparators.
 */
export default function forEachKeyInBoth<K, V, R = void>(treeA: BTree<K, V>, treeB: BTree<K, V>, callback: (key: K, leftValue: V, rightValue: V) => {
    break?: R;
} | void): R | undefined;
