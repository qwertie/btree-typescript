import { BNode, BNodeInternal, check, defaultComparator, sumChildSizes } from '../b+tree';
import { alternatingCount, alternatingGetFirst, alternatingGetSecond } from './decompose';

export function bulkLoad<K, V>(
  entries: (K | V)[],
  maxNodeSize: number,
  compare?: (a: K, b: K) => number
): BNode<K, V> | undefined {
  const totalPairs = alternatingCount(entries);
  if (totalPairs > 1) {
    const cmp = compare ?? (defaultComparator as unknown as (a: K, b: K) => number);
    let previousKey = alternatingGetFirst<K, V>(entries, 0);
    for (let i = 1; i < totalPairs; i++) {
      const key = alternatingGetFirst<K, V>(entries, i);
      if (cmp(previousKey, key) >= 0)
        throw new Error("bulkLoad: entries must be sorted by key in strictly ascending order");
      previousKey = key;
    }
  }

  const leaves: BNode<K, V>[] = [];
  flushToLeaves<K, V>(entries, maxNodeSize, (leaf) => leaves.push(leaf));
  const leafCount = leaves.length;
  if (leafCount === 0)
    return undefined;

  let currentLevel: BNode<K, V>[] = leaves;
  while (true) {
    const nodeCount = currentLevel.length;
    if (nodeCount === 1)
      return currentLevel[0];

    if (nodeCount <= maxNodeSize) {
      return new BNodeInternal<K, V>(currentLevel, sumChildSizes(currentLevel));
    }

    const nextLevelCount = Math.ceil(nodeCount / maxNodeSize);
    check(nextLevelCount > 1);
    const nextLevel = new Array<BNodeInternal<K, V>>(nextLevelCount);
    let remainingNodes = nodeCount;
    let remainingParents = nextLevelCount;
    let childIndex = 0;

    for (let i = 0; i < nextLevelCount; i++) {
      const chunkSize = Math.ceil(remainingNodes / remainingParents);
      const children = new Array<BNode<K, V>>(chunkSize);
      let size = 0;
      for (let j = 0; j < chunkSize; j++) {
        const child = currentLevel[childIndex++];
        children[j] = child;
        size += child.size();
      }
      remainingNodes -= chunkSize;
      remainingParents--;
      nextLevel[i] = new BNodeInternal<K, V>(children, size);
    }

    const minSize = Math.floor(maxNodeSize / 2);
    const secondLastNode = nextLevel[nextLevelCount - 2];
    const lastNode = nextLevel[nextLevelCount - 1];
    while (lastNode.children.length < minSize) {
      lastNode.takeFromLeft(secondLastNode);
    }

    currentLevel = nextLevel;
  }
}

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
