import BTree from '../b+tree';
/**
 * Calls the supplied `callback` for each key/value pair that is in `includeTree` but not in `excludeTree`
 * (set subtraction). The callback runs in sorted key order and neither tree is modified.
 *
 * Let `N` and `M` be the sizes of `includeTree` and `excludeTree`, respectively, `I` the number of keys present
 * in both trees, `U = N + M - 2I` the number of keys present in exactly one tree, `H` the larger tree height,
 * and `G` the number of maximal runs of keys belonging exclusively to one particular tree in merged key order.
 * With a fixed max node size and normally occupied nodes, the complexity is
 * `O(min(I + U, N + G * H))`.
 * @param includeTree The tree to iterate keys from.
 * @param excludeTree Keys present in this tree are omitted from the callback.
 * @param callback Invoked for keys that are in `includeTree` but not `excludeTree`. It can cause iteration to early exit by returning `{ break: R }`.
 * @returns The first `break` payload returned by the callback, or `undefined` if all qualifying keys are visited.
 * @throws Error if the trees were built with different comparators.
 */
export default function forEachKeyNotIn<K, V, R = void>(includeTree: BTree<K, V>, excludeTree: BTree<K, V>, callback: (key: K, value: V) => {
    break?: R;
} | void): R | undefined;
