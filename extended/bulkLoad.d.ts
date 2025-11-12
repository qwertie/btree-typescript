import BTree, { BNode } from '../b+tree';
declare type Comparator<K> = (a: K, b: K) => number;
export declare function bulkLoad<K, V>(entries: (K | V)[], maxNodeSize: number, compare: Comparator<K>): BTree<K, V>;
export declare function bulkLoadRoot<K, V>(entries: (K | V)[], maxNodeSize: number, compare: Comparator<K>): BNode<K, V>;
export {};
