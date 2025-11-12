import { BNode, BNodeInternal } from '../b+tree';
import type { BTreeWithInternals } from './shared';
export declare type MergeCursorPayload = {
    disqualified: boolean;
};
export interface MergeCursor<K, V, TPayload> {
    tree: BTreeWithInternals<K, V>;
    leaf: BNode<K, V>;
    leafIndex: number;
    spine: Array<{
        node: BNodeInternal<K, V>;
        childIndex: number;
        payload: TPayload;
    }>;
    leafPayload: TPayload;
    makePayload: () => TPayload;
    onMoveInLeaf: (leaf: BNode<K, V>, payload: TPayload, fromIndex: number, toIndex: number, isInclusive: boolean) => void;
    onExitLeaf: (leaf: BNode<K, V>, payload: TPayload, startingIndex: number, isInclusive: boolean, cursorThis: MergeCursor<K, V, TPayload>) => void;
    onStepUp: (parent: BNodeInternal<K, V>, height: number, payload: TPayload, fromIndex: number, spineIndex: number, stepDownIndex: number, cursorThis: MergeCursor<K, V, TPayload>) => void;
    onStepDown: (node: BNodeInternal<K, V>, height: number, spineIndex: number, stepDownIndex: number, cursorThis: MergeCursor<K, V, TPayload>) => void;
    onEnterLeaf: (leaf: BNode<K, V>, destIndex: number, cursorThis: MergeCursor<K, V, TPayload>, cursorOther: MergeCursor<K, V, TPayload>) => void;
}
/**
 * Walks the cursor forward by one key.
 * Should only be called to advance cursors that started equal.
 * Returns true if end-of-tree was reached (cursor not structurally mutated).
 */
export declare function moveForwardOne<K, V, TP>(cur: MergeCursor<K, V, TP>, other: MergeCursor<K, V, TP>, currentKey: K, cmp: (a: K, b: K) => number): boolean;
/**
 * Create a cursor pointing to the leftmost key of the supplied tree.
 */
export declare function createCursor<K, V, TP>(tree: BTreeWithInternals<K, V>, makePayload: MergeCursor<K, V, TP>["makePayload"], onEnterLeaf: MergeCursor<K, V, TP>["onEnterLeaf"], onMoveInLeaf: MergeCursor<K, V, TP>["onMoveInLeaf"], onExitLeaf: MergeCursor<K, V, TP>["onExitLeaf"], onStepUp: MergeCursor<K, V, TP>["onStepUp"], onStepDown: MergeCursor<K, V, TP>["onStepDown"]): MergeCursor<K, V, TP>;
export declare function getKey<K, V, TP>(c: MergeCursor<K, V, TP>): K;
/**
 * Move cursor strictly forward to the first key >= (inclusive) or > (exclusive) target.
 * Returns a boolean indicating if end-of-tree was reached (cursor not structurally mutated).
 * Also returns a boolean indicating if the target key was landed on exactly.
 */
export declare function moveTo<K, V, TP>(cur: MergeCursor<K, V, TP>, other: MergeCursor<K, V, TP>, targetKey: K, isInclusive: boolean, startedEqual: boolean, cmp: (a: K, b: K) => number): [outOfTree: boolean, targetExactlyReached: boolean];
export declare function noop(): void;
export declare const comparatorErrorMsg = "Cannot perform set operations on BTrees with different comparators.";
export declare const branchingFactorErrorMsg = "Cannot perform set operations on BTrees with different max node sizes.";
export declare function checkCanDoSetOperation<K, V>(treeA: BTreeWithInternals<K, V>, treeB: BTreeWithInternals<K, V>): number;
