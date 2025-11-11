import BTree from '../b+tree';
import type { ExtendedTreeInternals } from './shared';
import { diffAgainst as diffAgainstAlgorithm } from './diffAgainst';

export class BTreeEx<K = any, V = any> extends BTree<K, V> {
  clone(): this {
    const source = this as unknown as ExtendedTreeInternals<K, V>;
    source._root.isShared = true;
    const result = new BTreeEx<K, V>(undefined, this._compare, this._maxNodeSize);
    const target = result as unknown as ExtendedTreeInternals<K, V>;
    target._root = source._root;
    target._size = source._size;
    return result as this;
  }

  greedyClone(force?: boolean): this {
    const source = this as unknown as ExtendedTreeInternals<K, V>;
    const result = new BTreeEx<K, V>(undefined, this._compare, this._maxNodeSize);
    const target = result as unknown as ExtendedTreeInternals<K, V>;
    target._root = source._root.greedyClone(force);
    target._size = source._size;
    return result as this;
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

export interface BTreeEx<K = any, V = any> {
  with(key: K): BTreeEx<K, V | undefined>;
  with<V2>(key: K, value: V2, overwrite?: boolean): BTreeEx<K, V | V2>;
  with<V2>(key: K, value?: V2, overwrite?: boolean): BTreeEx<K, V | V2 | undefined>;
  withPairs<V2>(pairs: [K, V | V2][], overwrite: boolean): BTreeEx<K, V | V2>;
  withKeys(keys: K[], returnThisIfUnchanged?: boolean): BTreeEx<K, V | undefined>;
  mapValues<R>(callback: (v: V, k: K, counter: number) => R): BTreeEx<K, R>;
}

export default BTreeEx;
