import BTree from '../b+tree';
declare type LowerBound<K> = {
    gt: K;
    gte?: never;
} | {
    gte: K;
    gt?: never;
};
declare type UpperBound<K> = {
    lt: K;
    lte?: never;
} | {
    lte: K;
    lt?: never;
};
declare type OptionalLowerBound<K> = {
    gt?: K;
    gte?: never;
} | {
    gte?: K;
    gt?: never;
};
declare type OptionalUpperBound<K> = {
    lt?: K;
    lte?: never;
} | {
    lte?: K;
    lt?: never;
};
/**
 * A range of keys, described by a lower bound (`gt` or `gte`), an upper bound (`lt` or `lte`), or both.
 * At least one bound is required, and at most one of each kind may be given. A missing (or `undefined`)
 * bound leaves that end of the range open.
 * @example { gte: 5, lt: 10 } // 5 <= key < 10
 * @example { gt: 5 }          // key > 5
 * @example { lte: 10 }        // key <= 10
 */
export declare type KeyRange<K> = (LowerBound<K> & OptionalUpperBound<K>) | (OptionalLowerBound<K> & UpperBound<K>);
/** The key type of a tree. The range's key type is derived from the tree so that it is not inferred from the range. */
declare type KeyOf<TBTree> = TBTree extends BTree<infer K, any> ? K : never;
/**
 * Returns a new tree containing every entry of `tree` except those whose keys fall in the given range.
 * The input tree is not modified.
 *
 * Subtrees that lie entirely outside the range are shared with the input tree rather than copied, and keys
 * inside the range are never visited. Let `H` be the tree height (counting a leaf as height 1) and `B` the
 * max node size. The tree is decomposed into `O(B * H)` disjoint pieces, so the runtime is
 * `O(B^2 * H)`, i.e. `O(log N)` for a fixed max node size, regardless of how many keys are omitted.
 * @param tree The tree to omit keys from.
 * @param range The keys to omit, e.g. `{ gte: 5, lt: 10 }`. Omit a bound to leave that end of the range open.
 * @returns A new tree without the keys in the range.
 * @throws Error if the range has no bounds, or has both `gt` and `gte` or both `lt` and `lte`.
 */
export default function omit<TBTree extends BTree<any, any>>(tree: TBTree, range: KeyRange<KeyOf<TBTree>>): TBTree;
export {};
