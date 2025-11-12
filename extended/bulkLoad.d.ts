import { BNode } from '../b+tree';
export declare function bulkLoad<K, V>(entries: (K | V)[], maxNodeSize: number): BNode<K, V> | undefined;
export declare function flushToLeaves<K, V>(alternatingList: (K | V)[], maxNodeSize: number, onLeafCreation: (node: BNode<K, V>) => void): number;
