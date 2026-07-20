import BTree from '../b+tree';
/**
 * Calls the supplied `callback` for each key/value pair shared by both trees, in sorted key order.
 * Neither tree is modified.
 *
 * Let `N` and `M` be the input sizes, `I` the number of keys present in both trees, `U = N + M - 2I`
 * the number of keys present in exactly one tree, `H` the larger tree height, and `G` the number of maximal
 * runs of keys belonging exclusively to one particular tree in merged key order. With a fixed max node size
 * and normally occupied nodes, the complexity is `O(min(I + U, I + G * H))`.
 * @param treeA First tree to compare.
 * @param treeB Second tree to compare.
 * @param callback Invoked for keys that appear in both trees. It can cause iteration to early exit by returning `{ break: R }`.
 * @returns The first `break` payload returned by the callback, or `undefined` if the walk finishes.
 * @throws Error if the trees were built with different comparators.
 */
export default function forEachKeyInBoth<K, V, R = void>(treeA: BTree<K, V>, treeB: BTree<K, V>, callback: (key: K, leftValue: V, rightValue: V) => {
    break?: R;
} | void): R | undefined;
