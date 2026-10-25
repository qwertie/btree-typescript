import BTree, { BNode, BNodeInternal } from '../b+tree';
import BTreeEx from '../extended';
import omit, { omitUnboundedErrorMsg } from '../extended/omit';
import type { BTreeWithInternals } from '../extended/shared';
import MersenneTwister from 'mersenne-twister';
import {
  compareNumbers,
  forEachFuzzCase,
  populateFuzzTrees,
  randomInt,
  SetOperationFuzzSettings,
  TreeEntries
} from './shared';

type Bound = number | undefined;

const tuples = (...pairs: TreeEntries) => pairs;
const range = (from: number, toExclusive: number, step = 1) => {
  const out: number[] = [];
  for (let k = from; k < toExclusive; k += step)
    out.push(k);
  return out;
};
const entriesOf = (keys: number[]): TreeEntries => keys.map((k) => [k, k * 10]);
const buildTree = (entries: TreeEntries, maxNodeSize: number) =>
  new BTreeEx<number, number>(entries, compareNumbers, maxNodeSize);

const isOmitted = (key: number, start: Bound, end: Bound, includeEnd: boolean) =>
  (start === undefined || key >= start) &&
  (end === undefined || key < end || (includeEnd && key === end));

const expectedOmit = (entries: TreeEntries, start: Bound, end: Bound, includeEnd: boolean) =>
  entries.filter(([key]) => !isOmitted(key, start, end, includeEnd));

/**
 * Runs omit and validates the result against a filtered copy of the input's entries.
 * Callers are responsible for checking that the input is unchanged (see `expectUnchanged`).
 */
const expectOmit = (
  tree: BTreeEx<number, number>,
  start: Bound,
  end: Bound,
  includeEnd = false,
  entries: TreeEntries = tree.toArray()
) => {
  const result = tree.omit(start as number, end, includeEnd);
  result.checkValid(true);
  expect(result.toArray()).toEqual(expectedOmit(entries, start, end, includeEnd));
  expect(result).not.toBe(tree);
  expect(result.maxNodeSize).toBe(tree.maxNodeSize);
  expect(result._compare).toBe(tree._compare);
  return result;
};

const expectUnchanged = (tree: BTreeEx<number, number>, entries: TreeEntries) => {
  tree.checkValid(true);
  expect(tree.toArray()).toEqual(entries);
};

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

