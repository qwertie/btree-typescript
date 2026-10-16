import BTree from '../b+tree';
/**
 * Calls the supplied `callback` for each key/value pair shared by both trees, in sorted key order.
 * Neither tree is modified.
 *
 * Let `A` and `B` be the input sizes, `H` the larger tree height (counting a leaf as height 1),
 * and `S` the number of maximal contiguous runs of keys from one tree in the totally ordered
 * list of keys from both trees.
 * The runtime of this method is `O(min(A + B, S * H))`.
 * @param treeA First tree to compare.
 * @param treeB Second tree to compare.
 * @param callback Invoked for keys that appear in both trees. It can cause iteration to early exit by returning `{ break: R }`.
 * @returns The first `break` payload returned by the callback, or `undefined` if the walk finishes.
 * @throws Error if the trees were built with different comparators.
 */
export default function forEachKeyInBoth<K, V, R = void>(treeA: BTree<K, V>, treeB: BTree<K, V>, callback: (key: K, leftValue: V, rightValue: V) => {
    break?: R;
} | void): R | undefined;
