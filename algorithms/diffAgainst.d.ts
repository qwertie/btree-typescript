import BTree from '../core/index';
export declare function diffAgainst<K, V, R>(treeThis: BTree<K, V>, treeOther: BTree<K, V>, onlyThis?: (k: K, v: V) => {
    break?: R;
} | void, onlyOther?: (k: K, v: V) => {
    break?: R;
} | void, different?: (k: K, vThis: V, vOther: V) => {
    break?: R;
} | void): R | undefined;
