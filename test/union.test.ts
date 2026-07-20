import BTree from '../b+tree';
import BTreeEx from '../extended';
import union from '../extended/union';
import { branchingFactorErrorMsg, comparatorErrorMsg } from '../extended/shared';
import MersenneTwister from 'mersenne-twister';
import {
  expectTreeMatchesEntries,
  forEachFuzzCase,
  makeArray,
  populateFuzzTrees,
  randomInt,
  SetOperationFuzzSettings,
  compareNumbers
} from './shared';

type UnionFn = (key: number, leftValue: number, rightValue: number) => number | undefined;

describe.each([32, 10, 4])('BTree union tests with fanout %i', (maxNodeSize) => {
  const sharesNode = (root: any, targetNode: any): boolean => {
    if (root === targetNode)
      return true;
    if (root.isLeaf)
      return false;
    const children = (root as any).children as any[];
    for (let i = 0; i < children.length; i++) {
      if (sharesNode(children[i], targetNode))
        return true;
    }
    return false;
  };

  const buildTree = (keys: number[], valueScale = 1, valueOffset = 0) => {
    const tree = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);
    for (const key of keys) {
      tree.set(key, key * valueScale + valueOffset);
    }
    return tree;
  };

  const expectRootLeafState = (tree: BTreeEx<number, number>, expectedIsLeaf: boolean) => {
    const root = tree['_root'] as any;
    expect(root.isLeaf).toBe(expectedIsLeaf);
  };

  const range = (start: number, endExclusive: number, step = 1): number[] => {
    const result: number[] = [];
    for (let i = start; i < endExclusive; i += step)
      result.push(i);
    return result;
  };

  type UnionExpectationOptions = {
    after?: (ctx: { result: BTreeEx<number, number>, expected: BTreeEx<number, number> }) => void;
    expectedUnionFn?: UnionFn;
  };

  const sumUnion: UnionFn = (_key, leftValue, rightValue) => leftValue + rightValue;
  const preferLeft: UnionFn = (_key, leftValue) => leftValue;
  const preferRight: UnionFn = (_key, _leftValue, rightValue) => rightValue;
  const failUnion = (message: string): UnionFn => () => {
    throw new Error(message);
  };

  const naiveUnion = (
    left: BTreeEx<number, number>,
    right: BTreeEx<number, number>,
    unionFn: UnionFn
  ) => {
    const expected = left.clone();
    right.forEachPair((key, rightValue) => {
      if (expected.has(key)) {
        const leftValue = expected.get(key)!;
        const unionedValue = unionFn(key, leftValue, rightValue);
        if (unionedValue === undefined) {
          expected.delete(key);
        } else {
          expected.set(key, unionedValue);
        }
      } else {
        expected.set(key, rightValue);
      }
    });
    return expected;
  };

  const expectUnionMatchesBaseline = (
    left: BTreeEx<number, number>,
    right: BTreeEx<number, number>,
    unionFn: UnionFn,
    options: UnionExpectationOptions = {}
  ) => {
    const { expectedUnionFn = unionFn, after } = options;
    const expected = naiveUnion(left, right, expectedUnionFn);
    const result = left.union(right, unionFn);
    expect(result.toArray()).toEqual(expected.toArray());
    result.checkValid();
    expected.checkValid();
    after?.({ result, expected });
    return { result, expected };
  };

  it('Union disjoint roots reuses roots', () => {
    // ensure the roots are not underfilled, as union will try to merge underfilled roots
    const size = maxNodeSize * maxNodeSize;
    const tree1 = buildTree(range(0, size), 1, 0);
    const offset = size * 5;
    const tree2 = buildTree(range(offset, offset + size), 2, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    expectUnionMatchesBaseline(tree1, tree2, failUnion('Union callback should not run for disjoint roots'), {
      after: ({ result }) => {
        const resultRoot = result['_root'] as any;
        expect(sharesNode(resultRoot, tree1['_root'] as any)).toBe(true);
        expect(sharesNode(resultRoot, tree2['_root'] as any)).toBe(true);
      }
    });
  });

  it('Union leaf roots with intersecting keys uses union callback', () => {
    const tree1 = buildTree([1, 2, 4], 10, 0);
    const tree2 = buildTree([2, 3, 5], 100, 0);

    expectRootLeafState(tree1, true);
    expectRootLeafState(tree2, true);

    const calls: Array<{ key: number, leftValue: number, rightValue: number }> = [];

    expectUnionMatchesBaseline(
      tree1,
      tree2,
      (key, leftValue, rightValue) => {
        calls.push({ key, leftValue, rightValue });
        return leftValue + rightValue;
      },
      { expectedUnionFn: sumUnion }
    );
    expect(calls).toEqual([{ key: 2, leftValue: 20, rightValue: 200 }]);
  });

  it('Union leaf roots with disjoint keys', () => {
    const tree1 = buildTree([1, 3, 5], 1, 0);
    const tree2 = buildTree([2, 4, 6], 1, 1000);

    expectRootLeafState(tree1, true);
    expectRootLeafState(tree2, true);

    const { result } = expectUnionMatchesBaseline(
      tree1,
      tree2,
      failUnion('Union callback should not run for disjoint leaf roots')
    );
    expect(result.toArray()).toEqual([
      [1, 1],
      [2, 1002],
      [3, 3],
      [4, 1004],
      [5, 5],
      [6, 1006]
    ]);
  });

  it('Union trees disjoint except for shared maximum key', () => {
    const size = maxNodeSize * 2;
    const tree1 = buildTree(range(0, size), 1, 0);
    const tree2 = buildTree(range(size - 1, size - 1 + size), 3, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let unionCalls = 0;

    const { result } = expectUnionMatchesBaseline(
      tree1,
      tree2,
      (_key, leftValue, rightValue) => {
        unionCalls++;
        return sumUnion(_key, leftValue, rightValue);
      },
      { expectedUnionFn: sumUnion }
    );
    expect(unionCalls).toBe(1);
    expect(result.get(size - 1)).toBe((size - 1) + (size - 1) * 3);
    expect(result.size).toBe(tree1.size + tree2.size - 1);
  });

  it('Union trees where all leaves are disjoint and one tree straddles the other', () => {
    const straddleLength = 3 * 2 * maxNodeSize; // creates multiple leaves on both trees
    const tree1 = buildTree(
      range(0, straddleLength / 3).concat(range((straddleLength / 3) * 2, straddleLength)),
      1
    );
    const tree2 = buildTree(range(straddleLength / 3, (straddleLength / 3) * 2), 3);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    const { result } = expectUnionMatchesBaseline(
      tree1,
      tree2,
      failUnion('Union callback should not run when all leaves are disjoint')
    );
    expect(result.size).toBe(tree1.size + tree2.size);
  });

  it('Union where two-leaf tree intersects leaf-root tree across both leaves', () => {
    const size = maxNodeSize + Math.max(3, Math.floor(maxNodeSize / 2));
    const tree1 = buildTree(range(0, size), 2, 0);
    const tree2 = buildTree([1, Math.floor(size / 2), size - 1], 5, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, true);

    const seenKeys: number[] = [];

    expectUnionMatchesBaseline(
      tree1,
      tree2,
      (key, _leftValue, rightValue) => {
        seenKeys.push(key);
        return rightValue;
      },
      { expectedUnionFn: preferRight }
    );
    expect(seenKeys.sort((a, b) => a - b)).toEqual([1, Math.floor(size / 2), size - 1]);
  });

  it('Union where max key equals min key of other tree', () => {
    const size = maxNodeSize * 2;
    const tree1 = buildTree(range(0, size), 1, 0);
    const tree2 = buildTree(range(size - 1, size - 1 + size), 10, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let unionCalls = 0;

    const { result } = expectUnionMatchesBaseline(
      tree1,
      tree2,
      (_key, _leftValue, rightValue) => {
        unionCalls++;
        return rightValue;
      },
      { expectedUnionFn: preferRight }
    );
    expect(unionCalls).toBe(1);
    expect(result.get(size - 1)).toBe((size - 1) * 10);
    expect(result.size).toBe(tree1.size + tree2.size - 1);
  });

  it('Union odd and even keyed trees', () => {
    const limit = maxNodeSize * 3;
    const treeOdd = buildTree(range(1, limit * 2, 2), 1, 0);
    const treeEven = buildTree(range(0, limit * 2, 2), 1, 100);

    expectRootLeafState(treeOdd, false);
    expectRootLeafState(treeEven, false);

    const { result } = expectUnionMatchesBaseline(
      treeOdd,
      treeEven,
      failUnion('Union callback should not be invoked for disjoint parity sets')
    );
    expect(result.size).toBe(treeOdd.size + treeEven.size);
  });

  it('Union merges disjoint leaf roots into a single leaf', () => {
    const perTree = Math.max(1, Math.floor(maxNodeSize / 2) - 1);
    const keysA = range(1, perTree).map(i => i);
    const keysB = keysA.map(k => k * 1000);
    const tree1 = buildTree(keysA);
    const tree2 = buildTree(keysB);

    expectRootLeafState(tree1, true);
    expectRootLeafState(tree2, true);

    const unioned = tree1.union(tree2, failUnion('Should not be called for disjoint keys'));
    const resultRoot = unioned['_root'] as any;
    const expectedKeys = keysA.concat(keysB).sort(compareNumbers);
    expect(resultRoot.isLeaf).toBe(true);
    expect(resultRoot.keys).toEqual(expectedKeys);
  });

  it('Union combines underfilled non-leaf roots into a filled root', () => {
    const minChildren = Math.floor(maxNodeSize / 2);
    const targetLeavesPerTree = minChildren - 1;
    if (targetLeavesPerTree === 1) {
      return; // cannot test this case with only one leaf per tree
    }
    const entriesPerLeaf = maxNodeSize;
    const buildUnderfilledTree = (startKey: number) => {
      const keys: number[] = [];
      for (let leaf = 0; leaf < targetLeavesPerTree; leaf++) {
        for (let i = 0; i < entriesPerLeaf; i++)
          keys.push(startKey + leaf * entriesPerLeaf + i);
      }
      const tree = buildTree(keys);
      const root = tree['_root'] as any;
      expect(root.isLeaf).toBe(false);
      expect(root.children.length).toBeLessThan(minChildren);
      return { tree, nextKey: startKey + keys.length, childCount: root.children.length };
    };

    const first = buildUnderfilledTree(0);
    const second = buildUnderfilledTree(first.nextKey + maxNodeSize * 10);

    const unioned = first.tree.union(second.tree, failUnion('Should not be called for disjoint keys'));
    const resultRoot = unioned['_root'] as any;
    expect(resultRoot.isLeaf).toBe(false);
    expect(resultRoot.children.length).toBeGreaterThanOrEqual(minChildren);
    expect(resultRoot.children.length).toBe(first.childCount + second.childCount);
  });

  it('Union overlapping prefix equal to branching factor', () => {
    const shared = maxNodeSize;
    const tree1Keys = [
      ...range(0, shared),
      ...range(shared, shared + maxNodeSize)
    ];
    const tree2Keys = [
      ...range(0, shared),
      ...range(shared + maxNodeSize, shared + maxNodeSize * 2)
    ];

    const tree1 = buildTree(tree1Keys, 1, 0);
    const tree2 = buildTree(tree2Keys, 2, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    const unionedKeys: number[] = [];

    expectUnionMatchesBaseline(
      tree1,
      tree2,
      (key, leftValue, rightValue) => {
        unionedKeys.push(key);
        return leftValue + rightValue;
      },
      { expectedUnionFn: sumUnion }
    );
    expect(unionedKeys.sort((a, b) => a - b)).toEqual(range(0, shared));
  });

  it('Union two empty trees', () => {
    const tree1 = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);

    const { result } = expectUnionMatchesBaseline(tree1, tree2, sumUnion);
    expect(result.size).toBe(0);
  });

  it('Union empty tree with non-empty tree', () => {
    const tree1 = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30]], compareNumbers, maxNodeSize);

    const { result: leftUnion } = expectUnionMatchesBaseline(tree1, tree2, sumUnion);
    expect(leftUnion.toArray()).toEqual(tree2.toArray());

    const { result: rightUnion } = expectUnionMatchesBaseline(tree2, tree1, sumUnion);
    expect(rightUnion.toArray()).toEqual(tree2.toArray());
    expect(tree1.toArray()).toEqual([]);
    expect(tree2.toArray()).toEqual([[1, 10], [2, 20], [3, 30]]);
    tree1.checkValid();
    tree2.checkValid();
  });

  it('Union with no overlapping keys', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [3, 30], [5, 50]], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[2, 20], [4, 40], [6, 60]], compareNumbers, maxNodeSize);

    const { result } = expectUnionMatchesBaseline(
      tree1,
      tree2,
      failUnion('Should not be called for non-overlapping keys')
    );

    expect(result.size).toBe(6);
    expect(result.toArray()).toEqual([[1, 10], [2, 20], [3, 30], [4, 40], [5, 50], [6, 60]]);
  });

  it('Union with completely overlapping keys - sum values', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30]], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[1, 5], [2, 15], [3, 25]], compareNumbers, maxNodeSize);

    const { result } = expectUnionMatchesBaseline(tree1, tree2, sumUnion);
    expect(result.size).toBe(tree1.size);
  });

  it('Union with completely overlapping keys - prefer left', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30]], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[1, 100], [2, 200], [3, 300]], compareNumbers, maxNodeSize);

    const { result } = expectUnionMatchesBaseline(tree1, tree2, preferLeft);
    expect(result.toArray()).toEqual(tree1.toArray());
  });

  it('Union with completely overlapping keys - prefer right', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30]], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[1, 100], [2, 200], [3, 300]], compareNumbers, maxNodeSize);

    const { result } = expectUnionMatchesBaseline(tree1, tree2, (_k, _v1, v2) => v2);
    expect(result.toArray()).toEqual(tree2.toArray());
  });

  it('Union with partially overlapping keys', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30], [4, 40]], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[3, 300], [4, 400], [5, 500], [6, 600]], compareNumbers, maxNodeSize);

    const unionedKeys: number[] = [];

    expectUnionMatchesBaseline(
      tree1,
      tree2,
      (key, v1, v2) => {
        unionedKeys.push(key);
        return v1 + v2;
      },
      { expectedUnionFn: sumUnion }
    );
    expect(unionedKeys.sort((a, b) => a - b)).toEqual([3, 4]);
  });

  it('Union with overlapping keys can delete entries', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30], [4, 40]], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[2, 200], [3, 300], [4, 400], [5, 500]], compareNumbers, maxNodeSize);
    const { result } = expectUnionMatchesBaseline(tree1, tree2, (k, v1, v2) => {
      if (k === 3) return undefined;
      return v1 + v2;
    });
    expect(result.has(3)).toBe(false);
  });

  it('Union is called even when values are equal', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20]], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[2, 20], [3, 30]], compareNumbers, maxNodeSize);

    const unionCallLog: Array<{ k: number, v1: number, v2: number }> = [];

    expectUnionMatchesBaseline(
      tree1,
      tree2,
      (k, v1, v2) => {
        unionCallLog.push({ k, v1, v2 });
        return v1;
      },
      { expectedUnionFn: preferLeft }
    );
    expect(unionCallLog).toEqual([{ k: 2, v1: 20, v2: 20 }]);
  });

  it('Union does not mutate input trees', () => {
    const entries1: [number, number][] = [[1, 10], [2, 20], [3, 30]];
    const entries2: [number, number][] = [[2, 200], [3, 300], [4, 400]];
    const tree1 = new BTreeEx<number, number>(entries1, compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>(entries2, compareNumbers, maxNodeSize);

    const snapshot1 = tree1.toArray();
    const snapshot2 = tree2.toArray();

    expectUnionMatchesBaseline(tree1, tree2, sumUnion);

    expect(tree1.toArray()).toEqual(snapshot1);
    expect(tree2.toArray()).toEqual(snapshot2);
    tree1.checkValid();
    tree2.checkValid();
  });

  it('Union large trees with some overlaps', () => {
    const entries1: [number, number][] = range(0, 1000).map(i => [i, i]);
    const entries2: [number, number][] = range(500, 1500).map(i => [i, i * 10]);

    const tree1 = new BTreeEx<number, number>(entries1, compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>(entries2, compareNumbers, maxNodeSize);

    let unionCount = 0;
    expectUnionMatchesBaseline(
      tree1,
      tree2,
      (k, v1, v2) => {
        unionCount++;
        return v1 + v2;
      },
      { expectedUnionFn: sumUnion }
    );
    expect(unionCount).toBe(500);
  });

  it('Union with overlaps at boundaries', () => {
    const tree1 = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);

    for (let i = 0; i < 100; i++) {
      tree1.set(i * 2, i * 2);
    }

    for (let i = 50; i < 150; i++) {
      tree2.set(i, i * 10);
    }

    const unionedKeys: number[] = [];

    expectUnionMatchesBaseline(
      tree1,
      tree2,
      (key, v1, v2) => {
        unionedKeys.push(key);
        return v1 + v2;
      },
      { expectedUnionFn: sumUnion }
    );

    const expectedUnionedKeys = range(50, 150).filter(k => k % 2 === 0);
    expect(unionedKeys.sort((a, b) => a - b)).toEqual(expectedUnionedKeys);
  });

  it('Union result can be modified without affecting inputs', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20]], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[3, 30], [4, 40]], compareNumbers, maxNodeSize);

    const { result } = expectUnionMatchesBaseline(tree1, tree2, sumUnion);

    result.set(1, 100);
    result.set(5, 50);
    result.delete(2);

    expect(tree1.get(1)).toBe(10);
    expect(tree1.get(2)).toBe(20);
    expect(tree1.has(5)).toBe(false);
    expect(tree2.get(3)).toBe(30);
    expect(tree2.get(4)).toBe(40);
    tree1.checkValid();
    tree2.checkValid();
    result.checkValid();
  });

  it('Union tree with itself returns a clone without invoking combineFn', () => {
    const size = maxNodeSize * 2 + 5;
    const tree = buildTree(range(0, size), 3, 1);
    let unionCalls = 0;

    const original = tree.toArray();
    const result = tree.union(tree, (key, leftValue, rightValue) => {
      unionCalls++;
      return sumUnion(key, leftValue, rightValue);
    });
    expect(unionCalls).toBe(0);
    expect(result).not.toBe(tree);
    expect(result.toArray()).toEqual(original);
    expect(tree.toArray()).toEqual(original);
  });

  it('Standalone union short-circuits when given the same tree twice', () => {
    const size = maxNodeSize * 2 + 1;
    const tree = buildTree(range(0, size), 1, 0);
    let unionCalls = 0;
    const original = tree.toArray();
    const result = union(tree, tree, (_key: number, _leftValue: number, _rightValue: number) => {
      unionCalls++;
      return undefined;
    });
    expect(unionCalls).toBe(0);
    expect(result).not.toBe(tree);
    expect(result.toArray()).toEqual(original);
    expect(tree.toArray()).toEqual(original);
  });

  it('Union with disjoint ranges', () => {
    const entries1: [number, number][] = [];
    for (let i = 1; i <= 100; i++) entries1.push([i, i]);
    for (let i = 201; i <= 300; i++) entries1.push([i, i]);

    const entries2: [number, number][] = [];
    for (let i = 101; i <= 200; i++) entries2.push([i, i]);

    const tree1 = new BTreeEx<number, number>(entries1, compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>(entries2, compareNumbers, maxNodeSize);

    const { result } = expectUnionMatchesBaseline(
      tree1,
      tree2,
      failUnion('Should not be called - no overlaps')
    );

    expect(result.size).toBe(300);
    expect(result.get(1)).toBe(1);
    expect(result.get(100)).toBe(100);
    expect(result.get(101)).toBe(101);
    expect(result.get(200)).toBe(200);
    expect(result.get(201)).toBe(201);
    expect(result.get(300)).toBe(300);
  });

  it('Union with single element trees', () => {
    const tree1 = new BTreeEx<number, number>([[5, 50]], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[5, 500]], compareNumbers, maxNodeSize);

    const { result } = expectUnionMatchesBaseline(tree1, tree2, (_k, v1, v2) => Math.max(v1, v2));
    expect(result.toArray()).toEqual([[5, 500]]);
  });

  it('Union excluding all overlapping keys', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30]], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[2, 200], [3, 300], [4, 400]], compareNumbers, maxNodeSize);

    const { result } = expectUnionMatchesBaseline(tree1, tree2, () => undefined);
    expect(result.toArray()).toEqual([[1, 10], [4, 400]]);
  });

  it('Union excluding every key returns an empty tree', () => {
    const keys = range(0, maxNodeSize * 2 + 1);
    const tree1 = buildTree(keys);
    const tree2 = buildTree(keys, 10);

    const { result } = expectUnionMatchesBaseline(tree1, tree2, () => undefined);
    expect(result.size).toBe(0);
    expectRootLeafState(result, true);
  });

  it('Union with large disjoint ranges', () => {
    const tree1 = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);

    for (let i = 0; i <= 10000; i++)
      tree1.set(i, i);
    for (let i = 10001; i <= 20000; i++)
      tree2.set(i, i);

    const { result } = expectUnionMatchesBaseline(
      tree1,
      tree2,
      failUnion('Union callback should not run for disjoint ranges')
    );
    expect(result.size).toBe(tree1.size + tree2.size);
    expect(result.get(0)).toBe(0);
    expect(result.get(20000)).toBe(20000);
  });

  it('Union trees with random overlap', () => {
    const size = 10000;
    const keys1 = makeArray(size, true);
    const keys2 = makeArray(size, true);

    const tree1 = new BTreeEx<number, number>();
    const tree2 = new BTreeEx<number, number>();

    for (let k of keys1)
      tree1.set(k, k);
    for (let k of keys2)
      tree2.set(k, k * 10);

    expectUnionMatchesBaseline(tree1, tree2, preferLeft);
  });

  it('Union trees with ~10% overlap', () => {
    const size = 200;
    const offset = Math.floor(size * 0.9);
    const overlap = size - offset;

    const tree1 = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);

    for (let i = 0; i < size; i++)
      tree1.set(i, i);

    for (let i = 0; i < size; i++) {
      const key = offset + i;
      tree2.set(key, key * 10);
    }

    const { result } = expectUnionMatchesBaseline(tree1, tree2, preferLeft);

    expect(result.size).toBe(size + size - overlap);
    for (let i = 0; i < offset; i++)
      expect(result.get(i)).toBe(i);
    for (let i = offset; i < size; i++)
      expect(result.get(i)).toBe(i);
    const upperBound = offset + size;
    for (let i = size; i < upperBound; i++)
      expect(result.get(i)).toBe(i * 10);
  });
});