describe.each([32, 10, 5, 4])('BTree omit tests with fanout %i', (maxNodeSize) => {
  const buildTreeForFanout = (entries: TreeEntries) => buildTree(entries, maxNodeSize);

  const BASIC_CASES: Array<{
    name: string;
    entries: TreeEntries;
    start: Bound;
    end: Bound;
    includeEnd?: boolean;
    expected: TreeEntries;
  }> = [
    {
      name: 'omit from empty tree yields empty tree',
      entries: tuples(),
      start: 1,
      end: 5,
      expected: [],
    },
    {
      name: 'omit excludes end by default',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40], [5, 50]),
      start: 2,
      end: 4,
      expected: tuples([1, 10], [4, 40], [5, 50]),
    },
    {
      name: 'omit with includeEnd also removes end',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40], [5, 50]),
      start: 2,
      end: 4,
      includeEnd: true,
      expected: tuples([1, 10], [5, 50]),
    },
    {
      name: 'omit with bounds between keys',
      entries: tuples([10, 1], [20, 2], [30, 3], [40, 4]),
      start: 15,
      end: 35,
      expected: tuples([10, 1], [40, 4]),
    },
    {
      name: 'omit with undefined start removes prefix',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40]),
      start: undefined,
      end: 3,
      expected: tuples([3, 30], [4, 40]),
    },
    {
      name: 'omit with undefined end removes suffix',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40]),
      start: 3,
      end: undefined,
      expected: tuples([1, 10], [2, 20]),
    },
    {
      name: 'omit range covering all keys yields empty tree',
      entries: tuples([1, 10], [2, 20], [3, 30]),
      start: 0,
      end: 3,
      includeEnd: true,
      expected: [],
    },
    {
      name: 'omit range before all keys removes nothing',
      entries: tuples([5, 50], [6, 60]),
      start: 1,
      end: 5,
      expected: tuples([5, 50], [6, 60]),
    },
    {
      name: 'omit range after all keys removes nothing',
      entries: tuples([5, 50], [6, 60]),
      start: 7,
      end: 9,
      expected: tuples([5, 50], [6, 60]),
    },
    {
      name: 'omit range in a gap between keys removes nothing',
      entries: tuples([5, 50], [10, 100]),
      start: 6,
      end: 9,
      includeEnd: true,
      expected: tuples([5, 50], [10, 100]),
    },
    {
      name: 'omit with start equal to end removes nothing unless includeEnd',
      entries: tuples([1, 10], [2, 20], [3, 30]),
      start: 2,
      end: 2,
      expected: tuples([1, 10], [2, 20], [3, 30]),
    },
    {
      name: 'omit with start equal to end and includeEnd removes that key',
      entries: tuples([1, 10], [2, 20], [3, 30]),
      start: 2,
      end: 2,
      includeEnd: true,
      expected: tuples([1, 10], [3, 30]),
    },
    {
      name: 'omit with start after end removes nothing',
      entries: tuples([1, 10], [2, 20], [3, 30]),
      start: 3,
      end: 1,
      includeEnd: true,
      expected: tuples([1, 10], [2, 20], [3, 30]),
    },
  ];

  BASIC_CASES.forEach(({ name, entries, start, end, includeEnd, expected }) => {
    it(name, () => {
      const tree = buildTreeForFanout(entries);
      const result = expectOmit(tree, start, end, includeEnd);
      expect(result.toArray()).toEqual(expected);
      expectUnchanged(tree, entries);
    });
  });

  it('omit preserves the input tree type', () => {
    const tree = buildTreeForFanout(entriesOf(range(0, 100)));
    expect(tree.omit(10, 20)).toBeInstanceOf(BTreeEx);
    const plain = new BTree<number, number>(entriesOf(range(0, 100)), compareNumbers, maxNodeSize);
    const result = omit(plain, 10, 20);
    expect(result).toBeInstanceOf(BTree);
    expect(result).not.toBeInstanceOf(BTreeEx);
    expect(result.size).toBe(90);
  });

  const SIZES = [1, 2, maxNodeSize - 1, maxNodeSize, maxNodeSize + 1, 3 * maxNodeSize, 1000];
  SIZES.forEach((size) => {
    it(`omit handles every kind of bound over a tree of size ${size}`, () => {
      // Even keys, so odd bounds fall between keys
      const entries = entriesOf(range(0, size * 2, 2));
      const tree = buildTreeForFanout(entries);
      const bounds = size <= 40
        ? range(-2, size * 2 + 2, size <= 20 ? 1 : 3)
        : [-1, 0, 1, 7, size - 1, size, size + 1, size * 2 - 2, size * 2 + 1];
      for (const start of bounds) {
        expectOmit(tree, start, undefined, false, entries);
        expectOmit(tree, undefined, start, false, entries);
        expectOmit(tree, undefined, start, true, entries);
        for (const end of bounds) {
          expectOmit(tree, start, end, false, entries);
          expectOmit(tree, start, end, true, entries);
        }
      }
      expectUnchanged(tree, entries);
    });
  });

  it('omit result and input can be mutated independently', () => {
    const tree = buildTreeForFanout(entriesOf(range(0, 1000)));
    const before = tree.toArray();
    const result = tree.omit(200, 700);
    const resultBefore = result.toArray();
    for (let k = 0; k < 1000; k += 3) {
      result.set(k, -k);
      result.delete(k + 1);
    }
    tree.checkValid(true);
    expect(tree.toArray()).toEqual(before);

    const result2 = tree.omit(200, 700);
    for (let k = 0; k < 1000; k += 7)
      tree.set(k, -1);
    result2.checkValid(true);
    expect(result2.toArray()).toEqual(resultBefore);
  });

  it('omit reuses subtrees outside the range and only creates nodes along the range boundaries', () => {
    const tree = buildTreeForFanout(entriesOf(range(0, 20000)));
    const entries = tree.toArray();
    const height = treeHeight(tree);
    const sourceNodes = collectNodes(tree);
    const cases: Array<[Bound, Bound]> = [[5000, 15000], [7, 19990], [undefined, 12345], [9876, undefined], [10000, 10001]];
    for (const [start, end] of cases) {
      const result = expectOmit(tree, start, end, false, entries);
      const resultNodes = collectNodes(result);
      let created = 0;
      resultNodes.forEach((node) => { if (!sourceNodes.has(node)) created++; });
      // Only nodes along the two boundary paths (plus any splits during reconstruction) are new.
      expect(created).toBeLessThanOrEqual(6 * (height + 1));
      if (result.size >= 4 * maxNodeSize)
        expect(resultNodes.size - created).toBeGreaterThan(0);
    }
    expectUnchanged(tree, entries);
  });
});

