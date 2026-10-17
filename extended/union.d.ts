import BTree from '../b+tree';
/**
 * Efficiently unions two trees, reusing subtrees wherever possible without mutating either input.
 *
 * Let `A` and `B` be the input sizes, `H` the larger tree height (counting a leaf as height 1),
 * and `S` the number of maximal contiguous runs of keys from one tree in the totally ordered
 * list of keys from both trees, in which a key present in both trees is listed once per tree
 * (so every shared key starts a new run, and `S` is at least the number of shared keys).
 * The runtime of this method is `O(min(A + B, S * H))`.
 * @param treeA First tree to union.
 * @param treeB Second tree to union.
 * @param combineFn Called for keys that appear in both trees. Return the desired value, or
 *        `undefined` to omit the key from the result. Note: symmetric difference can be achieved by always returning `undefined`.
 * @returns A new BTree that contains the unioned key/value pairs.
 * @throws Error if the trees were created with different comparators or max node sizes.
 */
export default function union<TBTree extends BTree<K, V>, K, V>(treeA: TBTree, treeB: TBTree, combineFn: (key: K, leftValue: V, rightValue: V) => V | undefined): TBTree;
