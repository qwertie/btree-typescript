import BTree from '../core/index';
import type { ExtendedTreeInternals } from '../internal/treeInternals';
import { diffAgainst as diffAgainstAlgorithm } from '../algorithms';
import { check } from '../internal/assert';

const getInternals = <K, V>(tree: BTree<K, V>): ExtendedTreeInternals<K, V> => {
  return tree as unknown as ExtendedTreeInternals<K, V>;
};

const wrapBaseTree = <K, V>(tree: BTree<K, V>): BTreeEx<K, V> => {
  const source = getInternals(tree);
  const wrapped = new BTreeEx<K, V>(undefined, source._compare, source._maxNodeSize);
  const target = getInternals(wrapped);
  target._root = source._root;
  target._size = source._size;
  return wrapped;
};

const ensureExtendedTree = <K, V>(tree: BTree<K, V>): BTreeEx<K, V> => {
  check(tree instanceof BTreeEx, 'Expected a BTree instance.');
  return tree as BTreeEx<K, V>;
};

export class BTreeEx<K = any, V = any> extends BTree<K, V> {
  clone(): BTreeEx<K, V> {
    return wrapBaseTree(super.clone());
  }

  greedyClone(force?: boolean): BTreeEx<K, V> {
    return wrapBaseTree(super.greedyClone(force));
  }

  with(key: K): BTreeEx<K, V | undefined>;
  with<V2>(key: K, value: V2, overwrite?: boolean): BTreeEx<K, V | V2>;
  with<V2>(key: K, value?: V2, overwrite?: boolean): BTreeEx<K, V | V2 | undefined> {
    const result = super.with(key, value as V2, overwrite) as BTree<K, V | V2 | undefined>;
    return result === this
      ? (this as BTreeEx<K, V | V2 | undefined>)
      : ensureExtendedTree(result);
  }

  withPairs<V2>(pairs: [K, V | V2][], overwrite: boolean): BTreeEx<K, V | V2> {
    const result = super.withPairs(pairs, overwrite) as BTree<K, V | V2>;
    return result === this ? (this as BTreeEx<K, V | V2>) : ensureExtendedTree(result);
  }

  withKeys(keys: K[], returnThisIfUnchanged?: boolean): BTreeEx<K, V | undefined> {
    const result = super.withKeys(keys, returnThisIfUnchanged) as BTree<K, V | undefined>;
    return result === this ? (this as BTreeEx<K, V | undefined>) : ensureExtendedTree(result);
  }

  without(key: K, returnThisIfUnchanged?: boolean): BTreeEx<K, V> {
    const result = super.without(key, returnThisIfUnchanged);
    return result === this ? this : ensureExtendedTree(result);
  }

  withoutKeys(keys: K[], returnThisIfUnchanged?: boolean): BTreeEx<K, V> {
    const result = super.withoutKeys(keys, returnThisIfUnchanged);
    return result === this ? this : ensureExtendedTree(result);
  }

  withoutRange(low: K, high: K, includeHigh: boolean, returnThisIfUnchanged?: boolean): BTreeEx<K, V> {
    const result = super.withoutRange(low, high, includeHigh, returnThisIfUnchanged);
    return result === this ? this : ensureExtendedTree(result);
  }

  filter(callback: (k: K, v: V, counter: number) => boolean, returnThisIfUnchanged?: boolean): BTreeEx<K, V> {
    const result = super.filter(callback, returnThisIfUnchanged);
    return result === this ? this : ensureExtendedTree(result);
  }

  mapValues<R>(callback: (v: V, k: K, counter: number) => R): BTreeEx<K, R> {
    const result = super.mapValues(callback) as BTree<K, R>;
    return ensureExtendedTree(result);
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
