import { BNode } from '../b+tree';
export declare function bulkLoad<K, V>(entries: (K | V)[], maxNodeSize: number): BNode<K, V>;
export declare function flushToLeaves<K, V>(alternatingList: (K | V)[], maxNodeSize: number, toFlushTo: (number | BNode<K, V>)[]): number;
