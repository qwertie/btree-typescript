import BTree, { BNode, BNodeInternal } from '../b+tree';
import BTreeEx from '../extended';
import omit, { omitUnboundedErrorMsg } from '../extended/omit';
import type { BTreeWithInternals } from '../extended/shared';
import MersenneTwister from 'mersenne-twister';
import { compareNumbers } from './shared';

type Entries = Array<[number, number]>;

const buildTree = (keys: number[], maxNodeSize: number) =>
  new BTreeEx<number, number>(keys.map((k) => [k, k * 10] as [number, number]), compareNumbers, maxNodeSize);

const range = (from: number, toExclusive: number, step = 1) => {
  const out: number[] = [];
  for (let k = from; k < toExclusive; k += step)
    out.push(k);
  return out;
};

const expectedOmit = (entries: Entries, start: number | undefined, end: number | undefined, includeEnd: boolean) =>
  entries.filter(([k]) => {
    const afterStart = start === undefined || k >= start;
    const beforeEnd = end === undefined || k < end || (includeEnd && k === end);
    return !(afterStart && beforeEnd);
  });

const collectNodes = <K, V>(tree: BTree<K, V>) => {
  const nodes = new Set<BNode<K, V>>();
  const visit = (node: BNode<K, V>) => {
    nodes.add(node);
    if (!node.isLeaf)
      (node as BNodeInternal<K, V>).children.forEach(visit);
  };
  visit((tree as unknown as BTreeWithInternals<K, V>)._root);
  return nodes;
};

const treeHeight = <K, V>(tree: BTree<K, V>) => {
  let node = (tree as unknown as BTreeWithInternals<K, V>)._root;
  let height = 1;
  while (!node.isLeaf) {
    node = (node as BNodeInternal<K, V>).children[0];
    height++;
  }
  return height;
};

const checkOmit = (
  tree: BTreeEx<number, number>,
  start: number | undefined,
  end: number | undefined,
  includeEnd = false
) => {
  const before = tree.toArray();
  const result = tree.omit(start as number, end, includeEnd);
  result.checkValid(true);
  expect(result.toArray()).toEqual(expectedOmit(before, start, end, includeEnd));
  expect(result.maxNodeSize).toBe(tree.maxNodeSize);
  expect(result._compare).toBe(tree._compare);
  tree.checkValid(true);
  expect(tree.toArray()).toEqual(before);
  return result;
};

