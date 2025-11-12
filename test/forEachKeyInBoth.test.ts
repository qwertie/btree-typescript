import BTreeEx from '../extended';
import { branchingFactorErrorMsg, comparatorErrorMsg } from '../extended/parallelWalk';
import MersenneTwister from 'mersenne-twister';
import { makeArray } from './shared';

var test: (name: string, f: () => void) => void = it;

describe('BTree forEachKeyInBoth tests with fanout 32', testForEachKeyInBoth.bind(null, 32));
describe('BTree forEachKeyInBoth tests with fanout 10', testForEachKeyInBoth.bind(null, 10));
describe('BTree forEachKeyInBoth tests with fanout 4',  testForEachKeyInBoth.bind(null, 4));

function testForEachKeyInBoth(maxNodeSize: number) {
  const compare = (a: number, b: number) => a - b;

  const buildTree = (entries: Array<[number, number]>) =>
    new BTreeEx<number, number>(entries, compare, maxNodeSize);

  const tuples = (...pairs: Array<[number, number]>) => pairs;

  const collectCalls = (left: BTreeEx<number, number>, right: BTreeEx<number, number>) => {
    const calls: Array<{ key: number, leftValue: number, rightValue: number }> = [];
    left.forEachKeyInBoth(right, (key, leftValue, rightValue) => {
      calls.push({ key, leftValue, rightValue });
    });
    return calls;
  };

  test('forEachKeyInBoth two empty trees', () => {
    const tree1 = buildTree([]);
    const tree2 = buildTree([]);
    expect(collectCalls(tree1, tree2)).toEqual([]);
  });

  test('forEachKeyInBoth empty tree with non-empty tree', () => {
    const tree1 = buildTree([]);
    const tree2 = buildTree(tuples([1, 10], [2, 20], [3, 30]));
    expect(collectCalls(tree1, tree2)).toEqual([]);
    expect(collectCalls(tree2, tree1)).toEqual([]);
  });

  test('forEachKeyInBoth with no overlapping keys', () => {
    const tree1 = buildTree(tuples([1, 10], [3, 30], [5, 50]));
    const tree2 = buildTree(tuples([2, 20], [4, 40], [6, 60]));
    expect(collectCalls(tree1, tree2)).toEqual([]);
  });

  test('forEachKeyInBoth with single overlapping key', () => {
    const tree1 = buildTree(tuples([1, 10], [2, 20], [3, 30]));
    const tree2 = buildTree(tuples([0, 100], [2, 200], [4, 400]));
    expect(collectCalls(tree1, tree2)).toEqual([{ key: 2, leftValue: 20, rightValue: 200 }]);
  });

  test('forEachKeyInBoth with multiple overlapping keys maintains tree contents', () => {
    const leftEntries: Array<[number, number]> = [[1, 10], [2, 20], [3, 30], [4, 40], [5, 50]];
    const rightEntries: Array<[number, number]> = [[0, 100], [2, 200], [4, 400], [6, 600]];
    const tree1 = buildTree(leftEntries);
    const tree2 = buildTree(rightEntries);
    const leftBefore = tree1.toArray();
    const rightBefore = tree2.toArray();
    expect(collectCalls(tree1, tree2)).toEqual([
      { key: 2, leftValue: 20, rightValue: 200 },
      { key: 4, leftValue: 40, rightValue: 400 },
    ]);
    expect(tree1.toArray()).toEqual(leftBefore);
    expect(tree2.toArray()).toEqual(rightBefore);
    tree1.checkValid();
    tree2.checkValid();
  });

  test('forEachKeyInBoth with contiguous overlap yields sorted keys', () => {
    const tree1 = buildTree(tuples([1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]));
    const tree2 = buildTree(tuples([3, 30], [4, 40], [5, 50], [6, 60], [7, 70]));
    const calls = collectCalls(tree1, tree2);
    expect(calls.map(c => c.key)).toEqual([3, 4, 5, 6]);
    expect(calls.map(c => c.leftValue)).toEqual([3, 4, 5, 6]);
    expect(calls.map(c => c.rightValue)).toEqual([30, 40, 50, 60]);
  });

  test('forEachKeyInBoth large overlapping range counts each shared key once', () => {
    const size = 1000;
    const overlapStart = 500;
    const leftEntries = Array.from({ length: size }, (_, i) => [i, i * 3] as [number, number]);
    const rightEntries = Array.from({ length: size }, (_, i) => {
      const key = i + overlapStart;
      return [key, key * 7] as [number, number];
    });
    const tree1 = buildTree(leftEntries);
    const tree2 = buildTree(rightEntries);
    const calls = collectCalls(tree1, tree2);
    expect(calls.length).toBe(size - overlapStart);
    expect(calls[0]).toEqual({
      key: overlapStart,
      leftValue: overlapStart * 3,
      rightValue: overlapStart * 7
    });
    const lastCall = calls[calls.length - 1];
    expect(lastCall.key).toBe(size - 1);
    expect(lastCall.leftValue).toBe((size - 1) * 3);
    expect(lastCall.rightValue).toBe((size - 1) * 7);
  });

  test('forEachKeyInBoth tree with itself visits each key once', () => {
    const entries = Array.from({ length: 20 }, (_, i) => [i, i * 2] as [number, number]);
    const tree = buildTree(entries);
    const calls = collectCalls(tree, tree);
    expect(calls.length).toBe(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      expect(calls[i]).toEqual({ key, leftValue: value, rightValue: value });
    }
  });

  test('forEachKeyInBoth arguments determine left/right values', () => {
    const tree1 = buildTree(tuples([1, 100], [2, 200], [4, 400]));
    const tree2 = buildTree(tuples([2, 20], [3, 30], [4, 40]));
    const callsLeft = collectCalls(tree1, tree2);
    const callsRight = collectCalls(tree2, tree1);
    expect(callsLeft).toEqual([
      { key: 2, leftValue: 200, rightValue: 20 },
      { key: 4, leftValue: 400, rightValue: 40 },
    ]);
    expect(callsRight).toEqual([
      { key: 2, leftValue: 20, rightValue: 200 },
      { key: 4, leftValue: 40, rightValue: 400 },
    ]);
  });
}

