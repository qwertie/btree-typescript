import BTree from '../core/index';
import type { AdvancedTreeInternals } from '../internal/treeInternals';
import { diffAgainst as diffAgainstAlgorithm } from '../algorithms';

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

export class AdvancedBTree<K = any, V = any> extends BTree<K, V> {
  clone(): AdvancedBTree<K, V> {
    return wrapBaseTree(super.clone());
  }

  greedyClone(force?: boolean): AdvancedBTree<K, V> {
    return wrapBaseTree(super.greedyClone(force));
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
