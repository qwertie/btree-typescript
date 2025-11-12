import BTree from '../b+tree';
export declare function bulkLoad<K, V>(entries: (K | V)[], maxNodeSize: number, compare?: (a: K, b: K) => number): BTree<K, V>;
