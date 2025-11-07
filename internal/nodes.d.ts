import type { EditRangeResult } from '../core/types';
declare type index = number;
/** Leaf node / base class. **************************************************/
export declare class BNode<K, V> {
    keys: K[];
    values: V[];
    isShared: true | undefined;
    get isLeaf(): boolean;
    constructor(keys?: K[], values?: V[]);
    maxKey(): K;
    indexOf(key: K, failXor: number, cmp: (a: K, b: K) => number): index;
    minKey(): K | undefined;
    minPair(reusedArray: [K, V]): [K, V] | undefined;
    maxPair(reusedArray: [K, V]): [K, V] | undefined;
    clone(): BNode<K, V>;
    greedyClone(force?: boolean): BNode<K, V>;
    get(key: K, defaultValue: V | undefined, tree: BTreeNodeHost<K, V>): V | undefined;
    getPairOrNextLower(key: K, compare: (a: K, b: K) => number, inclusive: boolean, reusedArray: [K, V]): [K, V] | undefined;
    getPairOrNextHigher(key: K, compare: (a: K, b: K) => number, inclusive: boolean, reusedArray: [K, V]): [K, V] | undefined;
    checkValid(depth: number, tree: BTreeNodeHost<K, V>, baseIndex: number): number;
    set(key: K, value: V, overwrite: boolean | undefined, tree: BTreeNodeHost<K, V>): boolean | BNode<K, V>;
    reifyValues(): V[];
    insertInLeaf(i: index, key: K, value: V, tree: BTreeNodeHost<K, V>): boolean;
    takeFromRight(rhs: BNode<K, V>): void;
    takeFromLeft(lhs: BNode<K, V>): void;
    splitOffRightSide(): BNode<K, V>;
    forRange<R>(low: K, high: K, includeHigh: boolean | undefined, editMode: boolean, tree: BTreeNodeHost<K, V>, count: number, onFound?: (k: K, v: V, counter: number) => EditRangeResult<V, R> | void): EditRangeResult<V, R> | number;
    /** Adds entire contents of right-hand sibling (rhs is left unchanged) */
    mergeSibling(rhs: BNode<K, V>, _: number): void;
}
/** Internal node (non-leaf node) ********************************************/
export declare class BNodeInternal<K, V> extends BNode<K, V> {
    children: BNode<K, V>[];
    /**
     * This does not mark `children` as shared, so it is the responsibility of the caller
     * to ensure children are either marked shared, or aren't included in another tree.
     */
    constructor(children: BNode<K, V>[], keys?: K[]);
    clone(): BNode<K, V>;
    greedyClone(force?: boolean): BNode<K, V>;
    minKey(): K | undefined;
    minPair(reusedArray: [K, V]): [K, V] | undefined;
    maxPair(reusedArray: [K, V]): [K, V] | undefined;
    get(key: K, defaultValue: V | undefined, tree: BTreeNodeHost<K, V>): V | undefined;
    getPairOrNextLower(key: K, compare: (a: K, b: K) => number, inclusive: boolean, reusedArray: [K, V]): [K, V] | undefined;
    getPairOrNextHigher(key: K, compare: (a: K, b: K) => number, inclusive: boolean, reusedArray: [K, V]): [K, V] | undefined;
    checkValid(depth: number, tree: BTreeNodeHost<K, V>, baseIndex: number): number;
    set(key: K, value: V, overwrite: boolean | undefined, tree: BTreeNodeHost<K, V>): boolean | BNodeInternal<K, V>;
    /**
     * Inserts `child` at index `i`.
     * This does not mark `child` as shared, so it is the responsibility of the caller
     * to ensure that either child is marked shared, or it is not included in another tree.
     */
    insert(i: index, child: BNode<K, V>): void;
    /**
     * Split this node.
     * Modifies this to remove the second half of the items, returning a separate node containing them.
     */
    splitOffRightSide(): BNodeInternal<K, V>;
    takeFromRight(rhs: BNode<K, V>): void;
    takeFromLeft(lhs: BNode<K, V>): void;
    forRange<R>(low: K, high: K, includeHigh: boolean | undefined, editMode: boolean, tree: BTreeNodeHost<K, V>, count: number, onFound?: (k: K, v: V, counter: number) => EditRangeResult<V, R> | void): EditRangeResult<V, R> | number;
    /** Merges child i with child i+1 if their combined size is not too large */
    tryMerge(i: index, maxSize: number): boolean;
    /**
     * Move children from `rhs` into this.
     * `rhs` must be part of this tree, and be removed from it after this call
     * (otherwise isShared for its children could be incorrect).
     */
    mergeSibling(rhs: BNode<K, V>, maxNodeSize: number): void;
}
export declare const EmptyLeaf: BNode<any, any>;
export {};
