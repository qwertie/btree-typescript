import BTree from '../b+tree';
/**
 * Efficiently unions two trees, reusing subtrees wherever possible without mutating either input.
 *
 * Let `N` and `M` be the input sizes, `I` the number of keys present in both trees, `U = N + M - 2I`
 * the number of keys present in exactly one tree, `H` the larger tree height (counting a leaf root as height 1),
 * and `G` the number of maximal runs of one-tree-only keys in merged key order. With a fixed max node size and
 * normally occupied nodes, the complexity excluding time spent in `combineFn` is
 * `O(H + I + min(U, G * H^2))`, and therefore `O(N + M)` in the worst case.
 * @param treeA First tree to union.
 * @param treeB Second tree to union.
 * @param combineFn Called for keys that appear in both trees. Return the desired value, or
 *        `undefined` to omit the key from the result. Note: symmetric difference can be achieved by always returning `undefined`.
 * @returns A new BTree that contains the unioned key/value pairs.
 * @throws Error if the trees were created with different comparators or max node sizes.
 */
export default function union<TBTree extends BTree<K, V>, K, V>(treeA: TBTree, treeB: TBTree, combineFn: (key: K, leftValue: V, rightValue: V) => V | undefined): TBTree;
