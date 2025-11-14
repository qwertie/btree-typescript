import BTreeEx from '../extended';
import forEachKeyNotIn from '../extended/forEachKeyNotIn';
import subtract from '../extended/subtract';
import { comparatorErrorMsg, branchingFactorErrorMsg } from '../extended/shared';
import MersenneTwister from 'mersenne-twister';
import { makeArray } from './shared';

type NotInCall = { key: number, value: number };

const runSubtractionImplementations = (
  include: BTreeEx<number, number>,
  exclude: BTreeEx<number, number>,
  assertion: (calls: NotInCall[]) => void
) => {
  const forEachCalls: NotInCall[] = [];
  forEachKeyNotIn(include, exclude, (key, value) => {
    forEachCalls.push({ key, value });
  });
  assertion(forEachCalls);

  const resultTree = subtract<BTreeEx<number, number>, number, number>(include, exclude);
  const subtractCalls = resultTree.toArray().map(([key, value]) => ({ key, value }));
  expect(subtractCalls).toEqual(forEachCalls);
  resultTree.checkValid();
  assertion(subtractCalls);
};

const expectSubtractionCalls = (
  include: BTreeEx<number, number>,
  exclude: BTreeEx<number, number>,
  expected: NotInCall[]
) => {
  runSubtractionImplementations(include, exclude, (calls) => {
    expect(calls).toEqual(expected);
  });
};

const tuplesToRecords = (entries: Array<[number, number]>): NotInCall[] =>
  entries.map(([key, value]) => ({ key, value }));

const tuples = (...pairs: Array<[number, number]>) => pairs;

describe('BTree forEachKeyNotIn tests with fanout 32', testForEachKeyNotIn.bind(null, 32));
describe('BTree forEachKeyNotIn tests with fanout 10', testForEachKeyNotIn.bind(null, 10));
describe('BTree forEachKeyNotIn tests with fanout 4',  testForEachKeyNotIn.bind(null, 4));

