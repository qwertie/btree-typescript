import BTree, { BNode, BNodeInternal, check, defaultComparator, sumChildSizes } from '../b+tree';
import { alternatingCount, alternatingGetFirst, alternatingGetSecond, flushToLeaves, type BTreeWithInternals } from './shared';

export function bulkLoad<K, V>(
  entries: (K | V)[],
  maxNodeSize: number,
  compare?: (a: K, b: K) => number
): BTree<K, V> {
  const totalPairs = alternatingCount(entries);
  const cmp = compare ?? (defaultComparator as unknown as (a: K, b: K) => number);
  if (totalPairs > 1) {
    let previousKey = alternatingGetFirst<K, V>(entries, 0);
    for (let i = 1; i < totalPairs; i++) {
      const key = alternatingGetFirst<K, V>(entries, i);
      if (cmp(previousKey, key) >= 0)
        throw new Error("bulkLoad: entries must be sorted by key in strictly ascending order");
      previousKey = key;
    }
  }

  const tree = new BTree<K, V>(undefined, cmp, maxNodeSize);
  const leaves: BNode<K, V>[] = [];
  flushToLeaves<K, V>(entries, maxNodeSize, (leaf) => leaves.push(leaf));
  const leafCount = leaves.length;
  if (leafCount === 0)
    return tree;

  let currentLevel: BNode<K, V>[] = leaves;
  while (currentLevel.length > 1) {
    const nodeCount = currentLevel.length;
    if (nodeCount <= maxNodeSize) {
      currentLevel = [new BNodeInternal<K, V>(currentLevel, sumChildSizes(currentLevel))];
      break;
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

  const target = tree as unknown as BTreeWithInternals<K, V>;
  target._root = currentLevel[0];
  target._size = totalPairs;
  return tree;
}

