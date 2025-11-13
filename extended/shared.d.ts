import BTree from '../b+tree';
export declare type BTreeConstructor<TBTree extends BTree<K, V>, K, V> = new (entries?: [K, V][], compare?: (a: K, b: K) => number, maxNodeSize?: number) => BTreeWithInternals<K, V, TBTree>;
