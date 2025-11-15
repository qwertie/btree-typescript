import BTree, { BNode, BNodeInternal, check, sumChildSizes } from '../b+tree';
import { alternatingCount, alternatingGetFirst, flushToLeaves, type AlternatingList, type BTreeWithInternals } from './shared';

/**
 * Loads a B-Tree from a sorted list of entries in bulk. This is faster than inserting
 * entries one at a time, and produces a more optimally balanced tree.
 * Time and space complexity: O(n).
 * @param entries The list of key/value pairs to load. Must be sorted by key in strictly ascending order. Note that
 * the array is an alternating list of keys and values: [key0, value0, key1, value1, ...].
 * @param maxNodeSize The branching factor (maximum node size) for the resulting tree.
 * @param compare Function to compare keys.
 * @returns A new BTree containing the given entries.
 * @throws Error if the entries are not sorted by key in strictly ascending order (duplicates disallowed).
 */
export function bulkLoad<K, V>(
  entries: (K | V)[],
  maxNodeSize: number,
  compare: (a: K, b: K) => number
): BTree<K, V> {
  const alternatingEntries = entries as AlternatingList<K, V>;
  const root = bulkLoadRoot<K, V>(alternatingEntries, maxNodeSize, compare);
  const tree = new BTree<K, V>(undefined, compare, maxNodeSize);
  const target = tree as unknown as BTreeWithInternals<K, V>;
  target._root = root;
  target._size = root.size();
  return tree;
}

/**
 * Bulk loads, returns the root node of the resulting tree.
 * @internal
 */
export function bulkLoadRoot<K, V>(
  entries: AlternatingList<K, V>,
  maxNodeSize: number,
  compare: (a: K, b: K) => number
): BNode<K, V> {
  const totalPairs = alternatingCount(entries);
  if (totalPairs > 1) {
    let previousKey = alternatingGetFirst(entries, 0);
    for (let i = 1; i < totalPairs; i++) {
      const key = alternatingGetFirst(entries, i);
      if (compare(previousKey, key) >= 0)
        throw new Error("bulkLoad: entries must be sorted by key in strictly ascending order");
      previousKey = key;
    }
  }

  const leaves: BNode<K, V>[] = [];
  flushToLeaves(entries, maxNodeSize, (leaf) => leaves.push(leaf));
  if (leaves.length === 0)
    return new BNode<K, V>();

  let currentLevel: BNode<K, V>[] = leaves;
  while (currentLevel.length > 1) {
    const nodeCount = currentLevel.length;
    if (nodeCount <= maxNodeSize) {
      currentLevel = [new BNodeInternal<K, V>(currentLevel, sumChildSizes(currentLevel))];
      break;
    }

    const nextLevelCount = Math.ceil(nodeCount / maxNodeSize);
    check(nextLevelCount > 1);
    const nextLevel = new Array<BNode<K, V>>(nextLevelCount);
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
    const secondLastNode = nextLevel[nextLevelCount - 2] as BNodeInternal<K, V>;
    const lastNode = nextLevel[nextLevelCount - 1] as BNodeInternal<K, V>;
    while (lastNode.children.length < minSize)
      lastNode.takeFromLeft(secondLastNode);

    currentLevel = nextLevel;
  }

  return currentLevel[0];
}
