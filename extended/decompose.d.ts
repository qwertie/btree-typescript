import BTree, { BNode } from '../b+tree';
import type { BTreeWithInternals } from './shared';
export declare type DecomposeResult<K, V> = {
    disjoint: (number | BNode<K, V>)[];
    tallestIndex: number;
};
/**
 * Decomposes two trees into disjoint nodes. Reuses interior nodes when they do not overlap/intersect with any leaf nodes
 * in the other tree. Overlapping leaf nodes are broken down into new leaf nodes containing merged entries.
 * The algorithm is a parallel tree walk using two cursors. The trailing cursor (behind in key space) is walked forward
 * until it is at or after the leading cursor. As it does this, any whole nodes or subtrees it passes are guaranteed to
 * be disjoint. This is true because the leading cursor was also previously walked in this way, and is thus pointing to
 * the first key at or after the trailing cursor's previous position.
 * The cursor walk is efficient, meaning it skips over disjoint subtrees entirely rather than visiting every leaf.
 */
export declare function decompose<K, V>(left: BTreeWithInternals<K, V>, right: BTreeWithInternals<K, V>, mergeValues: (key: K, leftValue: V, rightValue: V) => V | undefined, ignoreRight?: boolean): DecomposeResult<K, V>;
export declare function buildFromDecomposition<TBTree extends BTree<K, V>, K, V>(constructor: new (entries?: [K, V][], compare?: (a: K, b: K) => number, maxNodeSize?: number) => TBTree, branchingFactor: number, decomposed: DecomposeResult<K, V>, cmp: (a: K, b: K) => number, maxNodeSize: number): TBTree;
export declare function alternatingCount(list: unknown[]): number;
export declare function alternatingGetFirst<TFirst, TSecond>(list: Array<TFirst | TSecond>, index: number): TFirst;
export declare function alternatingGetSecond<TFirst, TSecond>(list: Array<TFirst | TSecond>, index: number): TSecond;
export declare function alternatingPush<TFirst, TSecond>(list: Array<TFirst | TSecond>, first: TFirst, second: TSecond): void;
