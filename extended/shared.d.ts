import type { BNode } from '../b+tree';
import BTree from '../b+tree';
export declare type BTreeWithInternals<K, V> = {
    _root: BNode<K, V>;
    _size: number;
    _maxNodeSize: number;
    _compare: (a: K, b: K) => number;
} & Omit<BTree<K, V>, '_root' | '_size' | '_maxNodeSize' | '_compare'>;