describe('BTree forEachKeyInBoth input/output validation', () => {
    test('forEachKeyInBoth throws error when comparators differ', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10]], (a, b) => b + a);
    const tree2 = new BTreeEx<number, number>([[2, 20]], (a, b) => b - a);
    expect(() => tree1.forEachKeyInBoth(tree2, () => {})).toThrow(comparatorErrorMsg);
  });

  test('forEachKeyInBoth throws error when max node sizes differ', () => {
    const compare = (a: number, b: number) => b - a;
    const tree1 = new BTreeEx<number, number>([[1, 10]], compare, 32);
    const tree2 = new BTreeEx<number, number>([[2, 20]], compare, 33);
    expect(() => tree1.forEachKeyInBoth(tree2, () => {})).toThrow(branchingFactorErrorMsg);
  });
});

describe('BTree forEachKeyInBoth fuzz tests', () => {
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

  const rng = new MersenneTwister(0xC0FFEE);

  for (const maxNodeSize of FUZZ_SETTINGS.branchingFactors) {
    describe(`branching factor ${maxNodeSize}`, () => {
      for (const collisionChance of FUZZ_SETTINGS.collisionChances) {
        for (const oom of FUZZ_SETTINGS.ooms) {
          const size = 5 * Math.pow(10, oom);
          for (const fractionA of FUZZ_SETTINGS.fractionsPerOOM) {
            const fractionB = 1 - fractionA;
            const collisionLabel = collisionChance.toFixed(2);

            test(`size ${size}, fractionA ${fractionA.toFixed(2)}, fractionB ${fractionB.toFixed(2)}, collision ${collisionLabel}`, () => {
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
              const expected: Array<[number, number, number]> = [];
              for (const [key, leftValue] of aArray) {
                const rightValue = bMap.get(key);
                if (rightValue !== undefined)
                  expected.push([key, leftValue, rightValue]);
              }

              const actual: Array<[number, number, number]> = [];
              treeA.forEachKeyInBoth(treeB, (key, leftValue, rightValue) => {
                actual.push([key, leftValue, rightValue]);
              });
              expect(actual).toEqual(expected);

              const swappedActual: Array<[number, number, number]> = [];
              treeB.forEachKeyInBoth(treeA, (key, leftValue, rightValue) => {
                swappedActual.push([key, leftValue, rightValue]);
              });
              const swappedExpected = expected.map(([key, leftValue, rightValue]) => [key, rightValue, leftValue]);
              expect(swappedActual).toEqual(swappedExpected);

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
