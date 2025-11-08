import BTree from './b+tree';
import { BNode } from './b+tree';
export declare type ExtendedTreeInternals<K, V> = {
    _root: BNode<K, V>;
    _size: number;
    _maxNodeSize: number;
    _compare: (a: K, b: K) => number;
};
/**
 * Computes the differences between `treeThis` and `treeOther`.
 * For efficiency, the diff is returned via invocations of supplied handlers.
 * The computation is optimized for the case in which the two trees have large amounts of shared data
 * (obtained by calling the `clone` or `with` APIs) and will avoid any iteration of shared state.
 * The handlers can cause computation to early exit by returning `{ break: R }`.
 * Neither collection should be mutated during the comparison (inside your callbacks), as this method assumes they remain stable.
 * @param treeThis The tree whose differences will be reported via the callbacks.
 * @param treeOther The tree to compute a diff against.
 * @param onlyThis Callback invoked for all keys only present in `treeThis`.
 * @param onlyOther Callback invoked for all keys only present in `treeOther`.
 * @param different Callback invoked for all keys with differing values.
 */
export declare function diffAgainst<K, V, R>(treeThis: BTree<K, V>, treeOther: BTree<K, V>, onlyThis?: (k: K, v: V) => {
    break?: R;
} | void, onlyOther?: (k: K, v: V) => {
    break?: R;
} | void, different?: (k: K, vThis: V, vOther: V) => {
    break?: R;
} | void): R | undefined;
export default diffAgainst;