function testForEachKeyNotIn(maxNodeSize: number) {
  const compare = (a: number, b: number) => a - b;

  const buildTree = (entries: Array<[number, number]>) =>
    new BTreeEx<number, number>(entries, compare, maxNodeSize);

  it('forEachKeyNotIn two empty trees', () => {
    const includeTree = buildTree([]);
    const excludeTree = buildTree([]);
    expectSubtractionCalls(includeTree, excludeTree, []);
  });

  it('forEachKeyNotIn include empty tree with non-empty tree', () => {
    const includeTree = buildTree([]);
    const excludeTree = buildTree(tuples([1, 10], [2, 20], [3, 30]));
    expectSubtractionCalls(includeTree, excludeTree, []);
  });

  it('forEachKeyNotIn exclude tree empty yields all include keys', () => {
    const includeEntries: Array<[number, number]> = [[1, 10], [3, 30], [5, 50]];
    const includeTree = buildTree(includeEntries);
    const excludeTree = buildTree([]);
    const expected = tuplesToRecords(includeEntries);
    expectSubtractionCalls(includeTree, excludeTree, expected);
  });

  it('forEachKeyNotIn with no overlapping keys returns include tree contents', () => {
    const includeEntries: Array<[number, number]> = [[1, 10], [3, 30], [5, 50]];
    const excludeEntries: Array<[number, number]> = [[0, 100], [2, 200], [4, 400]];
    const includeTree = buildTree(includeEntries);
    const excludeTree = buildTree(excludeEntries);
    const expected = tuplesToRecords(includeEntries);
    expectSubtractionCalls(includeTree, excludeTree, expected);
  });

  it('forEachKeyNotIn with overlapping keys excludes matches', () => {
    const includeTree = buildTree(tuples([1, 10], [2, 20], [3, 30], [4, 40], [5, 50]));
    const excludeTree = buildTree(tuples([0, 100], [2, 200], [4, 400], [6, 600]));
    expectSubtractionCalls(includeTree, excludeTree, [
      { key: 1, value: 10 },
      { key: 3, value: 30 },
      { key: 5, value: 50 },
    ]);
  });

  it('forEachKeyNotIn excludes leading overlap then emits remaining keys', () => {
    const includeTree = buildTree(tuples([1, 10], [2, 20], [3, 30], [4, 40]));
    const excludeTree = buildTree(tuples([1, 100], [2, 200]));
    expectSubtractionCalls(includeTree, excludeTree, [
      { key: 3, value: 30 },
      { key: 4, value: 40 },
    ]);
  });

  it('forEachKeyNotIn maintains tree contents', () => {
    const includeEntries: Array<[number, number]> = [[1, 10], [2, 20], [3, 30], [4, 40], [5, 50]];
    const excludeEntries: Array<[number, number]> = [[1, 100], [3, 300], [5, 500]];
    const includeTree = buildTree(includeEntries);
    const excludeTree = buildTree(excludeEntries);
    const includeBefore = includeTree.toArray();
    const excludeBefore = excludeTree.toArray();
    expectSubtractionCalls(includeTree, excludeTree, [
      { key: 2, value: 20 },
      { key: 4, value: 40 },
    ]);
    expect(includeTree.toArray()).toEqual(includeBefore);
    expect(excludeTree.toArray()).toEqual(excludeBefore);
    includeTree.checkValid();
    excludeTree.checkValid();
  });

  it('forEachKeyNotIn with contiguous overlap yields sorted survivors', () => {
    const includeTree = buildTree(tuples([1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]));
    const excludeTree = buildTree(tuples([3, 30], [4, 40], [5, 50]));
    runSubtractionImplementations(includeTree, excludeTree, (calls) => {
      expect(calls.map(c => c.key)).toEqual([1, 2, 6]);
      expect(calls.map(c => c.value)).toEqual([1, 2, 6]);
    });
  });

  it('forEachKeyNotIn large subtraction leaves prefix and suffix ranges', () => {
    const size = 1000;
    const excludeStart = 200;
    const excludeSpan = 500;
    const includeEntries = Array.from({ length: size }, (_, i) => [i, i * 2] as [number, number]);
    const excludeEntries = Array.from({ length: excludeSpan }, (_, i) => {
      const key = i + excludeStart;
      return [key, key * 3] as [number, number];
    });
    const includeTree = buildTree(includeEntries);
    const excludeTree = buildTree(excludeEntries);
    runSubtractionImplementations(includeTree, excludeTree, (calls) => {
      expect(calls.length).toBe(size - excludeSpan);
      expect(calls[0]).toEqual({ key: 0, value: 0 });
      const lastCall = calls[calls.length - 1];
      expect(lastCall.key).toBe(size - 1);
      expect(lastCall.value).toBe((size - 1) * 2);
      expect(calls.filter(c => c.key >= excludeStart && c.key < excludeStart + excludeSpan)).toEqual([]);
    });
  });

  it('forEachKeyNotIn tree with itself visits no keys', () => {
    const entries = Array.from({ length: 20 }, (_, i) => [i, i * 2] as [number, number]);
    const tree = buildTree(entries);
    expectSubtractionCalls(tree, tree, []);
  });

  it('forEachKeyNotIn exclude superset yields empty result', () => {
    const includeTree = buildTree(tuples([2, 200], [3, 300]));
    const excludeTree = buildTree(tuples([1, 100], [2, 200], [3, 300], [4, 400]));
    expectSubtractionCalls(includeTree, excludeTree, []);
  });

  it('forEachKeyNotIn arguments determine surviving keys', () => {
    const tree1 = buildTree(tuples([1, 100], [2, 200], [4, 400]));
    const tree2 = buildTree(tuples([2, 20], [3, 30], [4, 40]));
    expectSubtractionCalls(tree1, tree2, [
      { key: 1, value: 100 },
    ]);
    expectSubtractionCalls(tree2, tree1, [
      { key: 3, value: 30 },
    ]);
  });
}

describe('BTree forEachKeyNotIn early exiting', () => {
  const compare = (a: number, b: number) => a - b;

  const buildTree = (entries: Array<[number, number]>) =>
    new BTreeEx<number, number>(entries, compare, 4);

  it('forEachKeyNotIn returns undefined when callback returns void', () => {
    const includeTree = buildTree(tuples([1, 10], [2, 20], [3, 30]));
    const excludeTree = buildTree(tuples([2, 200]));
    const visited: number[] = [];
    const result = forEachKeyNotIn(includeTree, excludeTree, key => {
      visited.push(key);
    });
    expect(result).toBeUndefined();
    expect(visited).toEqual([1, 3]);
  });

  it('forEachKeyNotIn ignores undefined break values and completes traversal', () => {
    const includeTree = buildTree(tuples([1, 10], [2, 20], [3, 30], [4, 40]));
    const excludeTree = buildTree(tuples([2, 200]));
    const visited: number[] = [];
    const result = forEachKeyNotIn(includeTree, excludeTree, key => {
      visited.push(key);
      return { break: undefined };
    });
    expect(result).toBeUndefined();
    expect(visited).toEqual([1, 3, 4]);
  });

  it('forEachKeyNotIn breaks early when callback returns a value', () => {
    const includeTree = buildTree(tuples([1, 10], [2, 20], [3, 30], [4, 40]));
    const excludeTree = buildTree(tuples([2, 200]));
    const visited: number[] = [];
    const breakResult = forEachKeyNotIn(includeTree, excludeTree, (key, value) => {
      visited.push(key);
      if (key === 3) {
        return { break: { key, value } };
      }
    });
    expect(breakResult).toEqual({ key: 3, value: 30 });
    expect(visited).toEqual([1, 3]);
  });
});