describe.each([4, 5, 10, 32])('omit with max node size %i', (maxNodeSize) => {
  const sizes = [0, 1, 2, maxNodeSize - 1, maxNodeSize, maxNodeSize + 1, 3 * maxNodeSize, 1000];

  test('returns an instance of the input class', () => {
    const tree = buildTree(range(0, 100), maxNodeSize);
    expect(tree.omit(10, 20)).toBeInstanceOf(BTreeEx);
    const plain = new BTree<number, number>(range(0, 100).map((k) => [k, k]), compareNumbers, maxNodeSize);
    const result = omit(plain, 10, 20);
    expect(result).toBeInstanceOf(BTree);
    expect(result.size).toBe(90);
  });

  test('throws when both bounds are undefined', () => {
    const tree = buildTree(range(0, 10), maxNodeSize);
    expect(() => (tree as any).omit(undefined, undefined)).toThrow(omitUnboundedErrorMsg);
    expect(() => (omit as any)(tree, undefined, undefined)).toThrow(omitUnboundedErrorMsg);
  });

  test.each(sizes)('exhaustive bounds over a tree of size %i', (size) => {
    const keys = range(0, size * 2, 2); // even keys, so odd bounds fall between keys
    const tree = buildTree(keys, maxNodeSize);
    const bounds = size <= 40
      ? range(-2, size * 2 + 2, size <= 20 ? 1 : 3)
      : [-1, 0, 1, 7, size - 1, size, size + 1, size * 2 - 2, size * 2 + 1];
    for (const start of bounds) {
      checkOmit(tree, start, undefined);
      checkOmit(tree, undefined, start);
      checkOmit(tree, undefined, start, true);
      for (const end of bounds) {
        checkOmit(tree, start, end);
        checkOmit(tree, start, end, true);
      }
    }
  });

  test('omitting nothing still returns a distinct tree', () => {
    const tree = buildTree(range(0, 50), maxNodeSize);
    for (const [start, end] of [[100, 200], [-10, -5], [20, 20], [30, 10]] as Array<[number, number]>) {
      const result = checkOmit(tree, start, end);
      expect(result).not.toBe(tree);
      expect(result.size).toBe(50);
    }
  });

  test('omitting everything yields an empty tree', () => {
    const tree = buildTree(range(0, 500), maxNodeSize);
    expect(checkOmit(tree, -1, 500).size).toBe(0);
    expect(checkOmit(tree, undefined, 499, true).size).toBe(0);
    expect(checkOmit(tree, 0, undefined).size).toBe(0);
  });

  test('result and source can be mutated independently', () => {
    const tree = buildTree(range(0, 1000), maxNodeSize);
    const snapshot = tree.toArray();
    const result = tree.omit(200, 700);
    const resultSnapshot = result.toArray();
    for (let k = 0; k < 1000; k += 3) {
      result.set(k, -k);
      result.delete(k + 1);
    }
    tree.checkValid(true);
    expect(tree.toArray()).toEqual(snapshot);

    const result2 = tree.omit(200, 700);
    for (let k = 0; k < 1000; k += 7)
      tree.set(k, -1);
    result2.checkValid(true);
    expect(result2.toArray()).toEqual(resultSnapshot);
  });

  test('reuses subtrees outside the range and only creates nodes along the boundaries', () => {
    const tree = buildTree(range(0, 20000), maxNodeSize);
    const height = treeHeight(tree);
    const sourceNodes = collectNodes(tree);
    const cases: Array<[number | undefined, number | undefined]> = [[5000, 15000], [7, 19990], [undefined, 12345], [9876, undefined], [10000, 10001]];
    for (const [start, end] of cases) {
      const result = checkOmit(tree, start, end);
      const resultNodes = collectNodes(result);
      let created = 0;
      resultNodes.forEach((node) => { if (!sourceNodes.has(node)) created++; });
      // Only nodes along the two boundary paths (plus any splits during reconstruction) are new.
      expect(created).toBeLessThanOrEqual(6 * (height + 1));
      if (result.size >= 4 * maxNodeSize)
        expect(resultNodes.size - created).toBeGreaterThan(0);
    }
  });

  test('chained omits match filtering', () => {
    const rand = new MersenneTwister(maxNodeSize);
    let tree = buildTree(range(0, 3000), maxNodeSize);
    let expected = tree.toArray();
    for (let i = 0; i < 60 && tree.size > 0; i++) {
      const a = Math.floor(rand.random() * 3200) - 100;
      const b = a + Math.floor(rand.random() * 200);
      const roll = rand.random();
      const start = roll < 0.1 ? undefined : a;
      const end = roll > 0.9 ? undefined : b;
      if (start === undefined && end === undefined)
        continue;
      const includeEnd = rand.random() < 0.5;
      tree = checkOmit(tree, start, end, includeEnd);
      expected = expectedOmit(expected, start, end, includeEnd);
      expect(tree.toArray()).toEqual(expected);
      // Interleave mutations to exercise copy-on-write on shared nodes.
      const k = Math.floor(rand.random() * 3000);
      tree.set(k, k);
      expected = tree.toArray();
    }
  });

  test('random sparse trees', () => {
    const rand = new MersenneTwister(1000 + maxNodeSize);
    for (let t = 0; t < 20; t++) {
      const size = Math.floor(rand.random() * 2000);
      const tree = new BTreeEx<number, number>(undefined, compareNumbers, maxNodeSize);
      for (let i = 0; i < size; i++)
        tree.set(Math.floor(rand.random() * 10000), i);
      // Deletions create underfilled nodes in the source tree.
      for (let i = 0; i < size / 3; i++)
        tree.delete(Math.floor(rand.random() * 10000));
      for (let r = 0; r < 10; r++) {
        const a = Math.floor(rand.random() * 10200) - 100;
        const b = Math.floor(rand.random() * 10200) - 100;
        checkOmit(tree, Math.min(a, b), Math.max(a, b), rand.random() < 0.5);
      }
    }
  });
});

describe('omit typing', () => {
  test('overloads accept at most one undefined bound', () => {
    const tree = buildTree(range(0, 10), 4);
    const values: number[] = [
      tree.omit(1, 3).size,
      tree.omit(1, undefined).size,
      tree.omit(undefined, 3).size,
      tree.omit(undefined, 3, true).size,
      omit(tree, 1, 3).size,
      omit(tree, undefined, 3).size,
      omit(tree, 3, undefined).size,
    ];
    expect(values).toEqual([8, 1, 7, 6, 8, 7, 3]);
    // @ts-expect-error both bounds undefined is not allowed
    expect(() => tree.omit(undefined, undefined)).toThrow();
  });
});
