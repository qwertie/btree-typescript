import type { BNode } from '../b+tree';
import BTree from '../b+tree';
export declare type BTreeWithInternals<K, V> = {
    _root: BNode<K, V>;
    _size: number;
    _maxNodeSize: number;
    _compare: (a: K, b: K) => number;
} & Omit<BTree<K, V>, '_root' | '_size' | '_maxNodeSize' | '_compare'>;
export declare function alternatingCount(list: unknown[]): number;
export declare function alternatingGetFirst<TFirst, TSecond>(list: Array<TFirst | TSecond>, index: number): TFirst;
export declare function alternatingGetSecond<TFirst, TSecond>(list: Array<TFirst | TSecond>, index: number): TSecond;
export declare function alternatingPush<TFirst, TSecond>(list: Array<TFirst | TSecond>, first: TFirst, second: TSecond): void;
