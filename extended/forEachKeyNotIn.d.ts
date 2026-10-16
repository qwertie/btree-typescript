import BTree from '../b+tree';
/**
 * Calls the supplied `callback` for each key/value pair that is in `includeTree` but not in `excludeTree`
 * (set subtraction). The callback runs in sorted key order and neither tree is modified.
 *
 * Let `A` and `B` be the sizes of `includeTree` and `excludeTree`, respectively,
 * `H` the larger tree height (counting a leaf as height 1), and `S` the number of maximal
 * contiguous runs of keys from one tree in the totally ordered list of keys from both trees.
 * The runtime of this method is `O(min(A + B, A + S * H))`.
 * @param includeTree The tree to iterate keys from.
 * @param excludeTree Keys present in this tree are omitted from the callback.
 * @param callback Invoked for keys that are in `includeTree` but not `excludeTree`. It can cause iteration to early exit by returning `{ break: R }`.
 * @returns The first `break` payload returned by the callback, or `undefined` if all qualifying keys are visited.
 * @throws Error if the trees were built with different comparators.
 */
export default function forEachKeyNotIn<K, V, R = void>(includeTree: BTree<K, V>, excludeTree: BTree<K, V>, callback: (key: K, value: V) => {
    break?: R;
} | void): R | undefined;
