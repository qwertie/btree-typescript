import BTree from '../b+tree';
import type { BTreeWithInternals } from './shared';
import { diffAgainst as diffAgainstAlgorithm } from './diffAgainst';
import { intersect } from './intersect';
import merge from './merge';

export class BTreeEx<K = any, V = any> extends BTree<K, V> {
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
    return diffAgainstAlgorithm(this, other, onlyThis, onlyOther, different);
  }

  /**
   * Intersects this tree with `other`, calling the supplied `intersection` callback for each intersecting key/value pair.
   * Neither tree is modified.
   * @param other The other tree to intersect with this one.
   * @param intersection Called for keys that appear in both trees.
   * @description Complexity is bounded O(N + M) time and O(log(N + M)) for allocations.
   * However, time is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
   * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
   * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
   * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
   * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than calling `toArray`
   * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
   */
  intersect(other: BTree<K,V>, intersection: (key: K, leftValue: V, rightValue: V) => void): void {
    intersect(this, other, intersection);
  }

  /**
   * Efficiently merges this tree with `other`, reusing subtrees wherever possible.
   * Neither input tree is modified.
   * @param other The other tree to merge into this one.
   * @param merge Called for keys that appear in both trees. Return the desired value, or
   *        `undefined` to omit the key from the result.
   * @returns A new BTree that contains the merged key/value pairs.
   * @description Complexity is bounded O(N + M) for both time and allocations.
   * However, it is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
   * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
   * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
   * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
   * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than cloning `this`
   * and inserting the contents of `other` into the clone.
   */
  merge(other: BTreeEx<K,V>, mergeFn: (key: K, leftValue: V, rightValue: V) => V | undefined): BTreeEx<K,V> {
    return merge<BTreeEx<K,V>, K, V>(this, other, mergeFn);
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
