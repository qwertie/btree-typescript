import BTree from '../core/index';
import type { AdvancedTreeInternals } from '../internal/treeInternals';
import { diffAgainst as diffAgainstAlgorithm } from '../algorithms';
import { check } from '../internal/assert';

const getInternals = <K, V>(tree: BTree<K, V>): AdvancedTreeInternals<K, V> => {
  return tree as unknown as AdvancedTreeInternals<K, V>;
};

const wrapBaseTree = <K, V>(tree: BTree<K, V>): AdvancedBTree<K, V> => {
  const source = getInternals(tree);
  const wrapped = new AdvancedBTree<K, V>(undefined, source._compare, source._maxNodeSize);
  const target = getInternals(wrapped);
  target._root = source._root;
  target._size = source._size;
  return wrapped;
};

const ensureAdvancedTree = <K, V>(tree: BTree<K, V>): AdvancedBTree<K, V> => {
  check(tree instanceof AdvancedBTree, 'Expected a BTree instance.');
  return tree as AdvancedBTree<K, V>;
};

export class AdvancedBTree<K = any, V = any> extends BTree<K, V> {
  clone(): AdvancedBTree<K, V> {
    return wrapBaseTree(super.clone());
  }

  greedyClone(force?: boolean): AdvancedBTree<K, V> {
    return wrapBaseTree(super.greedyClone(force));
  }

  with(key: K): AdvancedBTree<K, V | undefined>;
  with<V2>(key: K, value: V2, overwrite?: boolean): AdvancedBTree<K, V | V2>;
  with<V2>(key: K, value?: V2, overwrite?: boolean): AdvancedBTree<K, V | V2 | undefined> {
    const result = super.with(key, value as V2, overwrite) as BTree<K, V | V2 | undefined>;
    return result === this
      ? (this as AdvancedBTree<K, V | V2 | undefined>)
      : ensureAdvancedTree(result);
  }

  withPairs<V2>(pairs: [K, V | V2][], overwrite: boolean): AdvancedBTree<K, V | V2> {
    const result = super.withPairs(pairs, overwrite) as BTree<K, V | V2>;
    return result === this ? (this as AdvancedBTree<K, V | V2>) : ensureAdvancedTree(result);
  }

  withKeys(keys: K[], returnThisIfUnchanged?: boolean): AdvancedBTree<K, V | undefined> {
    const result = super.withKeys(keys, returnThisIfUnchanged) as BTree<K, V | undefined>;
    return result === this ? (this as AdvancedBTree<K, V | undefined>) : ensureAdvancedTree(result);
  }

  without(key: K, returnThisIfUnchanged?: boolean): AdvancedBTree<K, V> {
    const result = super.without(key, returnThisIfUnchanged);
    return result === this ? this : ensureAdvancedTree(result);
  }

  withoutKeys(keys: K[], returnThisIfUnchanged?: boolean): AdvancedBTree<K, V> {
    const result = super.withoutKeys(keys, returnThisIfUnchanged);
    return result === this ? this : ensureAdvancedTree(result);
  }

  withoutRange(low: K, high: K, includeHigh: boolean, returnThisIfUnchanged?: boolean): AdvancedBTree<K, V> {
    const result = super.withoutRange(low, high, includeHigh, returnThisIfUnchanged);
    return result === this ? this : ensureAdvancedTree(result);
  }

  filter(callback: (k: K, v: V, counter: number) => boolean, returnThisIfUnchanged?: boolean): AdvancedBTree<K, V> {
    const result = super.filter(callback, returnThisIfUnchanged);
    return result === this ? this : ensureAdvancedTree(result);
  }

  mapValues<R>(callback: (v: V, k: K, counter: number) => R): AdvancedBTree<K, R> {
    const result = super.mapValues(callback) as BTree<K, R>;
    return ensureAdvancedTree(result);
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

export default AdvancedBTree;
