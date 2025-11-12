import { BNode } from '../b+tree';
import BTree from '../b+tree';

/**
 * BTree with access to internal properties.
 * @internal
 */
export type BTreeWithInternals<K, V> = {
  _root: BNode<K, V>;
  _size: number;
  _maxNodeSize: number;
  _compare: (a: K, b: K) => number;
} & Omit<BTree<K, V>, '_root' | '_size' | '_maxNodeSize' | '_compare'>;

/**
 * Flushes entries from an alternating list into leaf nodes.
 * The leaf nodes are packed as tightly as possible while ensuring all
 * nodes are at least 50% full (if more than one leaf is created).
 * @internal
 */
export function flushToLeaves<K, V>(
  alternatingList: (K | V)[],
  maxNodeSize: number,
  onLeafCreation: (node: BNode<K, V>) => void
): number {
  const totalPairs = alternatingCount(alternatingList);
  if (totalPairs === 0)
    return 0;

  // This method creates as many evenly filled leaves as possible from
  // the pending entries. All will be > 50% full if we are creating more than one leaf.
  const leafCount = Math.ceil(totalPairs / maxNodeSize);
  let remainingLeaves = leafCount;
  let remaining = totalPairs;
  let pairIndex = 0;
  while (remainingLeaves > 0) {
    const chunkSize = Math.ceil(remaining / remainingLeaves);
    const keys = new Array<K>(chunkSize);
    const vals = new Array<V>(chunkSize);
    for (let i = 0; i < chunkSize; i++) {
      keys[i] = alternatingGetFirst<K, V>(alternatingList, pairIndex);
      vals[i] = alternatingGetSecond<K, V>(alternatingList, pairIndex);
      pairIndex++;
    }
    remaining -= chunkSize;
    remainingLeaves--;
    const leaf = new BNode<K, V>(keys, vals);
    onLeafCreation(leaf);
  }
  alternatingList.length = 0;
  return leafCount;
};

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