describe('BTree union input/output validation', () => {
  test('Union throws error when comparators differ', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10]], (a, b) => b + a);
    const tree2 = new BTreeEx<number, number>([[2, 20]], (a, b) => b - a);

    expect(() => tree1.union(tree2, (_k, v1, v2) => v1 + v2)).toThrow(comparatorErrorMsg);
  });

  test('Union throws error when max node sizes differ', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10]], compareNumbers, 32);
    const tree2 = new BTreeEx<number, number>([[2, 20]], compareNumbers, 33);

    expect(() => tree1.union(tree2, (_k, v1, v2) => v1 + v2)).toThrow(branchingFactorErrorMsg);
  });

  test('Union returns a tree of the same class', () => {
    expect(union(new BTreeEx(), new BTreeEx(), (_k, v1, v2) => v1)).toBeInstanceOf(BTreeEx);
    expect(union(new BTree(), new BTree(), (_k, v1, v2) => v1)).toBeInstanceOf(BTree);
    expect(union(new BTree(), new BTree(), (_k, v1, v2) => v1) instanceof BTreeEx).toBeFalsy();
  });
});

describe('BTree union fuzz tests', () => {
  const unionFn = (_k: number, left: number, _right: number) => left;
  const FUZZ_SETTINGS: SetOperationFuzzSettings = {
    branchingFactors: [4, 5, 32],
    ooms: [0, 1, 2], // [0, 1, 2, 3],
    fractionsPerOOM: [0.1, 0.25, 0.5], // [0.0001, 0.01, 0.1, 0.25, 0.5],
    removalChances: [0, 0.01, 0.1]
  };
  const RANDOM_EDITS_PER_TEST = 20;
  const TIMEOUT_MS = 30_000;

  jest.setTimeout(TIMEOUT_MS);

  const rng = new MersenneTwister(0xBEEFCAFE);

  forEachFuzzCase(FUZZ_SETTINGS, ({ maxNodeSize, size, fractionA, fractionB, removalChance, removalLabel }) => {
    test(`branch ${maxNodeSize}, size ${size}, fractionA ${fractionA.toFixed(2)}, fractionB ${fractionB.toFixed(2)}, removal ${removalLabel}`, () => {
      const treeA = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);
      const treeB = new BTreeEx<number, number>([], compareNumbers, maxNodeSize);
      const [treeAEntries, treeBEntries] = populateFuzzTrees(
        [
          { tree: treeA, fraction: fractionA, removalChance },
          { tree: treeB, fraction: fractionB, removalChance }
        ],
        { rng, size, compare: compareNumbers, maxNodeSize, minAssignmentsPerKey: 1 }
      );

      const unioned = treeA.union(treeB, unionFn);
      unioned.checkValid(true);

      const combinedKeys = new Set<number>();
      treeAEntries.forEach(([key]) => combinedKeys.add(key));
      treeBEntries.forEach(([key]) => combinedKeys.add(key));
      const expected = Array.from(combinedKeys).sort(compareNumbers).map(key => [key, key]);
      expect(unioned.toArray()).toEqual(expected);

      // Union should not have mutated inputs
      expectTreeMatchesEntries(treeA, treeAEntries);
      expectTreeMatchesEntries(treeB, treeBEntries);

      for (let edit = 0; edit < RANDOM_EDITS_PER_TEST; edit++) {
        const key = 1 + randomInt(rng, size);
        const action = rng.random();
        if (action < 0.33) {
          unioned.set(key, key);
        } else if (action < 0.66) {
          unioned.set(key, -key);
        } else {
          unioned.delete(key);
        }
      }

      // Check for shared mutability issues
      expectTreeMatchesEntries(treeA, treeAEntries);
      expectTreeMatchesEntries(treeB, treeBEntries);
    });
  });
});