describe('BTree omit input/output validation', () => {
  it('omit throws when both bounds are undefined', () => {
    const tree = buildTree(entriesOf(range(0, 10)), 4);
    expect(() => (tree as any).omit(undefined, undefined)).toThrow(omitUnboundedErrorMsg);
    expect(() => (omit as any)(tree, undefined, undefined)).toThrow(omitUnboundedErrorMsg);
  });

  it('omit overloads accept at most one undefined bound', () => {
    const tree = buildTree(entriesOf(range(0, 10)), 4);
    const sizes: number[] = [
      tree.omit(1, 3).size,
      tree.omit(1, undefined).size,
      tree.omit(undefined, 3).size,
      tree.omit(undefined, 3, true).size,
      omit(tree, 1, 3).size,
      omit(tree, undefined, 3).size,
      omit(tree, 3, undefined).size,
    ];
    expect(sizes).toEqual([8, 1, 7, 6, 8, 7, 3]);
    // @ts-expect-error both bounds undefined is not allowed
    expect(() => tree.omit(undefined, undefined)).toThrow();
  });
});

describe('BTree omit fuzz tests', () => {
  const FUZZ_SETTINGS: SetOperationFuzzSettings = {
    branchingFactors: [4, 5, 32],
    ooms: [2, 3],
    fractionsPerOOM: [0.1, 0.5, 1],
    removalChances: [0, 0.01, 0.1]
  };
  const RANGES_PER_CASE = 40;

  const FUZZ_TIMEOUT_MS = 30_000;
  jest.setTimeout(FUZZ_TIMEOUT_MS);

  const rng = new MersenneTwister(0x0317);

  // Bounds span slightly beyond the key space and land on keys or between them.
  const randomBound = (size: number) => randomInt(rng, size + 4) - 2 + (rng.random() < 0.5 ? 0 : 0.5);
  const randomRange = (size: number): [Bound, Bound] => {
    const roll = rng.random();
    if (roll < 0.1)
      return [undefined, randomBound(size)];
    if (roll < 0.2)
      return [randomBound(size), undefined];
    const a = randomBound(size), b = randomBound(size);
    // Mostly well-ordered ranges, with some reversed (empty) ones
    return roll < 0.9 ? [Math.min(a, b), Math.max(a, b)] : [Math.max(a, b), Math.min(a, b)];
  };

  forEachFuzzCase(FUZZ_SETTINGS, ({ maxNodeSize, size, fractionA, removalChance, removalLabel }) => {
    it(`branch ${maxNodeSize}, size ${size}, fraction ${fractionA.toFixed(2)}, removal ${removalLabel}`, () => {
      const tree = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);
      const [entries] = populateFuzzTrees(
        [{ tree, fraction: fractionA, removalChance }],
        { rng, size, compare: compareNumbers, maxNodeSize }
      );

      for (let i = 0; i < RANGES_PER_CASE; i++) {
        const [start, end] = randomRange(size);
        expectOmit(tree, start, end, rng.random() < 0.5, entries);
      }

      // Chain omits on results (which share nodes with their inputs), interleaved with mutations.
      let current = tree;
      for (let i = 0; i < RANGES_PER_CASE && current.size > 0; i++) {
        const [start, end] = randomRange(size);
        current = expectOmit(current, start, end, rng.random() < 0.5);
        const key = randomInt(rng, size);
        current.set(key, -key);
      }

      expectUnchanged(tree, entries);
    });
  });
});