describe('BTree forEachKeyNotIn and subtract input/output validation', () => {
  it('forEachKeyNotIn throws error when comparators differ', () => {
    const includeTree = new BTreeEx<number, number>([[1, 10]], (a, b) => b - a);
    const excludeTree = new BTreeEx<number, number>([[2, 20]], (a, b) => a + b);
    expect(() => forEachKeyNotIn(includeTree, excludeTree, () => {})).toThrow(comparatorErrorMsg);
  });

  it('subtract throws error when comparators differ', () => {
    const includeTree = new BTreeEx<number, number>([[1, 10]], (a, b) => b - a);
    const excludeTree = new BTreeEx<number, number>([[2, 20]], (a, b) => a + b);
    expect(() => subtract<BTreeEx<number, number>, number, number>(includeTree, excludeTree)).toThrow(comparatorErrorMsg);
  });

  it('subtract throws error when branching factors differ', () => {
    const includeTree = new BTreeEx<number, number>([[1, 10]], (a, b) => a - b, 4);
    const excludeTree = new BTreeEx<number, number>([[2, 20]], includeTree._compare, 8);
    expect(() => subtract<BTreeEx<number, number>, number, number>(includeTree, excludeTree)).toThrow(branchingFactorErrorMsg);
  });
});

describe('BTree forEachKeyNotIn fuzz tests', () => {
  const compare = (a: number, b: number) => a - b;
  const FUZZ_SETTINGS = {
    branchingFactors: [4, 5, 32],
    ooms: [2, 3],
    fractionsPerOOM: [0.1, 0.25, 0.5],
    collisionChances: [0.05, 0.1, 0.3],
    timeoutMs: 30_000
  } as const;

  FUZZ_SETTINGS.fractionsPerOOM.forEach(fraction => {
    if (fraction < 0 || fraction > 1)
      throw new Error('FUZZ_SETTINGS.fractionsPerOOM must contain values between 0 and 1');
  });
  FUZZ_SETTINGS.collisionChances.forEach(chance => {
    if (chance < 0 || chance > 1)
      throw new Error('FUZZ_SETTINGS.collisionChances must contain values between 0 and 1');
  });

  jest.setTimeout(FUZZ_SETTINGS.timeoutMs);

  const rng = new MersenneTwister(0xBAD_C0DE);

  for (const maxNodeSize of FUZZ_SETTINGS.branchingFactors) {
    describe(`branching factor ${maxNodeSize}`, () => {
      for (const collisionChance of FUZZ_SETTINGS.collisionChances) {
        for (const oom of FUZZ_SETTINGS.ooms) {
          const size = 5 * Math.pow(10, oom);
          for (const fractionA of FUZZ_SETTINGS.fractionsPerOOM) {
            const fractionB = 1 - fractionA;
            const collisionLabel = collisionChance.toFixed(2);

            it(`size ${size}, fractionA ${fractionA.toFixed(2)}, fractionB ${fractionB.toFixed(2)}, collision ${collisionLabel}`, () => {
              const treeA = new BTreeEx<number, number>([], compare, maxNodeSize);
              const treeB = new BTreeEx<number, number>([], compare, maxNodeSize);

              const keys = makeArray(size, true, 1, collisionChance, rng);

              for (const value of keys) {
                const assignToA = rng.random() < fractionA;
                const assignToB = rng.random() < fractionB;

                if (!assignToA && !assignToB) {
                  if (rng.random() < 0.5)
                    treeA.set(value, value);
                  else
                    treeB.set(value, value);
                  continue;
                }

                if (assignToA)
                  treeA.set(value, value);
                if (assignToB)
                  treeB.set(value, value);
              }

              const aArray = treeA.toArray();
              const bArray = treeB.toArray();
              const bMap = new Map<number, number>(bArray);
              const aMap = new Map<number, number>(aArray);

              const expectedA = aArray.filter(([key]) => !bMap.has(key));
              const expectedB = bArray.filter(([key]) => !aMap.has(key));

              expectSubtractionCalls(treeA, treeB, tuplesToRecords(expectedA));
              expectSubtractionCalls(treeB, treeA, tuplesToRecords(expectedB));

              expect(treeA.toArray()).toEqual(aArray);
              expect(treeB.toArray()).toEqual(bArray);
              treeA.checkValid();
              treeB.checkValid();
            });
          }
        }
      }
    });
  }
});
