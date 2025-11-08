import BTree from './b+tree';
import { BNode } from './b+tree';
export declare type ExtendedTreeInternals<K, V> = {
    _root: BNode<K, V>;
    _size: number;
    _maxNodeSize: number;
    _compare: (a: K, b: K) => number;
};
export declare function diffAgainst<K, V, R>(treeThis: BTree<K, V>, treeOther: BTree<K, V>, onlyThis?: (k: K, v: V) => {
    break?: R;
} | void, onlyOther?: (k: K, v: V) => {
    break?: R;
} | void, different?: (k: K, vThis: V, vOther: V) => {
    break?: R;
} | void): R | undefined;
export default diffAgainst;
