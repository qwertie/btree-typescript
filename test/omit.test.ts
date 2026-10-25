import BTree, { BNode, BNodeInternal } from '../b+tree';
import BTreeEx from '../extended';
import omit, { omitInvalidRangeErrorMsg, type KeyRange } from '../extended/omit';
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

type Range = KeyRange<number>;
type LowerKind = 'gt' | 'gte' | undefined;
type UpperKind = 'lt' | 'lte' | undefined;
const LOWER_KINDS: LowerKind[] = ['gte', 'gt', undefined];
const UPPER_KINDS: UpperKind[] = ['lt', 'lte', undefined];

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

/** Builds a range from bound kinds; at least one kind must be defined. */
const makeRange = (lowerKind: LowerKind, lower: number, upperKind: UpperKind, upper: number): Range => {
  const r: { [bound: string]: number } = {};
  if (lowerKind !== undefined)
    r[lowerKind] = lower;
  if (upperKind !== undefined)
    r[upperKind] = upper;
  return r as unknown as Range;
};

const isOmitted = (key: number, range: Range) => {
  const { gt, gte, lt, lte } = range as { gt?: number, gte?: number, lt?: number, lte?: number };
  return (gt === undefined || key > gt) && (gte === undefined || key >= gte) &&
    (lt === undefined || key < lt) && (lte === undefined || key <= lte);
};

const expectedOmit = (entries: TreeEntries, range: Range) =>
  entries.filter(([key]) => !isOmitted(key, range));

/**
 * Runs omit and validates the result against a filtered copy of the input's entries.
 * Callers are responsible for checking that the input is unchanged (see `expectUnchanged`).
 */
