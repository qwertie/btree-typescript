import type { BNode } from '../b+tree';
import BTree from '../b+tree';

export type BTreeWithInternals<K, V> = {
  _root: BNode<K, V>;
  _size: number;
  _maxNodeSize: number;
  _compare: (a: K, b: K) => number;
} & Omit<BTree<K, V>, '_root' | '_size' | '_maxNodeSize' | '_compare'>;

// ------- Alternating list helpers -------
// These helpers manage a list that alternates between two types of entries.
// Storing data this way avoids small tuple allocations and shows major improvements
// in GC time in benchmarks.

export function alternatingCount(list: unknown[]): number {
  return list.length >> 1;
}

export function alternatingGetFirst<TFirst, TSecond>(list: Array<TFirst | TSecond>, index: number): TFirst {
  return list[index << 1] as TFirst;
}

export function alternatingGetSecond<TFirst, TSecond>(list: Array<TFirst | TSecond>, index: number): TSecond {
  return list[(index << 1) + 1] as TSecond;
}

export function alternatingPush<TFirst, TSecond>(list: Array<TFirst | TSecond>, first: TFirst, second: TSecond): void {
  // Micro benchmarks show this is the fastest way to do this
  list.push(first, second);
}