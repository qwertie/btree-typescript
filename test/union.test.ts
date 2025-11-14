import BTree from '../b+tree';
import BTreeEx from '../extended';
import union from '../extended/union';
import { branchingFactorErrorMsg, comparatorErrorMsg } from '../extended/shared';
import MersenneTwister from 'mersenne-twister';
import { makeArray, randomInt } from './shared';

var test: (name: string, f: () => void) => void = it;

describe('BTree union tests with fanout 32', testUnion.bind(null, 32));
describe('BTree union tests with fanout 10', testUnion.bind(null, 10));
describe('BTree union tests with fanout 4',  testUnion.bind(null, 4));

type UnionFn = (key: number, leftValue: number, rightValue: number) => number | undefined;

function testUnion(maxNodeSize: number) {
  const compare = (a: number, b: number) => a - b;
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
    const tree = new BTreeEx<number, number>([], compare, maxNodeSize);
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
    expectedUnionFn?: UnionFn;
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
    after?: (ctx: { result: BTreeEx<number, number>, expected: BTreeEx<number, number> }) => void,
    options: UnionExpectationOptions = {}
  ) => {
    const expectedUnionFn = options.expectedUnionFn ?? unionFn;
    const expected = naiveUnion(left, right, expectedUnionFn);
    const result = left.union(right, unionFn);
    expect(result.toArray()).toEqual(expected.toArray());
    result.checkValid();
    expected.checkValid();
    after?.({ result, expected });
    return { result, expected };
  };

  test('Union disjoint roots reuses appended subtree', () => {
    const size = maxNodeSize * 3;
    const tree1 = buildTree(range(0, size), 1, 0);
    const offset = size * 5;
    const tree2 = buildTree(range(offset, offset + size), 2, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let unionCalls = 0;
    const unionFn: UnionFn = () => {
      unionCalls++;
      return 0;
    };

    expectUnionMatchesBaseline(tree1, tree2, unionFn, ({ result }) => {
      const resultRoot = result['_root'] as any;
      expect(sharesNode(resultRoot, tree1['_root'] as any)).toBe(true);
      expect(sharesNode(resultRoot, tree2['_root'] as any)).toBe(true);
    });

    expect(unionCalls).toBe(0);
  });

  test('Union leaf roots with intersecting keys uses union callback', () => {
    const tree1 = buildTree([1, 2, 4], 10, 0);
    const tree2 = buildTree([2, 3, 5], 100, 0);

    expectRootLeafState(tree1, true);
    expectRootLeafState(tree2, true);

    const calls: Array<{ key: number, leftValue: number, rightValue: number }> = [];
    const unionFn: UnionFn = (key, leftValue, rightValue) => {
      calls.push({ key, leftValue, rightValue });
      return leftValue + rightValue;
    };

    expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, leftValue, rightValue) => leftValue + rightValue
    });
    expect(calls).toEqual([{ key: 2, leftValue: 20, rightValue: 200 }]);
  });

  test('Union leaf roots with disjoint keys', () => {
    const tree1 = buildTree([1, 3, 5], 1, 0);
    const tree2 = buildTree([2, 4, 6], 1, 1000);

    expectRootLeafState(tree1, true);
    expectRootLeafState(tree2, true);

    let unionCalls = 0;
    const unionFn: UnionFn = () => {
      unionCalls++;
      return 0;
    };

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, leftValue, rightValue) => leftValue + rightValue
    });
    expect(unionCalls).toBe(0);
    expect(result.toArray()).toEqual([
      [1, 1],
      [2, 1002],
      [3, 3],
      [4, 1004],
      [5, 5],
      [6, 1006]
    ]);
  });

  test('Union trees disjoint except for shared maximum key', () => {
    const size = maxNodeSize * 2;
    const tree1 = buildTree(range(0, size), 1, 0);
    const tree2 = buildTree(range(size - 1, size - 1 + size), 3, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let unionCalls = 0;
    const unionFn: UnionFn = (_key, leftValue, rightValue) => {
      unionCalls++;
      return leftValue + rightValue;
    };

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, leftValue, rightValue) => leftValue + rightValue
    });
    expect(unionCalls).toBe(1);
    expect(result.get(size - 1)).toBe((size - 1) + (size - 1) * 3);
    expect(result.size).toBe(tree1.size + tree2.size - 1);
  });

  test('Union trees where all leaves are disjoint and one tree straddles the other', () => {
    const straddleLength = 3 * 2 * maxNodeSize; // creates multiple leaves on both trees
    const tree1 = buildTree(
      range(0, straddleLength / 3).concat(range((straddleLength / 3) * 2, straddleLength)),
      1
    );
    const tree2 = buildTree(range(straddleLength / 3, (straddleLength / 3) * 2), 3);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let unionCalls = 0;
    const unionFn: UnionFn = (_key, leftValue, rightValue) => {
      unionCalls++;
      return leftValue + rightValue;
    };

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn);
    expect(unionCalls).toBe(0);
    expect(result.size).toBe(tree1.size + tree2.size);
  });

  test('Union where two-leaf tree intersects leaf-root tree across both leaves', () => {
    const size = maxNodeSize + Math.max(3, Math.floor(maxNodeSize / 2));
    const tree1 = buildTree(range(0, size), 2, 0);
    const tree2 = buildTree([1, Math.floor(size / 2), size - 1], 5, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, true);

    const seenKeys: number[] = [];
    const unionFn: UnionFn = (key, _leftValue, rightValue) => {
      seenKeys.push(key);
      return rightValue;
    };

    expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, _leftValue, rightValue) => rightValue
    });
    expect(seenKeys.sort((a, b) => a - b)).toEqual([1, Math.floor(size / 2), size - 1]);
  });

  test('Union where max key equals min key of other tree', () => {
    const size = maxNodeSize * 2;
    const tree1 = buildTree(range(0, size), 1, 0);
    const tree2 = buildTree(range(size - 1, size - 1 + size), 10, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let unionCalls = 0;
    const unionFn: UnionFn = (_key, _leftValue, rightValue) => {
      unionCalls++;
      return rightValue;
    };

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, _leftValue, rightValue) => rightValue
    });
    expect(unionCalls).toBe(1);
    expect(result.get(size - 1)).toBe((size - 1) * 10);
    expect(result.size).toBe(tree1.size + tree2.size - 1);
  });

  test('Union odd and even keyed trees', () => {
    const limit = maxNodeSize * 3;
    const treeOdd = buildTree(range(1, limit * 2, 2), 1, 0);
    const treeEven = buildTree(range(0, limit * 2, 2), 1, 100);

    expectRootLeafState(treeOdd, false);
    expectRootLeafState(treeEven, false);

    let unionCalls = 0;
    const unionFn: UnionFn = () => {
      unionCalls++;
      return 0;
    };

    const { result } = expectUnionMatchesBaseline(treeOdd, treeEven, unionFn);
    expect(unionCalls).toBe(0);
    expect(result.size).toBe(treeOdd.size + treeEven.size);
  });

  test('Union with single boundary overlap prefers right value', () => {
    const size = maxNodeSize * 2;
    const tree1 = buildTree(range(0, size), 1, 0);
    const tree2 = buildTree(range(size - 1, size - 1 + size), 10, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let unionCalls = 0;
    const unionFn: UnionFn = (_key, _leftValue, rightValue) => {
      unionCalls++;
      return rightValue;
    };

    expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, _leftValue, rightValue) => rightValue
    });
    expect(unionCalls).toBe(1);
  });

  test('Union overlapping prefix equal to branching factor', () => {
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
    const unionFn: UnionFn = (key, leftValue, rightValue) => {
      unionedKeys.push(key);
      return leftValue + rightValue;
    };

    expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, leftValue, rightValue) => leftValue + rightValue
    });
    expect(unionedKeys.sort((a, b) => a - b)).toEqual(range(0, shared));
  });

  test('Union two empty trees', () => {
    const tree1 = new BTreeEx<number, number>([], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([], compare, maxNodeSize);
    const unionFn: UnionFn = (_k, v1, v2) => v1 + v2;

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, v1, v2) => v1 + v2
    });
    expect(result.size).toBe(0);
  });

  test('Union empty tree with non-empty tree', () => {
    const tree1 = new BTreeEx<number, number>([], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30]], compare, maxNodeSize);
    const unionFn: UnionFn = (_k, v1, v2) => v1 + v2;

    const { result: leftUnion } = expectUnionMatchesBaseline(tree1, tree2, unionFn);
    expect(leftUnion.toArray()).toEqual(tree2.toArray());

    const { result: rightUnion } = expectUnionMatchesBaseline(tree2, tree1, unionFn);
    expect(rightUnion.toArray()).toEqual(tree2.toArray());
    expect(tree1.toArray()).toEqual([]);
    expect(tree2.toArray()).toEqual([[1, 10], [2, 20], [3, 30]]);
    tree1.checkValid();
    tree2.checkValid();
  });

  test('Union with no overlapping keys', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [3, 30], [5, 50]], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[2, 20], [4, 40], [6, 60]], compare, maxNodeSize);
    const unionFn: UnionFn = () => {
      throw new Error('Should not be called for non-overlapping keys');
    };

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: unionFn
    });

    expect(result.size).toBe(6);
    expect(result.toArray()).toEqual([[1, 10], [2, 20], [3, 30], [4, 40], [5, 50], [6, 60]]);
  });

  test('Union with completely overlapping keys - sum values', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30]], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[1, 5], [2, 15], [3, 25]], compare, maxNodeSize);
    const unionFn: UnionFn = (_k, v1, v2) => v1 + v2;

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, v1, v2) => v1 + v2
    });
    expect(result.size).toBe(tree1.size);
  });

  test('Union with completely overlapping keys - prefer left', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30]], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[1, 100], [2, 200], [3, 300]], compare, maxNodeSize);
    const unionFn: UnionFn = (_k, v1, _v2) => v1;

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, v1, _v2) => v1
    });
    expect(result.toArray()).toEqual(tree1.toArray());
  });

  test('Union with completely overlapping keys - prefer right', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30]], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[1, 100], [2, 200], [3, 300]], compare, maxNodeSize);
    const unionFn: UnionFn = (_k, _v1, v2) => v2;

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn);
    expect(result.toArray()).toEqual(tree2.toArray());
  });

  test('Union with partially overlapping keys', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30], [4, 40]], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[3, 300], [4, 400], [5, 500], [6, 600]], compare, maxNodeSize);

    const unionedKeys: number[] = [];
    const unionFn: UnionFn = (key, v1, v2) => {
      unionedKeys.push(key);
      return v1 + v2;
    };

    expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, v1, v2) => v1 + v2
    });
    expect(unionedKeys.sort((a, b) => a - b)).toEqual([3, 4]);
  });

  test('Union with overlapping keys can delete entries', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30], [4, 40]], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[2, 200], [3, 300], [4, 400], [5, 500]], compare, maxNodeSize);
    const unionFn: UnionFn = (k, v1, v2) => {
      if (k === 3) return undefined;
      return v1 + v2;
    };

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn);
    expect(result.has(3)).toBe(false);
  });

  test('Union is called even when values are equal', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20]], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[2, 20], [3, 30]], compare, maxNodeSize);

    const unionCallLog: Array<{k: number, v1: number, v2: number}> = [];
    const unionFn: UnionFn = (k, v1, v2) => {
      unionCallLog.push({k, v1, v2});
      return v1;
    };

    expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, v1, v2) => v1
    });
    expect(unionCallLog).toEqual([{k: 2, v1: 20, v2: 20}]);
  });

  test('Union does not mutate input trees', () => {
    const entries1: [number, number][] = [[1, 10], [2, 20], [3, 30]];
    const entries2: [number, number][] = [[2, 200], [3, 300], [4, 400]];
    const tree1 = new BTreeEx<number, number>(entries1, compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>(entries2, compare, maxNodeSize);
    const unionFn: UnionFn = (_k, v1, v2) => v1 + v2;

    const snapshot1 = tree1.toArray();
    const snapshot2 = tree2.toArray();

    expectUnionMatchesBaseline(tree1, tree2, unionFn);

    expect(tree1.toArray()).toEqual(snapshot1);
    expect(tree2.toArray()).toEqual(snapshot2);
    tree1.checkValid();
    tree2.checkValid();
  });

  test('Union large trees with some overlaps', () => {
    const entries1: [number, number][] = [];
    for (let i = 0; i < 1000; i++) entries1.push([i, i]);

    const entries2: [number, number][] = [];
    for (let i = 500; i < 1500; i++) entries2.push([i, i * 10]);

    const tree1 = new BTreeEx<number, number>(entries1, compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>(entries2, compare, maxNodeSize);

    let unionCount = 0;
    const unionFn: UnionFn = (k, v1, v2) => {
      unionCount++;
      return v1 + v2;
    };

    expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, v1, v2) => v1 + v2
    });
    expect(unionCount).toBe(500);
  });

  test('Union with overlaps at boundaries', () => {
    const tree1 = new BTreeEx<number, number>([], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([], compare, maxNodeSize);

    for (let i = 0; i < 100; i++) {
      tree1.set(i * 2, i * 2);
    }

    for (let i = 50; i < 150; i++) {
      tree2.set(i, i * 10);
    }

    const unionedKeys: number[] = [];
    const unionFn: UnionFn = (key, v1, v2) => {
      unionedKeys.push(key);
      return v1 + v2;
    };

    expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: (_k, v1, v2) => v1 + v2
    });

    const expectedUnionedKeys = range(50, 150).filter(k => k % 2 === 0);
    expect(unionedKeys.sort((a, b) => a - b)).toEqual(expectedUnionedKeys);
  });

  test('Union result can be modified without affecting inputs', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20]], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[3, 30], [4, 40]], compare, maxNodeSize);
    const unionFn: UnionFn = (_k, v1, v2) => v1 + v2;

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn);

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

  test('Union tree with itself returns a clone without invoking combineFn', () => {
    const size = maxNodeSize * 2 + 5;
    const tree = buildTree(range(0, size), 3, 1);
    let unionCalls = 0;
    const unionFn: UnionFn = (key, leftValue, rightValue) => {
      unionCalls++;
      return leftValue + rightValue;
    };

    const original = tree.toArray();
    const result = tree.union(tree, unionFn);
    expect(unionCalls).toBe(0);
    expect(result).not.toBe(tree);
    expect(result.toArray()).toEqual(original);
    expect(tree.toArray()).toEqual(original);
  });

  test('Standalone union short-circuits when given the same tree twice', () => {
    const size = maxNodeSize * 2 + 1;
    const tree = buildTree(range(0, size), 1, 0);
    let unionCalls = 0;
    const unionFn: UnionFn = (_key, _leftValue, _rightValue) => {
      unionCalls++;
      return undefined;
    };

    const original = tree.toArray();
    const result = union(tree, tree, unionFn);
    expect(unionCalls).toBe(0);
    expect(result).not.toBe(tree);
    expect(result.toArray()).toEqual(original);
    expect(tree.toArray()).toEqual(original);
  });

  test('Union with disjoint ranges', () => {
    const entries1: [number, number][] = [];
    for (let i = 1; i <= 100; i++) entries1.push([i, i]);
    for (let i = 201; i <= 300; i++) entries1.push([i, i]);

    const entries2: [number, number][] = [];
    for (let i = 101; i <= 200; i++) entries2.push([i, i]);

    const tree1 = new BTreeEx<number, number>(entries1, compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>(entries2, compare, maxNodeSize);
    const unionFn: UnionFn = () => {
      throw new Error('Should not be called - no overlaps');
    };

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: unionFn
    });

    expect(result.size).toBe(300);
    expect(result.get(1)).toBe(1);
    expect(result.get(100)).toBe(100);
    expect(result.get(101)).toBe(101);
    expect(result.get(200)).toBe(200);
    expect(result.get(201)).toBe(201);
    expect(result.get(300)).toBe(300);
  });

  test('Union with single element trees', () => {
    const tree1 = new BTreeEx<number, number>([[5, 50]], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[5, 500]], compare, maxNodeSize);
    const unionFn: UnionFn = (_k, v1, v2) => Math.max(v1, v2);

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn);
    expect(result.toArray()).toEqual([[5, 500]]);
  });

  test('Union interleaved keys', () => {
    const tree1 = new BTreeEx<number, number>([], compare, maxNodeSize);
    for (let i = 1; i <= 100; i += 2)
      tree1.set(i, i);

    const tree2 = new BTreeEx<number, number>([], compare, maxNodeSize);
    for (let i = 2; i <= 100; i += 2)
      tree2.set(i, i);

    const unionFn: UnionFn = () => {
      throw new Error('Should not be called - no overlapping keys');
    };

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: unionFn
    });
    expect(result.size).toBe(100);
    for (let i = 1; i <= 100; i++)
      expect(result.get(i)).toBe(i);
  });

  test('Union excluding all overlapping keys', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10], [2, 20], [3, 30]], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([[2, 200], [3, 300], [4, 400]], compare, maxNodeSize);
    const unionFn: UnionFn = () => undefined;

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn);
    expect(result.toArray()).toEqual([[1, 10], [4, 400]]);
  });

  test('Union reuses appended subtree with minimum fanout', () => {
    const tree1 = new BTreeEx<number, number>([], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([], compare, maxNodeSize);

    for (let i = 0; i < 400; i++) {
      tree1.set(i, i);
    }
    for (let i = 400; i < 800; i++) {
      tree2.set(i, i * 2);
    }

    const unionFn: UnionFn = () => {
      throw new Error('Should not be called for disjoint ranges');
    };

    expectUnionMatchesBaseline(tree1, tree2, unionFn, ({ result }) => {
      const resultRoot = result['_root'] as any;
      const tree2Root = tree2['_root'] as any;
      expect(sharesNode(resultRoot, tree2Root)).toBe(true);
    });
  });

  test('Union with large disjoint ranges', () => {
    const tree1 = new BTreeEx<number, number>([], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([], compare, maxNodeSize);

    for (let i = 0; i <= 10000; i++)
      tree1.set(i, i);
    for (let i = 10001; i <= 20000; i++)
      tree2.set(i, i);

    let unionCalls = 0;
    const unionFn: UnionFn = (_k, v1, v2) => {
      unionCalls++;
      return v1 + v2;
    };

    const { result } = expectUnionMatchesBaseline(tree1, tree2, unionFn, undefined, {
      expectedUnionFn: unionFn
    });

    expect(unionCalls).toBe(0);
    expect(result.size).toBe(tree1.size + tree2.size);
    expect(result.get(0)).toBe(0);
    expect(result.get(20000)).toBe(20000);
  });

  test('Union trees with random overlap', () => {
    const size = 10000;
    const keys1 = makeArray(size, true);
    const keys2 = makeArray(size, true);

    const tree1 = new BTreeEx<number, number>();
    const tree2 = new BTreeEx<number, number>();

    for (let k of keys1)
      tree1.set(k, k);
    for (let k of keys2)
      tree2.set(k, k * 10);

    const preferLeft: UnionFn = (_key, leftValue) => leftValue;
    expectUnionMatchesBaseline(tree1, tree2, preferLeft, undefined, {
      expectedUnionFn: preferLeft
    });
  });

  test('Union trees with ~10% overlap', () => {
    const size = 200;
    const offset = Math.floor(size * 0.9);
    const overlap = size - offset;

    const tree1 = new BTreeEx<number, number>([], compare, maxNodeSize);
    const tree2 = new BTreeEx<number, number>([], compare, maxNodeSize);

    for (let i = 0; i < size; i++)
      tree1.set(i, i);

    for (let i = 0; i < size; i++) {
      const key = offset + i;
      tree2.set(key, key * 10);
    }

    const preferLeft: UnionFn = (_key, leftValue) => leftValue;

    const { result } = expectUnionMatchesBaseline(tree1, tree2, preferLeft, undefined, {
      expectedUnionFn: preferLeft
    });

    expect(result.size).toBe(size + size - overlap);
    for (let i = 0; i < offset; i++)
      expect(result.get(i)).toBe(i);
    for (let i = offset; i < size; i++)
      expect(result.get(i)).toBe(i);
    const upperBound = offset + size;
    for (let i = size; i < upperBound; i++)
      expect(result.get(i)).toBe(i * 10);
  });
}

describe('BTree union input/output validation', () => {
    test('Union throws error when comparators differ', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10]], (a, b) => b + a);
    const tree2 = new BTreeEx<number, number>([[2, 20]], (a, b) => b - a);
    const unionFn: UnionFn = (_k, v1, v2) => v1 + v2;

    expect(() => tree1.union(tree2, unionFn)).toThrow(comparatorErrorMsg);
  });

  test('Union throws error when max node sizes differ', () => {
    const compare = (a: number, b: number) => b - a;
    const tree1 = new BTreeEx<number, number>([[1, 10]], compare, 32);
    const tree2 = new BTreeEx<number, number>([[2, 20]], compare, 33);
    const unionFn: UnionFn = (_k, v1, v2) => v1 + v2;

    expect(() => tree1.union(tree2, unionFn)).toThrow(branchingFactorErrorMsg);
  });

  test('Union returns a tree of the same class', () => {
    expect(union(new BTreeEx(), new BTreeEx(), (_k, v1, v2) => v1)).toBeInstanceOf(BTreeEx);
    expect(union(new BTree(), new BTree(), (_k, v1, v2) => v1)).toBeInstanceOf(BTree);
    expect(union(new BTree(), new BTree(), (_k, v1, v2) => v1) instanceof BTreeEx).toBeFalsy();
  });
});

