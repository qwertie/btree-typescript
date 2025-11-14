import BTree from '../b+tree';
/**
 * Calls the supplied `callback` for each key/value pair that is in `includeTree` but not in `excludeTree`
 * (set subtraction). The callback runs in sorted key order and neither tree is modified.
 *
 * Complexity is O(N + M) when the key ranges overlap heavily, and additionally bounded by O(log(N + M) * D)
 * where `D` is the number of disjoint ranges between the trees, because non-overlapping subtrees are skipped.
 * In practice, that means for keys of random distribution the performance is linear and for keys with significant
 * numbers of non-overlapping key ranges it is much faster.
 * @param includeTree The tree to iterate keys from.
 * @param excludeTree Keys present in this tree are omitted from the callback.
 * @param callback Invoked for keys that are in `includeTree` but not `excludeTree`. It can cause iteration to early exit by returning `{ break: R }`.
 * @returns The first `break` payload returned by the callback, or `undefined` if all qualifying keys are visited.
 * @throws Error if the trees were built with different comparators.
 */
export default function forEachKeyNotIn<K, V, R = void>(includeTree: BTree<K, V>, excludeTree: BTree<K, V>, callback: (key: K, value: V) => {
    break?: R;
} | void): R | undefined;
