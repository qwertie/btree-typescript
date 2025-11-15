import BTree from '../b+tree';
/**
 * An extended version of the `BTree` class that includes additional functionality
 * such as bulk loading, set operations, and diffing.
 * It is separated to keep the core BTree class small from a bundle size perspective.
 * Note: each additional functionality piece is available as a standalone function from the extended folder.
 * @extends BTree
 */
export declare class BTreeEx<K = any, V = any> extends BTree<K, V> {
    /**
     * Bulk loads a new `BTreeEx` from a sorted alternating list of entries.
     * This reuses the same algorithm as `extended/bulkLoad`, but produces a `BTreeEx`.
     * Time and space complexity are O(n).
     * @param entries Alternating array of keys and values: `[key0, value0, key1, value1, ...]`. Must be sorted by key in strictly ascending order.
     * @param maxNodeSize The branching factor (maximum number of children per node).
     * @param compare Comparator to use. Defaults to the standard comparator if omitted.
     * @returns A fully built tree containing the supplied entries.
     * @throws Error if the entries are not strictly sorted or contain duplicate keys.
     */
    static bulkLoad<K, V>(entries: (K | V)[], maxNodeSize: number, compare?: (a: K, b: K) => number): BTreeEx<K, V>;
    /** See {@link BTree.clone}. */
    clone(): this;
    /** See {@link BTree.greedyClone}. */
    greedyClone(force?: boolean): this;
    /**
     * Computes the differences between `this` and `other`.
     * For efficiency, the diff is returned via invocations of supplied handlers.
     * The computation is optimized for the case in which the two trees have large amounts of shared data
     * (obtained by calling the `clone` or `with` APIs) and will avoid any iteration of shared state.
     * The handlers can cause computation to early exit by returning `{ break: R }`.
     * Neither collection should be mutated during the comparison (inside your callbacks), as this method assumes they remain stable.
     * @param other The tree to compute a diff against.
     * @param onlyThis Callback invoked for all keys only present in `this`.
     * @param onlyOther Callback invoked for all keys only present in `other`.
     * @param different Callback invoked for all keys with differing values.
     * @returns The first `break` payload returned by a handler, or `undefined` if no handler breaks.
     * @throws Error if the supplied trees were created with different comparators.
     */
    diffAgainst<R>(other: BTree<K, V>, onlyThis?: (k: K, v: V) => {
        break?: R;
    } | void, onlyOther?: (k: K, v: V) => {
        break?: R;
    } | void, different?: (k: K, vThis: V, vOther: V) => {
        break?: R;
    } | void): R | undefined;
    /**
     * Calls the supplied `callback` for each key/value pair shared by this tree and `other`, in sorted key order.
     * Neither tree is modified.
     *
     * Complexity is O(N + M) when the trees overlap heavily, and additionally bounded by O(log(N + M) * D)
     * where `D` is the number of disjoint key ranges between the trees, because disjoint subtrees are skipped.
     * In practice, that means for keys of random distribution the performance is linear and for keys with significant
     * numbers of non-overlapping key ranges it is much faster.
     * @param other The other tree to compare with this one.
     * @param callback Called for keys that appear in both trees. It can cause iteration to early exit by returning `{ break: R }`.
     * @returns The first `break` payload returned by the callback, or `undefined` if the walk finishes.
     * @throws Error if the two trees were created with different comparators.
     */
    forEachKeyInBoth<R = void>(other: BTree<K, V>, callback: (key: K, leftValue: V, rightValue: V) => {
        break?: R;
    } | void): R | undefined;
    /**
     * Calls the supplied `callback` for each key/value pair that exists in this tree but not in `other`
     * (set subtraction). The callback runs in sorted key order and neither tree is modified.
     *
     * Complexity is O(N + M) when the key ranges overlap heavily, and additionally bounded by O(log(N + M) * D)
     * where `D` is the number of disjoint ranges between the trees, because non-overlapping subtrees are skipped.
     * In practice, that means for keys of random distribution the performance is linear and for keys with significant
     * numbers of non-overlapping key ranges it is much faster.
     * @param other Keys present in this tree will be omitted from the callback.
     * @param callback Invoked for keys unique to `this`. It can cause iteration to early exit by returning `{ break: R }`.
     * @returns The first `break` payload returned by the callback, or `undefined` if all qualifying keys are visited.
     * @throws Error if the trees were created with different comparators.
     */
    forEachKeyNotIn<R = void>(other: BTree<K, V>, callback: (key: K, value: V) => {
        break?: R;
    } | void): R | undefined;
    /**
     * Returns a new tree containing only keys present in both trees.
     * Neither tree is modified.
     *
     * Complexity is O(N + M) in the fully overlapping case and additionally bounded by O(log(N + M) * D),
     * where `D` is the number of disjoint key ranges, because disjoint subtrees are skipped entirely.
     * In practice, that means for keys of random distribution the performance is linear and for keys with significant
     * numbers of non-overlapping key ranges it is much faster.
     * @param other The other tree to intersect with this one.
     * @param combineFn Called for keys that appear in both trees. Return the desired value.
     * @returns A new `BTreeEx` populated with the intersection.
     * @throws Error if the trees were created with different comparators.
     */
    intersect(other: BTreeEx<K, V>, combineFn: (key: K, leftValue: V, rightValue: V) => V): BTreeEx<K, V>;
    /**
     * Efficiently unions this tree with `other`, reusing subtrees wherever possible without modifying either input.
     *
     * Complexity is O(N + M) in the fully overlapping case, and additionally bounded by O(log(N + M) * D)
     * where `D` is the number of disjoint key ranges, because disjoint subtrees are skipped entirely.
     * In practice, that means for keys of random distribution the performance is linear and for keys with significant
     * numbers of non-overlapping key ranges it is much faster.
     * @param other The other tree to union with this one.
     * @param combineFn Called for keys that appear in both trees. Return the desired value, or `undefined` to omit the key.
     * @returns A new `BTreeEx` that contains the unioned key/value pairs.
     * @throws Error if the trees were created with different comparators or max node sizes.
     */
    union(other: BTreeEx<K, V>, combineFn: (key: K, leftValue: V, rightValue: V) => V | undefined): BTreeEx<K, V>;
    /**
     * Returns a new tree containing only the keys that are present in this tree but not `other` (set subtraction).
     * Neither input tree is modified.
     *
     * Complexity is O(N + M) for time and O(N) for allocations in the worst case. Additionally, time is bounded by
     * O(log(N + M) * D1) and space by O(log N * D2) where `D1` is the number of disjoint key ranges between the trees
     * and `D2` is the number of disjoint ranges inside this tree.
     * In practice, that means for keys of random distribution the performance is linear and for keys with significant
     * numbers of non-overlapping key ranges it is much faster.
     * @param other The tree whose keys will be removed from the result.
     * @returns A new `BTreeEx` representing `this \ other`.
     * @throws Error if the trees were created with different comparators or max node sizes.
     */
    subtract(other: BTreeEx<K, V>): BTreeEx<K, V>;
}
export interface BTreeEx<K = any, V = any> {
    /** See {@link BTree.with}. */
    with(key: K): BTreeEx<K, V | undefined>;
    with<V2>(key: K, value: V2, overwrite?: boolean): BTreeEx<K, V | V2>;
    with<V2>(key: K, value?: V2, overwrite?: boolean): BTreeEx<K, V | V2 | undefined>;
    /** See {@link BTree.withPairs}. */
    withPairs<V2>(pairs: [K, V | V2][], overwrite: boolean): BTreeEx<K, V | V2>;
    /** See {@link BTree.withKeys}. */
    withKeys(keys: K[], returnThisIfUnchanged?: boolean): BTreeEx<K, V | undefined>;
    /** See {@link BTree.mapValues}. */
    mapValues<R>(callback: (v: V, k: K, counter: number) => R): BTreeEx<K, R>;
}
export default BTreeEx;
