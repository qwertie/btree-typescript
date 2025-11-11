import type { BNode } from '../b+tree';

export type ExtendedTreeInternals<K, V> = {
  _root: BNode<K, V>;
  _size: number;
  _maxNodeSize: number;
  _compare: (a: K, b: K) => number;
};
