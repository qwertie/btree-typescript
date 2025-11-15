import BTree from '../b+tree';
import BTreeEx from '../extended';
import diffAgainst from '../extended/diffAgainst';

var test: (name: string, f: () => void) => void = it;

const FANOUTS = [32, 10, 4] as const;

for (const fanout of FANOUTS) {
  describe(`BTree diffAgainst tests with fanout ${fanout}`, () => {
    runDiffAgainstSuite(fanout);
  });
}

function runDiffAgainstSuite(maxNodeSize: number): void {
  describe('Diff computation', () => {
    let onlyThis: Map<number, number>;
    let onlyOther: Map<number, number>;
    let different: Map<number, string>;
    function reset(): void {
      onlyOther = new Map();
      onlyThis = new Map();
      different = new Map();
    }

    beforeEach(() => reset());

    const OnlyThis = (k: number, v: number) => { onlyThis.set(k, v); };
    const OnlyOther = (k: number, v: number) => { onlyOther.set(k, v); };
    const Different = (k: number, vThis: number, vOther: number) => {
      different.set(k, `vThis: ${vThis}, vOther: ${vOther}`);
    };
    const compare = (a: number, b: number) => a - b;

    function expectMapsEquals<K, V>(mapA: Map<K, V>, mapB: Map<K, V>) {
      const onlyA = [];
      const onlyB = [];
      const different = [];
      mapA.forEach((valueA, keyA) => {
        const valueB = mapB.get(keyA);
        if (valueB === undefined) {
          onlyA.push([keyA, valueA]);
        } else if (!Object.is(valueB, valueB)) {
          different.push([keyA, valueA, valueB]);
        }
      });
      mapB.forEach((valueB, keyB) => {
        const valueA = mapA.get(keyB);
        if (valueA === undefined) {
          onlyA.push([keyB, valueB]);
        }
      });
      expect(onlyA.length).toEqual(0);
      expect(onlyB.length).toEqual(0);
      expect(different.length).toEqual(0);
    }

    function expectDiffCorrect(treeThis: BTreeEx<number, number>, treeOther: BTreeEx<number, number>): void {
      reset();
      treeThis.diffAgainst(treeOther, OnlyThis, OnlyOther, Different);
      const onlyThisT: Map<number, number> = new Map();
      const onlyOtherT: Map<number, number> = new Map();
      const differentT: Map<number, string> = new Map();
      treeThis.forEachPair((kThis, vThis) => {
        if (!treeOther.has(kThis)) {
          onlyThisT.set(kThis, vThis);
        } else {
          const vOther = treeOther.get(kThis);
          if (!Object.is(vThis, vOther))
            differentT.set(kThis, `vThis: ${vThis}, vOther: ${vOther}`);
        }
      });
      treeOther.forEachPair((kOther, vOther) => {
        if (!treeThis.has(kOther)) {
          onlyOtherT.set(kOther, vOther);
        }
      });
      expectMapsEquals(onlyThis, onlyThisT);
      expectMapsEquals(onlyOther, onlyOtherT);
      expectMapsEquals(different, differentT);
    }

    test('Diff of trees with different comparators is an error', () => {
      const treeA = new BTreeEx<number, number>([], compare);
      const treeB = new BTreeEx<number, number>([], (a, b) => b - a);
      expect(() => treeA.diffAgainst(treeB, OnlyThis, OnlyOther, Different)).toThrow('comparators');
    });

    test('Standalone diffAgainst works with core trees', () => {
      const treeA = new BTree<number, number>([[1, 1], [2, 2], [4, 4]], compare, maxNodeSize);
      const treeB = new BTree<number, number>([[1, 1], [2, 22], [3, 3]], compare, maxNodeSize);
      const onlyThisKeys: number[] = [];
      const onlyOtherKeys: number[] = [];
      const differentKeys: number[] = [];
      diffAgainst(
        treeA,
        treeB,
        (k) => { onlyThisKeys.push(k); },
        (k) => { onlyOtherKeys.push(k); },
        (k) => { differentKeys.push(k); }
      );
      expect(onlyThisKeys).toEqual([4]);
      expect(onlyOtherKeys).toEqual([3]);
      expect(differentKeys).toEqual([2]);
    });

    const entriesGroup: [number, number][][] = [[], [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]];
    entriesGroup.forEach(entries => {
      test(`Diff of the same tree ${entries.length > 0 ? '(non-empty)' : '(empty)'}`, () => {
        const tree = new BTreeEx<number, number>(entries, compare, maxNodeSize);
        expectDiffCorrect(tree, tree);
        expect(onlyOther.size).toEqual(0);
        expect(onlyThis.size).toEqual(0);
        expect(different.size).toEqual(0);
      });
    });

    test('Diff of identical trees', () => {
      const treeA = new BTreeEx<number, number>(entriesGroup[1], compare, maxNodeSize);
      const treeB = new BTreeEx<number, number>(entriesGroup[1], compare, maxNodeSize);
      expectDiffCorrect(treeA, treeB);
    });

    [entriesGroup, [...entriesGroup].reverse()].forEach(doubleEntries => {
      test(`Diff of an ${doubleEntries[0].length === 0 ? 'empty' : 'non-empty'} tree and a ${doubleEntries[1].length === 0 ? 'empty' : 'non-empty'} one`, () => {
        const treeA = new BTreeEx<number, number>(doubleEntries[0], compare, maxNodeSize);
        const treeB = new BTreeEx<number, number>(doubleEntries[1], compare, maxNodeSize);
        expectDiffCorrect(treeA, treeB);
      });
    });

    test('Diff of different trees', () => {
      const treeA = new BTreeEx<number, number>(entriesGroup[1], compare, maxNodeSize);
      const treeB = new BTreeEx<number, number>(entriesGroup[1], compare, maxNodeSize);
      treeB.set(-1, -1);
      treeB.delete(2);
      treeB.set(3, 4);
      treeB.set(10, 10);
      expectDiffCorrect(treeA, treeB);
    });

    test('Diff of odds and evens', () => {
      const treeA = new BTreeEx<number, number>([[1, 1], [3, 3], [5, 5], [7, 7]], compare, maxNodeSize);
      const treeB = new BTreeEx<number, number>([[2, 2], [4, 4], [6, 6], [8, 8]], compare, maxNodeSize);
      expectDiffCorrect(treeA, treeB);
      expectDiffCorrect(treeB, treeA);
    });

    function applyChanges(treeA: BTreeEx<number, number>, duplicate: (tree: BTreeEx<number, number>) => BTreeEx<number, number>): void {
      const treeB = duplicate(treeA);
      const maxKey: number = treeA.maxKey()!;
      const onlyInA = -10;
      treeA.set(onlyInA, onlyInA);
      const onlyInBSmall = -1;
      treeB.set(onlyInBSmall, onlyInBSmall);
      const onlyInBLarge = maxKey + 1;
      treeB.set(onlyInBLarge, onlyInBLarge);
      const onlyInAFromDelete = 10;
      treeB.delete(onlyInAFromDelete);
      const differingValue = -100;
      const modifiedInB1 = 3;
      const modifiedInB2 = maxKey - 2;
      treeB.set(modifiedInB1, differingValue);
      treeB.set(modifiedInB2, differingValue);
      treeA.diffAgainst(treeB, OnlyThis, OnlyOther, Different);
      expectDiffCorrect(treeA, treeB);
    }

    function makeLargeTree(size?: number): BTreeEx<number, number> {
      size = size ?? Math.pow(maxNodeSize, 3);
      const tree = new BTreeEx<number, number>([], compare, maxNodeSize);
      for (let i = 0; i < size; i++) {
        tree.set(i, i);
      }
      return tree;
    }

    test('Diff of large trees', () => {
      const tree = makeLargeTree();
      applyChanges(tree, tree => tree.greedyClone());
    });

    test('Diff of cloned trees', () => {
      const tree = makeLargeTree();
      applyChanges(tree, tree => tree.clone());
    });

    test('Diff can early exit', () => {
      const tree = makeLargeTree(100);
      const tree2 = tree.clone();
      tree2.set(-1, -1);
      tree2.delete(10);
      tree2.set(20, -1);
      tree2.set(110, -1);
      const ReturnKey = (key: number) => { return { break: key }; };

      let val = tree.diffAgainst(tree2, OnlyThis, OnlyOther, ReturnKey);
      expect(onlyOther.size).toEqual(1);
      expect(onlyThis.size).toEqual(0);
      expect(val).toEqual(20);
      reset();

      val = tree.diffAgainst(tree2, OnlyThis, ReturnKey, Different);
      expect(different.size).toEqual(0);
      expect(onlyThis.size).toEqual(0);
      expect(val).toEqual(110);
      reset();

      val = tree.diffAgainst(tree2, ReturnKey, OnlyOther, Different);
      expect(different.size).toEqual(1);
      expect(onlyOther.size).toEqual(1);
      expect(val).toEqual(10);
      reset();

      expectDiffCorrect(tree, tree2);
    });
  });
}