describe('BTree union fuzz tests', () => {
  const compare = (a: number, b: number) => a - b;
  const unionFn = (_k: number, left: number, _right: number) => left;
  const FUZZ_SETTINGS = {
    branchingFactors: [4, 5, 32],
    ooms: [0, 1, 2], // [0, 1, 2, 3],
    fractionsPerOOM: [0.1, 0.25, 0.5], // [0.0001, 0.01, 0.1, 0.25, 0.5],
    collisionChances: [0.1, 0.5], // [0, 0.01, 0.1, 0.5]
  } as const;
  const RANDOM_EDITS_PER_TEST = 20;
  const TIMEOUT_MS = 30_000;

  FUZZ_SETTINGS.fractionsPerOOM.forEach(fraction => {
    if (fraction < 0 || fraction > 1)
      throw new Error('FUZZ_SETTINGS.fractionsPerOOM must contain values between 0 and 1');
  });
  FUZZ_SETTINGS.collisionChances.forEach(chance => {
    if (chance < 0 || chance > 1)
      throw new Error('FUZZ_SETTINGS.collisionChances must contain values between 0 and 1');
  });

  jest.setTimeout(TIMEOUT_MS);

  const rng = new MersenneTwister(0xBEEFCAFE);

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
              const sorted = Array.from(new Set(keys)).sort(compare);

              for (const value of keys) {
                if (rng.random() < fractionA) {
                  treeA.set(value, value);
                } else {
                  treeB.set(value, value);
                }
              }

              const aArray = treeA.toArray();
              const bArray = treeB.toArray();

              const unioned = treeA.union(treeB, unionFn);
              unioned.checkValid();

              expect(unioned.toArray()).toEqual(sorted.map(k => [k, k]));

              // Union should not have mutated inputs
              expect(treeA.toArray()).toEqual(aArray);
              expect(treeB.toArray()).toEqual(bArray);

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
              expect(treeA.toArray()).toEqual(aArray);
              expect(treeB.toArray()).toEqual(bArray);
            });
          }
        }
      }
    });
  }
});