const expectOmit = (tree: BTreeEx<number, number>, range: Range, entries: TreeEntries = tree.toArray()) => {
  const result = tree.omit(range);
  result.checkValid(true);
  expect(result.toArray()).toEqual(expectedOmit(entries, range));
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
    range: Range;
    expected: TreeEntries;
  }> = [
    {
      name: 'omit from empty tree yields empty tree',
      entries: tuples(),
      range: { gte: 1, lt: 5 },
      expected: [],
    },
    {
      name: 'omit with gte and lt',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40], [5, 50]),
      range: { gte: 2, lt: 4 },
      expected: tuples([1, 10], [4, 40], [5, 50]),
    },
    {
      name: 'omit with gte and lte',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40], [5, 50]),
      range: { gte: 2, lte: 4 },
      expected: tuples([1, 10], [5, 50]),
    },
    {
      name: 'omit with gt and lt',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40], [5, 50]),
      range: { gt: 2, lt: 4 },
      expected: tuples([1, 10], [2, 20], [4, 40], [5, 50]),
    },
    {
      name: 'omit with gt and lte',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40], [5, 50]),
      range: { gt: 2, lte: 4 },
      expected: tuples([1, 10], [2, 20], [5, 50]),
    },
    {
      name: 'omit with bounds between keys',
      entries: tuples([10, 1], [20, 2], [30, 3], [40, 4]),
      range: { gt: 15, lte: 35 },
      expected: tuples([10, 1], [40, 4]),
    },
    {
      name: 'omit with only lt removes prefix',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40]),
      range: { lt: 3 },
      expected: tuples([3, 30], [4, 40]),
    },
    {
      name: 'omit with only lte removes prefix',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40]),
      range: { lte: 3 },
      expected: tuples([4, 40]),
    },
    {
      name: 'omit with only gte removes suffix',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40]),
      range: { gte: 3 },
      expected: tuples([1, 10], [2, 20]),
    },
    {
      name: 'omit with only gt removes suffix',
      entries: tuples([1, 10], [2, 20], [3, 30], [4, 40]),
      range: { gt: 3 },
      expected: tuples([1, 10], [2, 20], [3, 30]),
    },
    {
      name: 'omit with gt at the max key removes nothing',
      entries: tuples([1, 10], [2, 20], [3, 30]),
      range: { gt: 3 },
      expected: tuples([1, 10], [2, 20], [3, 30]),
    },
    {
      name: 'omit range covering all keys yields empty tree',
      entries: tuples([1, 10], [2, 20], [3, 30]),
      range: { gte: 1, lte: 3 },
      expected: [],
    },
    {
      name: 'omit range before all keys removes nothing',
      entries: tuples([5, 50], [6, 60]),
      range: { gte: 1, lt: 5 },
      expected: tuples([5, 50], [6, 60]),
    },
    {
      name: 'omit range after all keys removes nothing',
      entries: tuples([5, 50], [6, 60]),
      range: { gt: 6, lte: 9 },
      expected: tuples([5, 50], [6, 60]),
    },
    {
      name: 'omit range in a gap between keys removes nothing',
      entries: tuples([5, 50], [10, 100]),
      range: { gt: 5, lt: 10 },
      expected: tuples([5, 50], [10, 100]),
    },
    {
      name: 'omit with gte equal to lte removes that key',
      entries: tuples([1, 10], [2, 20], [3, 30]),
      range: { gte: 2, lte: 2 },
      expected: tuples([1, 10], [3, 30]),
    },
    {
      name: 'omit with equal bounds removes nothing if either is exclusive',
      entries: tuples([1, 10], [2, 20], [3, 30]),
      range: { gte: 2, lt: 2 },
      expected: tuples([1, 10], [2, 20], [3, 30]),
    },
    {
      name: 'omit with lower bound after upper bound removes nothing',
      entries: tuples([1, 10], [2, 20], [3, 30]),
      range: { gte: 3, lte: 1 },
      expected: tuples([1, 10], [2, 20], [3, 30]),
    },
  ];

  BASIC_CASES.forEach(({ name, entries, range, expected }) => {
    it(name, () => {
      const tree = buildTreeForFanout(entries);
      const result = expectOmit(tree, range);
      expect(result.toArray()).toEqual(expected);
      expectUnchanged(tree, entries);
    });
  });

  it('omit preserves the input tree type', () => {
    const tree = buildTreeForFanout(entriesOf(range(0, 100)));
    expect(tree.omit({ gte: 10, lt: 20 })).toBeInstanceOf(BTreeEx);
    const plain = new BTree<number, number>(entriesOf(range(0, 100)), compareNumbers, maxNodeSize);
    const result = omit(plain, { gte: 10, lt: 20 });
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
      for (const lowerKind of LOWER_KINDS) {
        for (const upperKind of UPPER_KINDS) {
          if (lowerKind === undefined && upperKind === undefined)
            continue;
          for (const lower of lowerKind === undefined ? [0] : bounds) {
            for (const upper of upperKind === undefined ? [0] : bounds)
              expectOmit(tree, makeRange(lowerKind, lower, upperKind, upper), entries);
          }
        }
      }
      expectUnchanged(tree, entries);
    });
  });

  it('omit result and input can be mutated independently', () => {
    const tree = buildTreeForFanout(entriesOf(range(0, 1000)));
    const before = tree.toArray();
    const result = tree.omit({ gte: 200, lt: 700 });
    const resultBefore = result.toArray();
    for (let k = 0; k < 1000; k += 3) {
      result.set(k, -k);
      result.delete(k + 1);
    }
    tree.checkValid(true);
    expect(tree.toArray()).toEqual(before);

    const result2 = tree.omit({ gte: 200, lt: 700 });
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
    const cases: Range[] = [{ gte: 5000, lt: 15000 }, { gt: 7, lte: 19990 }, { lt: 12345 }, { gt: 9876 }, { gte: 10000, lte: 10001 }];
    for (const range of cases) {
      const result = expectOmit(tree, range, entries);
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
  const tree = buildTree(entriesOf(range(0, 10)), 4);
  const INVALID_RANGES: Array<[string, object]> = [
    ['no bounds', {}],
    ['only undefined bounds', { gte: undefined, lt: undefined }],
    ['both gt and gte', { gt: 1, gte: 1 }],
    ['both lt and lte', { lt: 5, lte: 5 }],
    ['both lower and both upper bounds', { gt: 1, gte: 1, lt: 5, lte: 5 }],
  ];

  INVALID_RANGES.forEach(([name, invalid]) => {
    it(`omit throws for a range with ${name}`, () => {
      expect(() => tree.omit(invalid as Range)).toThrow(omitInvalidRangeErrorMsg);
      expect(() => omit(tree, invalid as Range)).toThrow(omitInvalidRangeErrorMsg);
    });
  });

  it('omit range type requires one bound of each kind at most, and at least one bound', () => {
    const maybe = 3 as number | undefined;
    const sizes: number[] = [
      tree.omit({ gte: 1, lt: 3 }).size,
      tree.omit({ gt: 1, lte: 3 }).size,
      tree.omit({ gte: 3 }).size,
      tree.omit({ lte: 3 }).size,
      tree.omit({ gte: 1, lt: maybe }).size,
      omit(tree, { gt: maybe, lt: 5 }).size,
    ];
    expect(sizes).toEqual([8, 8, 3, 6, 8, 9]);
    // @ts-expect-error at least one bound is required
    expect(() => tree.omit({})).toThrow();
    // @ts-expect-error gt and gte are mutually exclusive
    expect(() => tree.omit({ gt: 1, gte: 1 })).toThrow();
    // @ts-expect-error lt and lte are mutually exclusive
    expect(() => tree.omit({ gte: 0, lt: 1, lte: 1 })).toThrow();
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
  const randomRange = (size: number): Range => {
    const lowerKind = rng.random() < 0.5 ? 'gte' : 'gt';
    const upperKind = rng.random() < 0.5 ? 'lt' : 'lte';
    const roll = rng.random();
    if (roll < 0.1)
      return makeRange(undefined, 0, upperKind, randomBound(size));
    if (roll < 0.2)
      return makeRange(lowerKind, randomBound(size), undefined, 0);
    const a = randomBound(size), b = randomBound(size);
    // Mostly well-ordered ranges, with some reversed (empty) ones
    const [lower, upper] = roll < 0.9 ? [Math.min(a, b), Math.max(a, b)] : [Math.max(a, b), Math.min(a, b)];
    return makeRange(lowerKind, lower, upperKind, upper);
  };

  forEachFuzzCase(FUZZ_SETTINGS, ({ maxNodeSize, size, fractionA, removalChance, removalLabel }) => {
    it(`branch ${maxNodeSize}, size ${size}, fraction ${fractionA.toFixed(2)}, removal ${removalLabel}`, () => {
      const tree = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);
      const [entries] = populateFuzzTrees(
        [{ tree, fraction: fractionA, removalChance }],
        { rng, size, compare: compareNumbers, maxNodeSize }
      );

      for (let i = 0; i < RANGES_PER_CASE; i++)
        expectOmit(tree, randomRange(size), entries);

      // Chain omits on results (which share nodes with their inputs), interleaved with mutations.
      let current = tree;
      for (let i = 0; i < RANGES_PER_CASE && current.size > 0; i++) {
        current = expectOmit(current, randomRange(size));
        const key = randomInt(rng, size);
        current.set(key, -key);
      }

      expectUnchanged(tree, entries);
    });
  });
});
