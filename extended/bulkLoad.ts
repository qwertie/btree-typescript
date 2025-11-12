import { BNode, BNodeInternal } from '../b+tree';
import { alternatingCount, alternatingGetFirst, alternatingGetSecond, alternatingPush } from './decompose';
import type { BTreeWithInternals } from './shared';

export function bulkLoad<K, V>(entries: (K | V)[], maxNodeSize: number): BNode<K, V> | undefined {
  const leaves: (number | BNode<K, V>)[] = [];
  flushToLeaves(entries, maxNodeSize, leaves);
  const leafCount = alternatingCount(leaves);
  if (leafCount === 0)
    return undefined;
  if (leafCount === 1)
    return alternatingGetFirst<BNode<K, V>, number>(leaves, 0);
  throw new Error("bulkLoad: multiple leaves not yet supported");
}

export function flushToLeaves<K, V>(alternatingList: (K | V)[], maxNodeSize: number, toFlushTo: (number | BNode<K, V>)[]): number {
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
    alternatingPush(toFlushTo, 0, leaf);
  }
  alternatingList.length = 0;
  return leafCount;
};