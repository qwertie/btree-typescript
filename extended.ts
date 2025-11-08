import BTree from './b+tree';
import type { ExtendedTreeInternals } from './diffAgainst';
import { diffAgainst as diffAgainstAlgorithm } from './diffAgainst';

export class BTreeEx<K = any, V = any> extends BTree<K, V> {
  clone(): BTreeEx<K, V> {
    const source = this as unknown as ExtendedTreeInternals<K, V>;
    source._root.isShared = true;
    const result = new BTreeEx<K, V>(undefined, this._compare, this._maxNodeSize);
    const target = result as unknown as ExtendedTreeInternals<K, V>;
    target._root = source._root;
    target._size = source._size;
    return result;
  }

  greedyClone(force?: boolean): BTreeEx<K, V> {
    const source = this as unknown as ExtendedTreeInternals<K, V>;
    const result = new BTreeEx<K, V>(undefined, this._compare, this._maxNodeSize);
    const target = result as unknown as ExtendedTreeInternals<K, V>;
    target._root = source._root.greedyClone(force);
    target._size = source._size;
    return result;
  }

  with(key: K): BTreeEx<K, V | undefined>;
  with<V2>(key: K, value: V2, overwrite?: boolean): BTreeEx<K, V | V2>;
  with<V2>(key: K, value?: V2, overwrite?: boolean): BTreeEx<K, V | V2 | undefined> {
    return super.with(key, value as V2, overwrite) as BTreeEx<K, V | V2 | undefined>;
  }

  withPairs<V2>(pairs: [K, V | V2][], overwrite: boolean): BTreeEx<K, V | V2> {
    return super.withPairs(pairs, overwrite) as BTreeEx<K, V | V2>;
  }

  withKeys(keys: K[], returnThisIfUnchanged?: boolean): BTreeEx<K, V | undefined> {
    return super.withKeys(keys, returnThisIfUnchanged) as BTreeEx<K, V | undefined>;
  }

  without(key: K, returnThisIfUnchanged?: boolean): BTreeEx<K, V> {
    return super.without(key, returnThisIfUnchanged) as BTreeEx<K, V>;
  }

  withoutKeys(keys: K[], returnThisIfUnchanged?: boolean): BTreeEx<K, V> {
    return super.withoutKeys(keys, returnThisIfUnchanged) as BTreeEx<K, V>;
  }

  withoutRange(low: K, high: K, includeHigh: boolean, returnThisIfUnchanged?: boolean): BTreeEx<K, V> {
    return super.withoutRange(low, high, includeHigh, returnThisIfUnchanged) as BTreeEx<K, V>;
  }

  filter(callback: (k: K, v: V, counter: number) => boolean, returnThisIfUnchanged?: boolean): BTreeEx<K, V> {
    return super.filter(callback, returnThisIfUnchanged) as BTreeEx<K, V>;
  }

  mapValues<R>(callback: (v: V, k: K, counter: number) => R): BTreeEx<K, R> {
    return super.mapValues(callback) as BTreeEx<K, R>;
  }

  diffAgainst<R>(
    other: BTree<K, V>,
    onlyThis?: (k: K, v: V) => { break?: R } | void,
    onlyOther?: (k: K, v: V) => { break?: R } | void,
    different?: (k: K, vThis: V, vOther: V) => { break?: R } | void
  ): R | undefined {
    return diffAgainstAlgorithm(this, other, onlyThis, onlyOther, different);
  }
}

export default BTreeEx;
