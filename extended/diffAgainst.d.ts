import BTree from '../b+tree';
/**
 * Computes the differences between `treeA` and `treeB`.
 * For efficiency, the diff is returned via invocations of supplied handlers.
 * The computation is optimized for the case in which the two trees have large amounts of shared data
 * (obtained by calling the `clone` or `with` APIs) and will avoid any iteration of shared state.
 * The handlers can cause computation to early exit by returning `{ break: R }`.
 * Neither collection should be mutated during the comparison (inside your callbacks), as this method assumes they remain stable.
 * @param treeA The tree whose differences will be reported via the callbacks.
 * @param treeB The tree to compute a diff against.
 * @param onlyA Callback invoked for all keys only present in `treeA`.
 * @param onlyB Callback invoked for all keys only present in `treeB`.
 * @param different Callback invoked for all keys with differing values.
 * @returns The first `break` payload returned by a handler, or `undefined` if no handler breaks.
 * @throws Error if the supplied trees were created with different comparators.
 */
export default function diffAgainst<K, V, R>(_treeA: BTree<K, V>, _treeB: BTree<K, V>, onlyA?: (k: K, v: V) => {
    break?: R;
} | void, onlyB?: (k: K, v: V) => {
    break?: R;
} | void, different?: (k: K, vThis: V, vOther: V) => {
    break?: R;
} | void): R | undefined;
