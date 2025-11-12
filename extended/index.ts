import BTree, { defaultComparator } from '../b+tree';
import type { BTreeWithInternals } from './shared';
import diffAgainst from './diffAgainst';
import forEachKeyInBoth from './forEachKeyInBoth';
import union from './union';
import { bulkLoadRoot } from './bulkLoad';

/**
 * An extended version of the `BTree` class that includes additional functionality
 * such as bulk loading, set operations, and diffing.
 * It is separated to keep the core BTree class small from a bundle size perspective.
 * Note: each additional functionality piece is available as a standalone function from the extended folder.
 * @extends BTree
 */
export class BTreeEx<K = any, V = any> extends BTree<K, V> {
  static bulkLoad<K, V>(
    entries: (K | V)[],
    maxNodeSize: number,
    compare?: (a: K, b: K) => number
  ): BTreeEx<K, V> {
    const cmp = compare ?? (defaultComparator as unknown as (a: K, b: K) => number);
    const root = bulkLoadRoot<K, V>(entries, maxNodeSize, cmp);
    const tree = new BTreeEx<K, V>(undefined, cmp, maxNodeSize);
    const target = tree as unknown as BTreeWithInternals<K, V>;
    target._root = root;
    target._size = root.size();
    return tree;
  }

  clone(): this {
    const source = this as unknown as BTreeWithInternals<K, V>;
    source._root.isShared = true;
    const result = new BTreeEx<K, V>(undefined, this._compare, this._maxNodeSize);
    const target = result as unknown as BTreeWithInternals<K, V>;
    target._root = source._root;
    target._size = source._size;
    return result as this;
  }

  greedyClone(force?: boolean): this {
    const source = this as unknown as BTreeWithInternals<K, V>;
    const result = new BTreeEx<K, V>(undefined, this._compare, this._maxNodeSize);
    const target = result as unknown as BTreeWithInternals<K, V>;
    target._root = source._root.greedyClone(force);
    target._size = source._size;
    return result as this;
  }

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
   */
  diffAgainst<R>(
    other: BTree<K, V>,
    onlyThis?: (k: K, v: V) => { break?: R } | void,
    onlyOther?: (k: K, v: V) => { break?: R } | void,
    different?: (k: K, vThis: V, vOther: V) => { break?: R } | void
  ): R | undefined {
    return diffAgainst(this, other, onlyThis, onlyOther, different);
  }

  /**
   * Calls the supplied `callback` for each key/value pair shared by this tree and `other`.
   * Neither tree is modified.
   * @param other The other tree to compare with this one.
   * @param callback Called for keys that appear in both trees.
   * @description Complexity is bounded by O(N + M) time.
   * However, time is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
   * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
   * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
   * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
   * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than calling `toArray`
   * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
   */
  forEachKeyInBoth(other: BTree<K, V>, callback: (key: K, leftValue: V, rightValue: V) => void): void {
    forEachKeyInBoth(this, other, callback);
  }

  /**
   * Efficiently unions this tree with `other`, reusing subtrees wherever possible.
   * Neither input tree is modified.
   * @param other The other tree to union with this one.
   * @param combineFn Called for keys that appear in both trees. Return the desired value, or
   *        `undefined` to omit the key from the result.
   * @returns A new BTree that contains the unioned key/value pairs.
   * @description Complexity is bounded by O(N + M) for both time and allocations.
   * However, it is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
   * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
   * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
   * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
   * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than cloning `this`
   * and inserting the contents of `other` into the clone.
   */
  union(other: BTreeEx<K, V>, combineFn: (key: K, leftValue: V, rightValue: V) => V | undefined): BTreeEx<K, V> {
    return union<BTreeEx<K, V>, K, V>(this, other, combineFn);
  }
}

export interface BTreeEx<K = any, V = any> {
  with(key: K): BTreeEx<K, V | undefined>;
  with<V2>(key: K, value: V2, overwrite?: boolean): BTreeEx<K, V | V2>;
  with<V2>(key: K, value?: V2, overwrite?: boolean): BTreeEx<K, V | V2 | undefined>;
  withPairs<V2>(pairs: [K, V | V2][], overwrite: boolean): BTreeEx<K, V | V2>;
  withKeys(keys: K[], returnThisIfUnchanged?: boolean): BTreeEx<K, V | undefined>;
  mapValues<R>(callback: (v: V, k: K, counter: number) => R): BTreeEx<K, R>;
}

export default BTreeEx;
