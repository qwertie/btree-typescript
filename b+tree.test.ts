import BTree, {IMap, defaultComparator, simpleComparator} from './b+tree';
import SortedArray from './sorted-array';
import MersenneTwister from 'mersenne-twister';

var test: (name:string,f:()=>void)=>void = it;

var rand: any = new MersenneTwister(1234);
function randInt(max: number) { return rand.random_int() % max; }
function expectTreeEqualTo(a: BTree, b: SortedArray) {
  a.checkValid();
  expect(a.toArray()).toEqual(b.getArray());
}
function addToBoth<K,V>(a: IMap<K,V>, b: IMap<K,V>, k: K, v: V) {
  expect(a.set(k,v)).toEqual(b.set(k,v));
}

describe('defaultComparator', () =>
{
  const dateA = new Date(Date.UTC(96, 1, 2, 3, 4, 5));
  const dateA2 = new Date(Date.UTC(96, 1, 2, 3, 4, 5));
  const dateB = new Date(Date.UTC(96, 1, 2, 3, 4, 6));
  const values = [
    dateA,
    dateA2,
    dateB,
    dateA.valueOf(),
    '24x',
    '0',
    '1',
    '3',
    'String',
    '10',
    0,
    "NaN",
    NaN,
    Infinity,
    -0,
    -Infinity,
    1,
    10,
    2,
    [],
    '[]',
    [1],
    ['1']
  ];
  const sorted = [-Infinity, -10, -1, -0, 0, 1, 2, 10, Infinity];
  testComparison(defaultComparator, sorted, values, [[dateA, dateA2], [0, -0], [[1], ['1']]]);
});

describe('simpleComparator with non-NaN numbers and null', () =>
{
  const sorted = [-Infinity, -10, -1, -0, 0, null, 1, 2, 10, Infinity];
  testComparison<number | null>(simpleComparator, sorted, sorted, [[-0, 0], [-0, null], [0, null]]);
});

describe('simpleComparator with strings', () =>
{
  const values = [
    '24x',
    '+0',
    '0.0',
    '0',
    '-0',
    '1',
    '3',
    'String',
    '10',
    "NaN",
  ];;
  testComparison<string>(simpleComparator, [], values, []);
});

describe('simpleComparator with Date', () =>
{
  const dateA = new Date(Date.UTC(96, 1, 2, 3, 4, 5));
  const dateA2 = new Date(Date.UTC(96, 1, 2, 3, 4, 5));
  const dateB = new Date(Date.UTC(96, 1, 2, 3, 4, 6));
  const values = [
    dateA,
    dateA2,
    dateB,
    null,
  ];
  testComparison<Date|null>(simpleComparator, [], values, [[dateA, dateA2]]);
});

describe('simpleComparator arrays', () =>
{
  const values = [
    [],
    [1],
    ['1'],
    [2],
  ];
  testComparison<(number|string)[] >(simpleComparator, [], values, [[[1], ['1']]]);
});

/**
 * Tests a comparison function, ensuring it produces a strict partial order over the provided values.
 * Additionally confirms that the comparison function has the correct definition of equality via expectedDuplicates.
 */
function testComparison<T>(comparison: (a: T, b: T) => number, inOrder: T[], values: T[], expectedDuplicates: [T, T][] = []) {
  function compare(a: T, b: T): number {
    const v = comparison(a, b);
    expect(typeof v).toEqual('number');
    if (v !== v)
      console.log('!!!', a, b);
    expect(v === v).toEqual(true); // Not NaN
    return Math.sign(v);
  }

  test('comparison has correct order', () => {
    expect([...inOrder].sort(comparison)).toMatchObject(inOrder);
  });

  test('comparison deffierantes values', () => {
    let duplicates = [];
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        if (compare(values[i], values[j]) === 0) {
          duplicates.push([values[i], values[j]]);
        }
      }
    }
    expect(duplicates).toMatchObject(expectedDuplicates);
  });

  test('comparison forms a strict partial ordering', () => {
    // To be a strict partial order, the function must be:
    // irreflexive: not a < a
    // transitive: if a < b and b < c then a < c
    // asymmetric: if a < b then not b < a

    // Since our comparison has three outputs, we adjust that to, we need to tighten the rules that involve 'not a < b' (where we have two possible outputs) as follows:
    // irreflexive: compare(a, a) === 0
    // transitive: if compare(a, b) < 0 and compare(b, c) < 0 then compare(a, c) < 0
    // asymmetric: sign(compare(a, b)) === -sign(compare(b, a))

    // This can is brute forced in O(n^3) time below:
    // Violations
    const irreflexive = []
    const transitive = []
    const asymmetric = []
    for (const a of values) {
      // irreflexive: compare(a, a) === 0
      if(compare(a, a) !== 0) irreflexive.push(a);
      for (const b of values) {
        for (const c of values) {
          // transitive: if compare(a, b) < 0 and compare(b, c) < 0 then compare(a, c) < 0
          if (compare(a, b) < 0 && compare(b, c) < 0) {
            if(compare(a, c) !== -1) transitive.push([a, b, c]);
          }
        }
        // sign(compare(a, b)) === -sign(compare(b, a))
        if(compare(a, b) !== -compare(b, a)) asymmetric.push([a, b]);
      }
    }
    expect(irreflexive).toEqual([]);
    expect(transitive).toEqual([]);
    expect(asymmetric).toEqual([]);
  });
}

describe('height calculation', () =>
{
  test('Empty tree', () => {
    const tree = new BTree<number>();
    expect(tree.height).toEqual(0);
  });
  test('Single node', () => {
    const tree = new BTree<number>([[0, 0]]);
    expect(tree.height).toEqual(0);
  });
  test('Multiple node, no internal nodes', () => {
    const tree = new BTree<number>([[0, 0], [1, 1]], undefined, 32);
    expect(tree.height).toEqual(0);
  });
  test('Multiple internal nodes', () => {
    for (let expectedHeight = 1; expectedHeight < 5; expectedHeight++) {
      for (let nodeSize = 4; nodeSize < 10; nodeSize++) {
        const numEntries = nodeSize ** expectedHeight;
        const entries: [number, number][] = [];
        for (let i = 0; i < numEntries; i++) {
          entries.push([i, i]);
        }
        const tree = new BTree<number>(entries, undefined, nodeSize);
        expect(tree.height).toEqual(expectedHeight - 1);
      }
    }
  });
});

describe('cached sizes', () =>
{
  function buildTestTree(entryCount: number, maxNodeSize: number) {
    const tree = new BTree<number, number>(undefined, undefined, maxNodeSize);
    for (let i = 0; i < entryCount; i++) {
      tree.set(i, i);
    }
    return tree;
  }

  function expectSize(tree: BTree<number, number>, size: number) {
    expect(tree.size).toBe(size);
    tree.checkValid();
  }

  [4, 6, 8, 16].forEach(nodeSize => {
    describe(`fanout ${nodeSize}`, () => {
      test('checkValid detects root size mismatch', () => {
        const tree = buildTestTree(nodeSize * 8, nodeSize);
        const root = (tree as any)._root;
        expect(root.isLeaf).toBe(false);
        (root as any).size = 0;
        expect(() => tree.checkValid()).toThrow();
      });

      test('checkValid detects mismatched child sizes', () => {
        const tree = buildTestTree(nodeSize * nodeSize * 4, nodeSize);
        const root = (tree as any)._root;
        expect(root.isLeaf).toBe(false);
        const internalChild = (root as any).children.find((child: any) => !child.isLeaf);
        expect(internalChild).toBeDefined();
        (internalChild as any).size = 0;
        expect(() => tree.checkValid()).toThrow();
      });

      test('mutations preserve cached sizes', () => {
        const tree = buildTestTree(nodeSize * 4, nodeSize);
        const initialSize = tree.size;
        const expectedKeys = new Set<number>();
        for (let i = 0; i < initialSize; i++)
          expectedKeys.add(i);
        expectSize(tree, expectedKeys.size);

        // Insert sequential items
        const itemsToAdd = nodeSize * 2;
        for (let i = 0; i < itemsToAdd; i++) {
          const key = initialSize + i;
          tree.set(key, key);
          expectedKeys.add(key);
        }
        expectSize(tree, expectedKeys.size);

        // Delete every third new item
        let deleted = 0;
        for (let i = 0; i < itemsToAdd; i += 3) {
          const key = initialSize + i;
          if (tree.delete(key)) {
            deleted++;
            expectedKeys.delete(key);
          }
        }
        expectSize(tree, expectedKeys.size);

        // Bulk delete a middle range
        const low = Math.floor(initialSize / 2);
        const high = low + nodeSize;
        const rangeDeleted = tree.deleteRange(low, high, true);
        const toRemove = Array.from(expectedKeys).filter(k => k >= low && k <= high);
        expect(rangeDeleted).toBe(toRemove.length);
        toRemove.forEach(k => expectedKeys.delete(k));
        expectSize(tree, expectedKeys.size);

        // Mix insertions and overwrites
        const extra = nodeSize * 5;
        for (let i = 0; i < extra; i++) {
          const insertKey = -i - 1;
          tree.set(insertKey, insertKey);
          expectedKeys.add(insertKey);
          const overwriteKey = i % (initialSize + 1);
          tree.set(overwriteKey, 42); // overwrite existing keys
          expectedKeys.add(overwriteKey);
        }
        expectSize(tree, expectedKeys.size);

        // Clone should preserve size and cached metadata
        const toClone = tree.clone();
        expectSize(toClone, expectedKeys.size);

        // Edit range deletes some entries, patches others
        tree.editRange(-extra, extra, false, (k, v, counter) => {
          if (counter % 11 === 0) {
            expectedKeys.delete(k);
            return { delete: true };
          }
          if (k % 5 === 0)
            return { value: v + 1 };
        });
        expectSize(tree, expectedKeys.size);
      });
    });
  });
});

describe('Simple tests on leaf nodes', () =>
{
  test('A few insertions (fanout 8)', insert8.bind(null, 8));
  test('A few insertions (fanout 4)', insert8.bind(null, 4));
  function insert8(maxNodeSize: number) {
    var items: [number,any][] = [[6,"six"],[7,7],[5,5],[2,"two"],[4,4],[1,"one"],[3,3],[8,8]];
    var tree = new BTree<number>(items, undefined, maxNodeSize);
    var list = new SortedArray(items, undefined);
    tree.checkValid();
    expect(tree.keysArray()).toEqual([1,2,3,4,5,6,7,8]);
    expectTreeEqualTo(tree, list);
  }

  function forExpector(k:number, v:string, counter:number, i:number, first: number = 0) {
    expect(k).toEqual(v.length);
    expect(k - first).toEqual(counter);
    expect(k - first).toEqual(i);
  }
  {
    let tree = new BTree<number,string>([[0,""],[1,"1"],[2,"to"],[3,"tri"],[4,"four"],[5,"five!"]]);
    test('forEach', () => {
      let i = 0;
      expect(tree.forEach(function(this:any, v, k, tree_) {
        expect(tree_).toBe(tree);
        expect((this as any).self).toBe("me");
        forExpector(k, v, i, i++);
      }, {self:"me"})).toBe(6);
    });
    test('forEachPair', () => {
      let i = 0;
      expect(tree.forEachPair(function(k,v,counter) {
        forExpector(k, v, counter - 10, i++);
      }, 10)).toBe(16);
    });
    test('forRange', () => {
      let i = 0;
      expect(tree.forRange(2, 4, false, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++, 2);
      }, 10)).toBe(12);
      i = 0;
      expect(tree.forRange(2, 4, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++, 2);
      }, 10)).toBe(13);
      i = 0;
      expect(tree.forRange(0, 4.5, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++);
      }, 10)).toBe(15);
    });
    test('editRange', () => {
      let i = 0;
      expect(tree.editRange(1, 4, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++, 1);
      }, 10)).toBe(14);
      i = 0;
      expect(tree.editRange(1, 9, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++, 1);
        if (k & 1)  return {delete:true};
        if (k == 2) return {value:"TWO!"};
        if (k >= 4) return {break:"STOP"};
      }, 10)).toBe("STOP");
      expect(tree.toArray()).toEqual([[0,""],[2,"TWO!"],[4,"four"],[5,"five!"]])
    });
  }
  {
    let items: [string,any][] = [["A",1],["B",2],["C",3],["D",4],["E",5],["F",6],["G",7],["H",8]];
    let tree = new BTree<string>(items);
    tree.checkValid();

    test('has() in a leaf node of strings', () => {
      expect(tree.has("!")).toBe(false);
      expect(tree.has("A")).toBe(true);
      expect(tree.has("H")).toBe(true);
      expect(tree.has("Z")).toBe(false);
    });
    test('get() in a leaf node of strings', () => {
      expect(tree.get("!", 7)).toBe(7);
      expect(tree.get("A", 7)).toBe(1);
      expect(tree.get("H", 7)).toBe(8);
      expect(tree.get("Z", 7)).toBe(7);
    });
    test('getRange() in a leaf node', () => {
      expect(tree.getRange("#", "B", false)).toEqual([["A",1]]);
      expect(tree.getRange("#", "B", true)).toEqual([["A",1],["B",2]]);
      expect(tree.getRange("G", "S", true)).toEqual([["G",7],["H",8]]);
    });
    test('iterators work on leaf nodes', () => {
      expect(Array.from(tree.entries())).toEqual(items);
      expect(Array.from(tree.keys())).toEqual(items.map(p => p[0]));
      expect(Array.from(tree.values())).toEqual(items.map(p => p[1]));
    });
    test('try out the reverse iterator', () => {
      expect(Array.from(tree.entriesReversed())).toEqual(items.slice(0).reverse());
    });
    test('minKey() and maxKey()', () => {
      expect(tree.minKey()).toEqual("A");
      expect(tree.maxKey()).toEqual("H");
    });
    test('delete() in a leaf node', () => {
      expect(tree.delete("C")).toBe(true);
      expect(tree.delete("C")).toBe(false);
      expect(tree.delete("H")).toBe(true);
      expect(tree.delete("H")).toBe(false);
      expect(tree.deleteRange(" ","A",false)).toBe(0);
      expect(tree.deleteRange(" ","A",true)).toBe(1);
      expectTreeEqualTo(tree, new SortedArray([["B",2],["D",4],["E",5],["F",6],["G",7]]));
    });
    test('editRange() - again', () => {
      expect(tree.editRange(tree.minKey()!, "F", true, (k,v,counter) => {
        if (k == "D")
          return {value: 44};
        if (k == "E" || k == "G")
          return {delete: true};
        if (k >= "F")
          return {stop: counter+1};
      })).toBe(4);
      expectTreeEqualTo(tree, new SortedArray([["B",2],["D",44],["F",6],["G",7]]));
    });
    test("A clone is independent", () => {
      var tree2 = tree.clone();
      expect(tree.delete("G")).toBe(true);
      expect(tree2.deleteRange("A", "F", false)).toBe(2);
      expect(tree2.deleteRange("A", "F", true)).toBe(1);
      expectTreeEqualTo(tree, new SortedArray([["B",2],["D",44],["F",6]]));
      expectTreeEqualTo(tree2, new SortedArray([["G",7]]));
    });
  }

  test('Can be frozen and unfrozen', () => {
    var tree = new BTree([[1,"one"]]);
    expect(tree.isFrozen).toBe(false);
    tree.freeze();
    expect(tree.isFrozen).toBe(true);
    expect(() => tree.set(2, "two")).toThrowError(/frozen/);
    expect(() => tree.setPairs([[2, "two"]])).toThrowError(/frozen/);
    expect(() => tree.clear()).toThrowError(/frozen/);
    expect(() => tree.delete(1)).toThrowError(/frozen/);
    expect(() => tree.editRange(0,10,true, ()=>{return {delete:true};})).toThrowError(/frozen/);
    expect(tree.toArray()).toEqual([[1, "one"]]);

    tree.unfreeze();
    tree.set(2, "two");
    tree.delete(1);
    expect(tree.toArray()).toEqual([[2, "two"]]);
    tree.clear();
    expect(tree.keysArray()).toEqual([]);
  });

  test('Custom comparator', () => {
    var tree = new BTree(undefined, (a, b) => {
      if (a.name > b.name)
        return 1; // Return a number >0 when a > b
      else if (a.name < b.name)
        return -1; // Return a number <0 when a < b
      else // names are equal (or incomparable)
        return a.age - b.age; // Return >0 when a.age > b.age
    });
    tree.set({name:"Bill", age:17}, "happy");
    tree.set({name:"Rose", age:40}, "busy & stressed");
    tree.set({name:"Bill", age:55}, "recently laid off");
    tree.set({name:"Rose", age:10}, "rambunctious");
    tree.set({name:"Chad", age:18}, "smooth");
    
    // Try editing a key
    tree.set({name: "Bill", age: 17, planet: "Earth"}, "happy");
    
    var list: any[] = [];
    expect(tree.forEachPair((k, v) => {
      list.push(Object.assign({value: v}, k));
    }, 10)).toBe(15);

    expect(list).toEqual([
      { name: "Bill", age: 17, planet: "Earth", value: "happy" },
      { name: "Bill", age: 55, value: "recently laid off" },
      { name: "Chad", age: 18, value: "smooth" },
      { name: "Rose", age: 10, value: "rambunctious" },
      { name: "Rose", age: 40, value: "busy & stressed" },
    ]);
  });
});

// Tests relating to `isShared` and cloning.
// Tests on this subject that do not care about the specific interior structure of the tree
// (and are thus maxNodeSize agnostic) can be added to testBTree to be testing on different branching factors instead.
describe("cloning and sharing tests", () => {
  test("Regression test for failing to propagate shared when removing top two layers", () => {
    // This tests make a full 3 layer tree (height = 2), so use a small branching factor.
    const maxNodeSize = 4;
    const tree = new BTree<number, number>(
      undefined,
      simpleComparator,
      maxNodeSize
    );
    // Build a 3 layer complete tree, all values 0.
    for (
      let index = 0;
      index < maxNodeSize * maxNodeSize * maxNodeSize;
      index++
    ) {
      tree.set(index, 0);
    }
    // Leaf nodes don't count, so this is depth 2
    expect(tree.height).toBe(2);

    // Edit the tree so it has a node in the second layer with exactly one child (key 0).
    tree.deleteRange(1, maxNodeSize * maxNodeSize, false);
    expect(tree.height).toBe(2);

    // Make a clone that should never be mutated.
    const clone = tree.clone();

    // Mutate the original tree in such a way that clone gets mutated due to incorrect is shared tracking.
    // Delete everything outside of the internal node with only one child, so its child becomes the new root.
    tree.deleteRange(maxNodeSize, Number.POSITIVE_INFINITY, false);
    expect(tree.height).toBe(0);

    // Modify original
    tree.set(0, 1);

    // Check that clone is not modified as well:
    expect(clone.get(0)).toBe(0);
  });

  test("Regression test for greedyClone(true) not copying all nodes", () => {
    const maxNodeSize = 4;
    const tree = new BTree<number, number>(
      undefined,
      simpleComparator,
      maxNodeSize
    );
    // Build a 3 layer tree.
    for (
      let index = 0;
      index < maxNodeSize * maxNodeSize + 1;
      index++
    ) {
      tree.set(index, 0);
    }
    // Leaf nodes don't count, so this is depth 2
    expect(tree.height).toBe(2);

    // To trigger the bug, mark children of the root node as shared (not just the root)
    tree.clone().set(1, 1);
    
    const clone = tree.greedyClone(true);

    // The bug was that `force` was not passed down. This meant that non-shared nodes below the second layer would not be cloned.
    // Thus we check that the third layer of this tree did get cloned.
    // Since this depends on private APIs and types,
    // and this package currently has no way to expose them to tests without exporting them from the package,
    // do some private field access and any casts to make it work.
    expect((clone['_root'] as any).children[0].children[0]).not.toBe((tree['_root'] as any).children[0].children[0]);
  });

  test("Regression test for mergeSibling setting isShared", () => {
    // This tests make a 3 layer tree (height = 2), so use a small branching factor.
    const maxNodeSize = 4;
    const tree = new BTree<number, number>(
      undefined,
      simpleComparator,
      maxNodeSize
    );
    // Build a 3 layer tree
    const count = maxNodeSize * maxNodeSize * maxNodeSize;
    for (
      let index = 0;
      index < count;
      index++
    ) {
      tree.set(index, 0);
    }
    // Leaf nodes don't count, so this is depth 2
    expect(tree.height).toBe(2);

    // Delete most of the keys so merging interior nodes is possible, marking all nodes as shared.
    for (
      let index = 0;
      index < count;
      index++
    ) {
      if (index % 4 !== 0) {
        tree.delete(index);
      }
    }

    const deepClone = tree.greedyClone(true);
    const cheapClone = tree.clone();

    // These two clones should remain unchanged forever.
    // The bug this is testing for resulted in the cheap clone getting modified:
    // we will compare it against the deep clone to confirm it does not.

    // Delete a bunch more nodes, causing merging.
    for (
      let index = 0;
      index < count;
      index++
    ) {
      if (index % 16 !== 0) {
        tree.delete(index);
      }
    }

    const different: number[] = [];
    const onDiff = (k: number) => { different.push(k); }
    deepClone.diffAgainst(cheapClone, onDiff, onDiff, onDiff);
    expect(different).toEqual([]);
  });
});

describe('B+ tree with fanout 32', testBTree.bind(null, 32));
describe('B+ tree with fanout 10', testBTree.bind(null, 10));
describe('B+ tree with fanout 4',  testBTree.bind(null, 4));

function testBTree(maxNodeSize: number)
{
  for (let size of [8, 64, 512]) {
    let tree = new BTree<number,number>(undefined, undefined, maxNodeSize);
    let list = new SortedArray<number,number>();
    test(`Insert randomly & toArray [size ${size}]`, () => {
      while (tree.size < size) {
        var key = randInt(size * 2);
        addToBoth(tree, list, key, key);
        expect(tree.size).toEqual(list.size);
      }
      expectTreeEqualTo(tree, list);
    });

    test(`Iteration [size ${size}]`, () => {
      expect(tree.size).toBe(size);
      var it = tree.entries();
      var array = list.getArray(), i = 0;
      for (let next = it.next(); !next.done; next = it.next(), i++) {
        expect(next.value).toEqual(array[i]);
      }
      expect(i).toBe(array.length);
    });

    test(`Reverse iteration [size ${size}]`, () => {
      expect(tree.size).toBe(size);
      var it = tree.entriesReversed();
      var array = list.getArray(), i = array.length-1;
      for (let next = it.next(); !next.done; next = it.next(), i--) {
        expect(next.value).toEqual(array[i]);
      }
      expect(i).toBe(-1);
    });

    test(`Insert with few values [size ${size}]`, () => {
      let list = new SortedArray<number,string|undefined>();
      for (var i = 0; i < size; i++) {
        var key = randInt(size * 2);
        // Use a value only occasionally to stress out the no-values optimization
        list.set(key, key % 10 == 0 ? key.toString() : undefined);
      }
      let tree = new BTree<number,string|undefined>(list.getArray(), undefined, maxNodeSize);
      expectTreeEqualTo(tree, list);
    });
  }

  describe(`Next higher/lower methods`, () => {
    test(`nextLower/nextHigher methods return undefined in an empty tree`, () => {
      const tree = new BTree<number,number>(undefined, undefined, maxNodeSize);
      expect(tree.nextLowerPair(undefined)).toEqual(undefined);
      expect(tree.nextHigherPair(undefined)).toEqual(undefined);
      expect(tree.getPairOrNextLower(1)).toEqual(undefined);
      expect(tree.getPairOrNextHigher(2)).toEqual(undefined);
      
      // This shouldn't make a difference
      tree.set(5, 55);
      tree.delete(5);
      
      expect(tree.nextLowerPair(undefined)).toEqual(undefined);
      expect(tree.nextHigherPair(undefined)).toEqual(undefined);
      expect(tree.nextLowerPair(3)).toEqual(undefined);
      expect(tree.nextHigherPair(4)).toEqual(undefined);
      expect(tree.getPairOrNextLower(5)).toEqual(undefined);
      expect(tree.getPairOrNextHigher(6)).toEqual(undefined);
    });

    for (let size of [5, 10, 300]) {
      // Build a tree and list with pairs whose keys are even numbers: 0, 2, 4, 6, 8, 10...
      const tree = new BTree<number,number>(undefined, undefined, maxNodeSize);
      const pairs: [number,number][] = [];
      for (let i = 0; i < size; i++) {
        const value = i;
        tree.set(i * 2, value);
        pairs.push([i * 2, value]);
      }

      test(`nextLowerPair/nextHigherPair for tree of size ${size}`, () => {
        expect(tree.nextHigherPair(undefined)).toEqual([tree.minKey()!, tree.get(tree.minKey()!)]);
        expect(tree.nextHigherPair(tree.maxKey())).toEqual(undefined);
        for (let i = 0; i < size * 2; i++) {
          if (i > 0) {
            expect(tree.nextLowerPair(i)).toEqual(pairs[((i + 1) >> 1) - 1]);
          }
          if (i < size - 1) {
            expect(tree.nextHigherPair(i)).toEqual(pairs[(i >> 1) + 1]);
          }
        }
        expect(tree.nextLowerPair(undefined)).toEqual([tree.maxKey()!, tree.get(tree.maxKey()!)]);
        expect(tree.nextLowerPair(tree.minKey())).toEqual(undefined);
      })

      test(`getPairOrNextLower/getPairOrNextHigher for tree of size ${size}`, () => {
        for (let i = 0; i < size * 2; i++) {
          if (i > 0) {
            expect(tree.getPairOrNextLower(i)).toEqual(pairs[i >> 1]);
          }
          if (i < size - 1) {
            expect(tree.getPairOrNextHigher(i)).toEqual(pairs[(i + 1) >> 1]);
          }
        }
      })
    }
  });

  for (let size of [6, 36, 216]) {
    test(`setPairs & deleteRange [size ${size}]`, () => {
      // Store numbers in descending order
      var reverseComparator = (a:number, b:number) => b - a;

      // Prepare reference list
      var list = new SortedArray<number,string>([], reverseComparator);
      for (var i = size-1; i >= 0; i--)
        list.set(i, i.toString());
  
      // Add all to tree in the "wrong" order (ascending)
      var tree = new BTree<number,string>(undefined, reverseComparator, maxNodeSize);
      tree.setPairs(list.getArray().slice(0).reverse());
      expectTreeEqualTo(tree, list);

      // Remove most of the items
      expect(tree.deleteRange(size-2, 5, true)).toEqual(size-6);
      expectTreeEqualTo(tree, new SortedArray<number,string>([
        [size-1, (size-1).toString()], [4,"4"], [3,"3"], [2,"2"], [1,"1"], [0,"0"]
      ], reverseComparator));
      expect(tree.deleteRange(size, 0, true)).toEqual(6);
      expect(tree.toArray()).toEqual([]);
    });
  }

  for (let size of [5, 25, 125]) {
    // Ensure standard operations work for various list sizes
    test(`Various operations [starting size ${size}]`, () => {
      var tree = new BTree<number,number|undefined>(undefined, undefined, maxNodeSize);
      var list = new SortedArray<number,number|undefined>();
    
      var i = 0, key;
      for (var i = 0; tree.size < size; i++) {
        addToBoth(tree, list, i, undefined);
        expect(list.size).toEqual(tree.size);
      }
      expectTreeEqualTo(tree, list);
      
      // Add some in the middle and try get()
      for (var i = size; i <= size + size/8; i += 0.5) {
        expect(tree.get(i)).toEqual(list.get(i));
        addToBoth(tree, list, i, i);
      }
      expectTreeEqualTo(tree, list);
      expect(tree.get(-15, 12345)).toBe(12345);
      expect(tree.get(0.5, 12345)).toBe(12345);

      // Try all the iterators...
      expect(Array.from(tree.entries())).toEqual(list.getArray());
      expect(Array.from(tree.keys())).toEqual(list.getArray().map(p => p[0]));
      expect(Array.from(tree.values())).toEqual(list.getArray().map(p => p[1]));
      
      // Try iterating from past the end...
      expect(Array.from(tree.entries(tree.maxKey()!+1))).toEqual([]);
      expect(Array.from(tree.keys(tree.maxKey()!+1))).toEqual([]);
      expect(Array.from(tree.values(tree.maxKey()!+1))).toEqual([]);
      expect(Array.from(tree.entriesReversed(tree.minKey()!-1))).toEqual([]);
      
      // Try some changes that should have no effect
      for (var i = size; i < size + size/8; i += 0.5) {
        expect(tree.setIfNotPresent(i, -i)).toBe(false);
        expect(tree.changeIfPresent(-i, -i)).toBe(false);
      }
      expectTreeEqualTo(tree, list);
      
      // Remove a few items and check against has()
      for (var i = 0; i < 10; i++) {
        key = randInt(size * 2) / 2;
        var has = tree.has(key);
        expect(has).toEqual(list.has(key));
        expect(has).toEqual(tree.delete(key));
        expect(has).toEqual(list.delete(key));
        expectTreeEqualTo(tree, list);
      }

      expectTreeEqualTo(tree, list);
    });
  }

  test('persistent and functional operations', () => {
    var tree = new BTree<number,number|undefined>(undefined, undefined, maxNodeSize);
    var list = new SortedArray<number,number|undefined>();
    
    // Add keys 10 to 5000, step 10
    for (var i = 1; i <= 500; i++)
      addToBoth(tree, list, i*10, i);
    
    // Test reduce()
    expect(tree.reduce((sum, pair) => sum + pair[1]!, 0)).toBe(501*250);
    
    // Test mapValues()
    tree.mapValues(v => v!*10).forEachPair((k, v) => { expect(v).toBe(k) });

    // Perform various kinds of no-ops
    var t1 = tree;
    expect(t1.withKeys([10,20,30], true)           ).toBe(tree);
    expect(t1.withKeys([10,20,30], false)          ).not.toBe(tree);
    expect(t1.withoutKeys([5,105,205], true)       ).toBe(tree);
    expect(t1.without(666, true)                   ).toBe(tree);
    expect(t1.withoutRange(1001, 1010, false, true)).toBe(tree);
    expect(t1.filter(() => true, true)             ).toBe(tree);

    // Make a series of modifications in persistent mode
    var t2 = t1.with(5,5).with(999,999);
    var t3 = t2.without(777).without(7);
    var t4 = t3.withPairs([[60,66],[6,6.6]], false);
    var t5 = t4.withKeys([199,299,399], true);
    var t6 = t4.without(200).without(300).without(400);
    var t7 = t6.withoutKeys([10,20,30], true);
    var t8 = t7.withoutRange(100, 200, false, true);

    // Check that it all worked as expected
    expectTreeEqualTo(t1, list);
    list.set(5, 5);
    list.set(999, 999);
    expectTreeEqualTo(t2, list);
    list.delete(777);
    list.delete(7);
    expectTreeEqualTo(t3, list);
    list.set(6, 6.6);
    expectTreeEqualTo(t4, list);
    list.set(199, undefined);
    list.set(299, undefined);
    list.set(399, undefined);
    expectTreeEqualTo(t5, list);
    for(var k of [199, 299, 399, 200, 300, 400])
      list.delete(k);
    expectTreeEqualTo(t6, list);
    for(var k of [10, 20, 30])
      list.delete(k);
    expectTreeEqualTo(t7, list);
    for(var i = 100; i < 200; i++)
      list.delete(i);
    expectTreeEqualTo(t8, list);

    // Filter out all hundreds
    var t9 = t8.filter(k => k % 100 !== 0, true);
    for (let k = 0; k <= tree.maxKey()!; k += 100)
      list.delete(k);
    expectTreeEqualTo(t9, list);
  });

  describe("Diff computation", () => {
    let onlyThis: Map<number, number>;
    let onlyOther: Map<number, number>;
    let different: Map<number, string>;
    function reset(): void {
      onlyOther = new Map();
      onlyThis = new Map();
      different = new Map();
    }

    beforeEach(() => reset());

    const OnlyThis = (k: number, v: number) => { onlyThis.set(k, v); }
    const OnlyOther = (k: number, v: number) => { onlyOther.set(k, v); }
    const Different = (k: number, vThis: number, vOther: number) => { different.set(k, `vThis: ${vThis}, vOther: ${vOther}`); }
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

    function expectDiffCorrect(treeThis: BTree<number, number>, treeOther: BTree<number, number>): void {
      reset();
      treeThis.diffAgainst(treeOther, OnlyThis, OnlyOther, Different);
      let onlyThisT: Map<number, number> = new Map();
      let onlyOtherT: Map<number, number> = new Map();
      let differentT: Map<number, string> = new Map();
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

    test(`Diff of trees with different comparators is an error`, () => {
      const treeA = new BTree<number, number>([], compare);
      const treeB = new BTree<number, number>([], (a, b) => b - a);
      expect(() => treeA.diffAgainst(treeB, OnlyThis, OnlyOther, Different)).toThrow('comparators');
    });

    const entriesGroup: [number, number][][] = [[], [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]];
    entriesGroup.forEach(entries => {
      test(`Diff of the same tree ${entries.length > 0 ? "(non-empty)" : "(empty)"}`, () => {
        const tree = new BTree<number, number>(entries, compare, maxNodeSize);
        expectDiffCorrect(tree, tree);
        expect(onlyOther.size).toEqual(0);
        expect(onlyThis.size).toEqual(0);
        expect(different.size).toEqual(0);
      });
    });

    test(`Diff of identical trees`, () => {
      const treeA = new BTree<number, number>(entriesGroup[1], compare, maxNodeSize);
      const treeB = new BTree<number, number>(entriesGroup[1], compare, maxNodeSize);
      expectDiffCorrect(treeA, treeB);
    });

    [entriesGroup, [...entriesGroup].reverse()].forEach(doubleEntries => {
      test(`Diff of an ${doubleEntries[0].length === 0 ? 'empty' : 'non-empty'} tree and a ${doubleEntries[1].length === 0 ? 'empty' : 'non-empty'} one`, () => {
        const treeA = new BTree<number, number>(doubleEntries[0], compare, maxNodeSize);
        const treeB = new BTree<number, number>(doubleEntries[1], compare, maxNodeSize);
        expectDiffCorrect(treeA, treeB);
      });
    });

    test(`Diff of different trees`, () => {
      const treeA = new BTree<number, number>(entriesGroup[1], compare, maxNodeSize);
      const treeB = new BTree<number, number>(entriesGroup[1], compare, maxNodeSize);
      treeB.set(-1, -1);
      treeB.delete(2);
      treeB.set(3, 4);
      treeB.set(10, 10);
      expectDiffCorrect(treeA, treeB);
    });

    test(`Diff of odds and evens`, () => {
      const treeA = new BTree<number, number>([[1, 1], [3, 3], [5, 5], [7, 7]], compare, maxNodeSize);
      const treeB = new BTree<number, number>([[2, 2], [4, 4], [6, 6], [8, 8]], compare, maxNodeSize);
      expectDiffCorrect(treeA, treeB);
      expectDiffCorrect(treeB, treeA);
    });

    function applyChanges(treeA: BTree<number, number>, duplicate: (tree: BTree<number, number>) => BTree<number, number>): void {
      const treeB = duplicate(treeA);
      const maxKey: number = treeA.maxKey()!;
      const onlyInA = -10;
      treeA.set(onlyInA, onlyInA);
      const onlyInBSmall = -1;
      treeB.set(onlyInBSmall, onlyInBSmall);
      const onlyInBLarge = maxKey + 1;
      treeB.set(onlyInBLarge, onlyInBLarge);
      const onlyInAFromDelete = 10
      treeB.delete(onlyInAFromDelete);
      const differingValue = -100;
      const modifiedInB1 = 3, modifiedInB2 = maxKey - 2;
      treeB.set(modifiedInB1, differingValue);
      treeB.set(modifiedInB2, differingValue)
      treeA.diffAgainst(treeB, OnlyThis, OnlyOther, Different);
      expectDiffCorrect(treeA, treeB);
    }

    function makeLargeTree(size?: number): BTree<number, number> {
      size = size ?? Math.pow(maxNodeSize, 3);
      const tree = new BTree<number, number>([], compare, maxNodeSize);
      for (let i = 0; i < size; i++) {
        tree.set(i, i);
      }
      return tree;
    }

    test(`Diff of large trees`, () => {
      const tree = makeLargeTree();
      applyChanges(tree, tree => tree.greedyClone());
    });

    test(`Diff of cloned trees`, () => {
      const tree = makeLargeTree();
      applyChanges(tree, tree => tree.clone());
    });

    test(`Diff can early exit`, () => {
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

  test("Issue #2 reproduction", () => {
    const tree = new BTree<number>([], (a, b) => a - b, maxNodeSize);
    for (let i = 0; i <= 1999; i++) {
      tree.set(i, i);
      if (tree.size > 100 && i % 2 == 0) {
        const key = i / 2;
        tree.delete(key);
        tree.checkValid();
        expect(tree.size).toBe(i / 2 + 50);
      }
    }
  });

  test("entriesReversed when highest key does not exist", () => {
    const entries: [{ key: number}, number][] = [[{ key: 10 }, 0], [{ key: 20 }, 0], [{ key: 30 }, 0]];
    const tree = new BTree<{ key: number }, number>(entries, (a, b) => a.key - b.key);
    expect(Array.from(tree.entriesReversed({ key: 40 }))).toEqual(entries.reverse());
  });

  test("nextLowerPair/nextHigherPair and issue #9: nextLowerPair returns highest pair if key is 0", () => {
    const tree = new BTree<number,number>(undefined, undefined, maxNodeSize);
    tree.set(-2, 123);
    tree.set(0, 1234);
    tree.set(2, 12345);
    
    expect(tree.nextLowerPair(-2)).toEqual(undefined);
    expect(tree.nextLowerPair(-1)).toEqual([-2, 123]);
    expect(tree.nextLowerPair(0)).toEqual([-2, 123]);
    expect(tree.nextLowerKey(0)).toBe(-2);
    expect(tree.nextHigherPair(-1)).toEqual([0, 1234]);
    expect(tree.nextHigherPair(0)).toEqual([2, 12345]);
    expect(tree.nextHigherKey(0)).toBe(2);
    expect(tree.nextHigherPair(1)).toEqual([2, 12345]);
    expect(tree.nextHigherPair(2)).toEqual(undefined);
    expect(tree.nextLowerPair(undefined)).toEqual([2, 12345]);
    expect(tree.nextHigherPair(undefined)).toEqual([-2, 123]);

    for (let i = -10; i <= 300; i++) // embiggen the tree
      tree.set(i, i*2);
    expect(tree.nextLowerPair(-1)).toEqual([-2, -4]);
    expect(tree.nextLowerPair(0)).toEqual([-1, -2]);
    expect(tree.nextHigherPair(-1)).toEqual([0, 0]);
    expect(tree.nextHigherPair(0)).toEqual([1, 2]);
    
    expect(tree.nextLowerPair(undefined)).toEqual([300, 600]);
    expect(tree.nextHigherPair(undefined)).toEqual([-10, -20]);
  });

  test('Regression test for invalid default comparator causing malformed trees', () => {
    const key = '24e26f0b-3c1a-47f8-a7a1-e8461ddb69ce6';
    const tree = new BTree<string,{}>(undefined, undefined, maxNodeSize);
    // The defaultComparator was not transitive for these inputs due to comparing numeric strings to each other numerically,
    // but lexically when compared to non-numeric strings. This resulted in keys not being orderable, and the tree behaving incorrectly.
    const inputs: [string,{}][] = [
      [key, {}],
      ['0', {}],
      ['1', {}],
      ['2', {}],
      ['3', {}],
      ['4', {}],
      ['Cheese', {}],
      ['10', {}],
      ['11', {}],
      ['12', {}],
      ['13', {}],
      ['15', {}],
      ['16', {}],
    ];

    for (const [id, node] of inputs) {
      expect( tree.set(id, node)).toBeTruthy();
      tree.checkValid();
      expect(tree.get(key)).not.toBeUndefined();
    }
    expect(tree.get(key)).not.toBeUndefined();
  });
}

describe('BTree intersect tests with fanout 32', testIntersect.bind(null, 32));
describe('BTree intersect tests with fanout 10', testIntersect.bind(null, 10));
describe('BTree intersect tests with fanout 4',  testIntersect.bind(null, 4));

function testIntersect(maxNodeSize: number) {
  const compare = (a: number, b: number) => a - b;

  const buildTree = (entries: Array<[number, number]>) =>
    new BTree<number, number>(entries, compare, maxNodeSize);

  const tuples = (...pairs: Array<[number, number]>) => pairs;

  const collectCalls = (left: BTree<number, number>, right: BTree<number, number>) => {
    const calls: Array<{ key: number, leftValue: number, rightValue: number }> = [];
    left.intersect(right, (key, leftValue, rightValue) => {
      calls.push({ key, leftValue, rightValue });
    });
    return calls;
  };

  test('Intersect two empty trees', () => {
    const tree1 = buildTree([]);
    const tree2 = buildTree([]);
    expect(collectCalls(tree1, tree2)).toEqual([]);
  });

  test('Intersect empty tree with non-empty tree', () => {
    const tree1 = buildTree([]);
    const tree2 = buildTree(tuples([1, 10], [2, 20], [3, 30]));
    expect(collectCalls(tree1, tree2)).toEqual([]);
    expect(collectCalls(tree2, tree1)).toEqual([]);
  });

  test('Intersect with no overlapping keys', () => {
    const tree1 = buildTree(tuples([1, 10], [3, 30], [5, 50]));
    const tree2 = buildTree(tuples([2, 20], [4, 40], [6, 60]));
    expect(collectCalls(tree1, tree2)).toEqual([]);
  });

  test('Intersect with single overlapping key', () => {
    const tree1 = buildTree(tuples([1, 10], [2, 20], [3, 30]));
    const tree2 = buildTree(tuples([0, 100], [2, 200], [4, 400]));
    expect(collectCalls(tree1, tree2)).toEqual([{ key: 2, leftValue: 20, rightValue: 200 }]);
  });

  test('Intersect with multiple overlapping keys maintains tree contents', () => {
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

  test('Intersect with contiguous overlap yields sorted keys', () => {
    const tree1 = buildTree(tuples([1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]));
    const tree2 = buildTree(tuples([3, 30], [4, 40], [5, 50], [6, 60], [7, 70]));
    const calls = collectCalls(tree1, tree2);
    expect(calls.map(c => c.key)).toEqual([3, 4, 5, 6]);
    expect(calls.map(c => c.leftValue)).toEqual([3, 4, 5, 6]);
    expect(calls.map(c => c.rightValue)).toEqual([30, 40, 50, 60]);
  });

  test('Intersect large overlapping range counts each shared key once', () => {
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

  test('Intersect tree with itself visits each key once', () => {
    const entries = Array.from({ length: 20 }, (_, i) => [i, i * 2] as [number, number]);
    const tree = buildTree(entries);
    const calls = collectCalls(tree, tree);
    expect(calls.length).toBe(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      expect(calls[i]).toEqual({ key, leftValue: value, rightValue: value });
    }
  });

  test('Intersect arguments determine left/right values', () => {
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

  test('Intersect throws for comparator mismatch', () => {
    const compareA = (a: number, b: number) => a - b;
    const compareB = (a: number, b: number) => a - b;
    const tree1 = new BTree<number, number>([[1, 1]], compareA, maxNodeSize);
    const tree2 = new BTree<number, number>([[1, 1]], compareB, maxNodeSize);
    expect(() => tree1.intersect(tree2, () => {})).toThrow("Cannot merge BTrees with different comparators.");
  });

  test('Intersect throws for max node size mismatch', () => {
    const tree1 = new BTree<number, number>([[1, 1]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[1, 1]], compare, maxNodeSize + 1);
    expect(() => tree1.intersect(tree2, () => {})).toThrow("Cannot merge BTrees with different max node sizes.");
  });
}

describe('BTree intersect fuzz tests', () => {
  const compare = (a: number, b: number) => a - b;
  const branchingFactors = [4, 8, 16, 32];
  const seeds = [0x1234ABCD, 0x9ABCDEFF];
  const FUZZ_SETTINGS = {
    scenarioBudget: 2,
    iterationsPerScenario: 3,
    maxInsertSize: 200,
    keyRange: 5_000,
    valueRange: 1_000,
    timeoutMs: 8_000
  } as const;

  test('randomized intersects across branching factors', () => {
    jest.setTimeout(FUZZ_SETTINGS.timeoutMs);

    const scenarioConfigs: Array<{ seedBase: number, maxNodeSize: number }> = [];
    for (const seedBase of seeds)
      for (const maxNodeSize of branchingFactors)
        scenarioConfigs.push({ seedBase, maxNodeSize });

    const scenariosToRun = Math.min(FUZZ_SETTINGS.scenarioBudget, scenarioConfigs.length);
    const selectedScenarios = scenarioConfigs.slice(0, scenariosToRun);

    for (const { seedBase, maxNodeSize } of selectedScenarios) {
      const baseSeed = (seedBase ^ (maxNodeSize * 0x9E3779B1)) >>> 0;
      const fuzzRand = new MersenneTwister(baseSeed);
      const nextInt = (limit: number) => limit <= 0 ? 0 : Math.floor(fuzzRand.random() * limit);

      for (let iteration = 0; iteration < FUZZ_SETTINGS.iterationsPerScenario; iteration++) {
        const treeA = new BTree<number, number>([], compare, maxNodeSize);
        const treeB = new BTree<number, number>([], compare, maxNodeSize);
        const mapA = new Map<number, number>();
        const mapB = new Map<number, number>();

        const sizeA = nextInt(FUZZ_SETTINGS.maxInsertSize);
        const sizeB = nextInt(FUZZ_SETTINGS.maxInsertSize);

        for (let i = 0; i < sizeA; i++) {
          const key = nextInt(FUZZ_SETTINGS.keyRange);
          const value = nextInt(FUZZ_SETTINGS.valueRange);
          treeA.set(key, value);
          mapA.set(key, value);
        }

        for (let i = 0; i < sizeB; i++) {
          const key = nextInt(FUZZ_SETTINGS.keyRange);
          const value = nextInt(FUZZ_SETTINGS.valueRange);
          treeB.set(key, value);
          mapB.set(key, value);
        }

        const expected: Array<{ key: number, leftValue: number, rightValue: number }> = [];
        mapA.forEach((leftValue, key) => {
          const rightValue = mapB.get(key);
          if (rightValue !== undefined) {
            expected.push({ key, leftValue, rightValue });
          }
        });
        expected.sort((a, b) => a.key - b.key);

        const actual: Array<{ key: number, leftValue: number, rightValue: number }> = [];
        treeA.intersect(treeB, (key, leftValue, rightValue) => {
          actual.push({ key, leftValue, rightValue });
        });
        expect(actual).toEqual(expected);

        const swapped: Array<{ key: number, leftValue: number, rightValue: number }> = [];
        treeB.intersect(treeA, (key, leftValue, rightValue) => {
          swapped.push({ key, leftValue, rightValue });
        });
        const swapExpected = expected.map(({ key, leftValue, rightValue }) => ({
          key,
          leftValue: rightValue,
          rightValue: leftValue
        }));
        expect(swapped).toEqual(swapExpected);

        const sortedA = Array.from(mapA.entries()).sort((a, b) => a[0] - b[0]);
        const sortedB = Array.from(mapB.entries()).sort((a, b) => a[0] - b[0]);
        expect(treeA.toArray()).toEqual(sortedA);
        expect(treeB.toArray()).toEqual(sortedB);
        treeA.checkValid();
        treeB.checkValid();
      }
    }
  });
});

describe('BTree merge tests with fanout 32', testMerge.bind(null, 32));
describe('BTree merge tests with fanout 10', testMerge.bind(null, 10));
describe('BTree merge tests with fanout 4',  testMerge.bind(null, 4));

function testMerge(maxNodeSize: number) {
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
    const tree = new BTree<number, number>([], compare, maxNodeSize);
    for (const key of keys) {
      tree.set(key, key * valueScale + valueOffset);
    }
    return tree;
  };

  const expectRootLeafState = (tree: BTree<number, number>, expectedIsLeaf: boolean) => {
    const root = tree['_root'] as any;
    expect(root.isLeaf).toBe(expectedIsLeaf);
  };

  const range = (start: number, endExclusive: number, step = 1): number[] => {
    const result: number[] = [];
    for (let i = start; i < endExclusive; i += step)
      result.push(i);
    return result;
  };

  test('Merge disjoint roots', () => {
    const size = maxNodeSize * 3;
    const tree1 = buildTree(range(0, size), 1, 0);
    const offset = size * 5;
    const tree2 = buildTree(range(offset, offset + size), 2, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let mergeCalls = 0;
    const result = tree1.merge(tree2, () => {
      mergeCalls++;
      return 0;
    });

    expect(mergeCalls).toBe(0);
    expect(result.size).toBe(tree1.size + tree2.size);
    const resultRoot = result['_root'] as any;
    expect(sharesNode(resultRoot, tree1['_root'] as any)).toBe(true);
    expect(sharesNode(resultRoot, tree2['_root'] as any)).toBe(true);
  });

  test('Merge leaf roots with intersecting keys', () => {
    const tree1 = buildTree([1, 2, 4], 10, 0);
    const tree2 = buildTree([2, 3, 5], 100, 0);

    expectRootLeafState(tree1, true);
    expectRootLeafState(tree2, true);

    const calls: Array<{ key: number, leftValue: number, rightValue: number }> = [];
    const result = tree1.merge(tree2, (key, leftValue, rightValue) => {
      calls.push({ key, leftValue, rightValue });
      return leftValue + rightValue;
    });

    expect(calls).toEqual([{ key: 2, leftValue: 20, rightValue: 200 }]);
    expect(result.toArray()).toEqual([[1, 10], [2, 220], [3, 300], [4, 40], [5, 500]]);
  });

  test('Merge leaf roots with disjoint keys', () => {
    const tree1 = buildTree([1, 3, 5], 1, 0);
    const tree2 = buildTree([2, 4, 6], 1, 1000);

    expectRootLeafState(tree1, true);
    expectRootLeafState(tree2, true);

    let mergeCalls = 0;
    const result = tree1.merge(tree2, () => {
      mergeCalls++;
      return 0;
    });

    expect(mergeCalls).toBe(0);
    expect(result.toArray()).toEqual([
      [1, 1],
      [2, 1002],
      [3, 3],
      [4, 1004],
      [5, 5],
      [6, 1006]
    ]);
  });

  test('Merge trees disjoint except for shared maximum key', () => {
    const size = maxNodeSize * 2;
    const tree1 = buildTree(range(0, size), 1, 0);
    const tree2 = buildTree(range(size - 1, size - 1 + size), 3, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let mergeCalls = 0;
    const result = tree1.merge(tree2, (key, leftValue, rightValue) => {
      mergeCalls++;
      return leftValue + rightValue;
    });

    expect(mergeCalls).toBe(1);
    expect(result.get(size - 1)).toBe((size - 1) + (size - 1) * 3);
    expect(result.size).toBe(tree1.size + tree2.size - 1);
  });

  test('Merge trees where all leaves are disjoint and one tree straddles the other', () => {
    const straddleLength = 3 * 2 * maxNodeSize; // guaranteed to create multiple leaves on both trees
    const tree1 = buildTree(range(0, straddleLength / 3).concat(range((straddleLength / 3) * 2, straddleLength)), 1);
    const tree2 = buildTree(range(straddleLength / 3, (straddleLength / 3) * 2), 3);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let mergeCalls = 0;
    const result = tree1.merge(tree2, (key, leftValue, rightValue) => {
      mergeCalls++;
      return leftValue + rightValue;
    });

    expect(mergeCalls).toBe(1);
    expect(result.size).toBe(tree1.size + tree2.size);
  });

  test('Merge where two-leaf tree intersects leaf-root tree across both leaves', () => {
    const size = maxNodeSize + Math.max(3, Math.floor(maxNodeSize / 2));
    const tree1 = buildTree(range(0, size), 2, 0);
    const tree2 = buildTree([1, Math.floor(size / 2), size - 1], 5, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, true);

    const seenKeys: number[] = [];
    const result = tree1.merge(tree2, (key, leftValue, rightValue) => {
      seenKeys.push(key);
      return rightValue;
    });

    expect(seenKeys.sort((a, b) => a - b)).toEqual([1, Math.floor(size / 2), size - 1]);
    expect(result.get(1)).toBe(5);
    expect(result.get(Math.floor(size / 2))).toBe(5 * Math.floor(size / 2));
    expect(result.get(size - 1)).toBe(5 * (size - 1));
    expect(result.size).toBe(tree1.size + tree2.size - seenKeys.length);
  });

  test('Merge where max key equals min key of other tree', () => {
    const size = maxNodeSize * 2;
    const tree1 = buildTree(range(0, size), 1, 0);
    const tree2 = buildTree(range(size - 1, size - 1 + size), 10, 0);

    expectRootLeafState(tree1, false);
    expectRootLeafState(tree2, false);

    let mergeCalls = 0;
    const result = tree1.merge(tree2, (key, leftValue, rightValue) => {
      mergeCalls++;
      return rightValue;
    });

    expect(mergeCalls).toBe(1);
    expect(result.get(size - 1)).toBe((size - 1) * 10);
    expect(result.size).toBe(tree1.size + tree2.size - 1);
  });

  test('Merge odd and even keyed trees', () => {
    const limit = maxNodeSize * 3;
    const treeOdd = buildTree(range(1, limit * 2, 2), 1, 0);
    const treeEven = buildTree(range(0, limit * 2, 2), 1, 100);

    expectRootLeafState(treeOdd, false);
    expectRootLeafState(treeEven, false);

    let mergeCalls = 0;
    const result = treeOdd.merge(treeEven, () => {
      mergeCalls++;
      return 0;
    });

    expect(mergeCalls).toBe(0);
    expect(result.size).toBe(treeOdd.size + treeEven.size);
  });

  test('Merge overlapping prefix equal to branching factor', () => {
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

    const mergedKeys: number[] = [];
    const result = tree1.merge(tree2, (key, leftValue, rightValue) => {
      mergedKeys.push(key);
      return leftValue + rightValue;
    });

    expect(mergedKeys.sort((a, b) => a - b)).toEqual(range(0, shared));
    const expected = [
      ...range(0, shared).map(k => [k, k + k * 2]),
      ...range(shared, shared + maxNodeSize).map(k => [k, k]),
      ...range(shared + maxNodeSize, shared + maxNodeSize * 2).map(k => [k, k * 2])
    ];
    expect(result.toArray()).toEqual(expected);
    expect(result.size).toBe(tree1.size + tree2.size - shared);
  });

  test('Merge two empty trees', () => {
    const tree1 = new BTree<number, number>([], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([], compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => v1 + v2;

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(0);
    expect(result.toArray()).toEqual([]);
  });

  test('Merge empty tree with non-empty tree', () => {
    const tree1 = new BTree<number, number>([], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[1, 10], [2, 20], [3, 30]], compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => v1 + v2;

    const result1 = tree1.merge(tree2, mergeFunc);
    const result2 = tree2.merge(tree1, mergeFunc);

    expect(result1.toArray()).toEqual([[1, 10], [2, 20], [3, 30]]);
    expect(result2.toArray()).toEqual([[1, 10], [2, 20], [3, 30]]);
  });

  test('Merge with no overlapping keys', () => {
    const tree1 = new BTree<number, number>([[1, 10], [3, 30], [5, 50]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[2, 20], [4, 40], [6, 60]], compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => {
      throw new Error('Should not be called for non-overlapping keys');
    };

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(6);
    expect(result.toArray()).toEqual([[1, 10], [2, 20], [3, 30], [4, 40], [5, 50], [6, 60]]);
  });

  test('Merge with completely overlapping keys - sum values', () => {
    const tree1 = new BTree<number, number>([[1, 10], [2, 20], [3, 30]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[1, 5], [2, 15], [3, 25]], compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => v1 + v2;

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(3);
    expect(result.toArray()).toEqual([[1, 15], [2, 35], [3, 55]]);
  });

  test('Merge with completely overlapping keys - prefer left', () => {
    const tree1 = new BTree<number, number>([[1, 10], [2, 20], [3, 30]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[1, 100], [2, 200], [3, 300]], compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => v1;

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(3);
    expect(result.toArray()).toEqual([[1, 10], [2, 20], [3, 30]]);
  });

  test('Merge with completely overlapping keys - prefer right', () => {
    const tree1 = new BTree<number, number>([[1, 10], [2, 20], [3, 30]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[1, 100], [2, 200], [3, 300]], compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => v2;

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(3);
    expect(result.toArray()).toEqual([[1, 100], [2, 200], [3, 300]]);
  });

  test('Merge with partially overlapping keys', () => {
    const tree1 = new BTree<number, number>([[1, 10], [2, 20], [3, 30], [4, 40]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[3, 300], [4, 400], [5, 500], [6, 600]], compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => v1 + v2;

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(6);
    expect(result.toArray()).toEqual([[1, 10], [2, 20], [3, 330], [4, 440], [5, 500], [6, 600]]);
  });

  test('Merge with overlapping keys - exclude some keys via undefined', () => {
    const tree1 = new BTree<number, number>([[1, 10], [2, 20], [3, 30], [4, 40]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[2, 200], [3, 300], [4, 400], [5, 500]], compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => {
      // Exclude key 3 by returning undefined
      if (k === 3) return undefined;
      return v1 + v2;
    };

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(4);  // Keys 1, 2, 4, 5 (key 3 excluded)
    expect(result.toArray()).toEqual([[1, 10], [2, 220], [4, 440], [5, 500]]);
  });

  test('Merge is called even when values are equal', () => {
    const tree1 = new BTree<number, number>([[1, 10], [2, 20]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[2, 20], [3, 30]], compare, maxNodeSize);

    const mergeCallLog: Array<{k: number, v1: number, v2: number}> = [];
    const mergeFunc = (k: number, v1: number, v2: number) => {
      mergeCallLog.push({k, v1, v2});
      return v1;
    };

    const result = tree1.merge(tree2, mergeFunc);

    expect(mergeCallLog).toEqual([{k: 2, v1: 20, v2: 20}]);
    expect(result.toArray()).toEqual([[1, 10], [2, 20], [3, 30]]);
  });

  test('Merge does not mutate input trees', () => {
    const entries1: [number, number][] = [[1, 10], [2, 20], [3, 30]];
    const entries2: [number, number][] = [[2, 200], [3, 300], [4, 400]];
    const tree1 = new BTree<number, number>(entries1, compare, maxNodeSize);
    const tree2 = new BTree<number, number>(entries2, compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => v1 + v2;

    const result = tree1.merge(tree2, mergeFunc);

    // Verify original trees are unchanged
    expect(tree1.toArray()).toEqual(entries1);
    expect(tree2.toArray()).toEqual(entries2);

    // Verify result is correct
    expect(result.toArray()).toEqual([[1, 10], [2, 220], [3, 330], [4, 400]]);
  });

  test('Merge with disjoint ranges', () => {
    // Tree with keys 1-100 and 201-300
    const entries1: [number, number][] = [];
    for (let i = 1; i <= 100; i++) entries1.push([i, i]);
    for (let i = 201; i <= 300; i++) entries1.push([i, i]);

    // Tree with keys 101-200
    const entries2: [number, number][] = [];
    for (let i = 101; i <= 200; i++) entries2.push([i, i]);

    const tree1 = new BTree<number, number>(entries1, compare, maxNodeSize);
    const tree2 = new BTree<number, number>(entries2, compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => {
      throw new Error('Should not be called - no overlaps');
    };

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(300);
    // Check first few, last few, and boundaries
    expect(result.get(1)).toBe(1);
    expect(result.get(100)).toBe(100);
    expect(result.get(101)).toBe(101);
    expect(result.get(200)).toBe(200);
    expect(result.get(201)).toBe(201);
    expect(result.get(300)).toBe(300);
    result.checkValid();
  });

  test('Merge large trees with some overlaps', () => {
    // Tree 1: keys 0-999
    const entries1: [number, number][] = [];
    for (let i = 0; i < 1000; i++) entries1.push([i, i]);

    // Tree 2: keys 500-1499
    const entries2: [number, number][] = [];
    for (let i = 500; i < 1500; i++) entries2.push([i, i * 10]);

    const tree1 = new BTree<number, number>(entries1, compare, maxNodeSize);
    const tree2 = new BTree<number, number>(entries2, compare, maxNodeSize);

    let mergeCount = 0;
    const mergeFunc = (k: number, v1: number, v2: number) => {
      mergeCount++;
      return v1 + v2; // Sum the values
    };

    const result = tree1.merge(tree2, mergeFunc);

    // Verify merge was called for overlapping keys (500-999)
    expect(mergeCount).toBe(500);

    // Total unique keys: 1500
    expect(result.size).toBe(1500);

    // Check various ranges
    expect(result.get(0)).toBe(0); // Only in tree1
    expect(result.get(499)).toBe(499); // Only in tree1
    expect(result.get(500)).toBe(500 + 5000); // In both: 500 + (500*10)
    expect(result.get(999)).toBe(999 + 9990); // In both: 999 + (999*10)
    expect(result.get(1000)).toBe(10000); // Only in tree2
    expect(result.get(1499)).toBe(14990); // Only in tree2

    result.checkValid();
  });

  test('Merge with overlaps at boundaries', () => {
    // Test edge case where overlaps occur at the boundaries of node ranges
    const tree1 = new BTree<number, number>([], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([], compare, maxNodeSize);

    // Fill tree1 with even numbers
    for (let i = 0; i < 100; i++) {
      tree1.set(i * 2, i * 2);
    }

    // Fill tree2 with numbers in a different pattern
    for (let i = 50; i < 150; i++) {
      tree2.set(i, i * 10);
    }

    let mergeCallCount = 0;
    const mergeFunc = (k: number, v1: number, v2: number) => {
      mergeCallCount++;
      expect(k % 2).toBe(0); // Only even keys should overlap
      return v1 + v2;
    };

    const result = tree1.merge(tree2, mergeFunc);

    // Keys 100, 102, 104, ..., 198 overlap (50 keys)
    expect(mergeCallCount).toBe(50);

    result.checkValid();
  });

  test('Merge throws error when comparators differ', () => {
    const tree1 = new BTree<number, number>([[1, 10]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[2, 20]], (a, b) => b - a, maxNodeSize); // Reverse comparator
    const mergeFunc = (k: number, v1: number, v2: number) => v1 + v2;

    expect(() => tree1.merge(tree2, mergeFunc)).toThrow();
  });

  test('Merge throws error when max node sizes differ', () => {
    const otherFanout = maxNodeSize === 32 ? 16 : 32;
    const tree1 = new BTree<number, number>([[1, 10]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[2, 20]], compare, otherFanout);
    const mergeFunc = (k: number, v1: number, v2: number) => v1 + v2;

    expect(() => tree1.merge(tree2, mergeFunc)).toThrow();
  });

  test('Merge result can be modified without affecting inputs', () => {
    const tree1 = new BTree<number, number>([[1, 10], [2, 20]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[3, 30], [4, 40]], compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => v1 + v2;

    const result = tree1.merge(tree2, mergeFunc);

    // Modify result
    result.set(1, 100);
    result.set(5, 50);
    result.delete(2);

    // Verify inputs unchanged
    expect(tree1.get(1)).toBe(10);
    expect(tree1.get(2)).toBe(20);
    expect(tree1.has(5)).toBe(false);
    expect(tree2.get(3)).toBe(30);
    expect(tree2.get(4)).toBe(40);
  });

  test('Merge with single element trees', () => {
    const tree1 = new BTree<number, number>([[5, 50]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[5, 500]], compare, maxNodeSize);
    const mergeFunc = (k: number, v1: number, v2: number) => Math.max(v1, v2);

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(1);
    expect(result.get(5)).toBe(500);
  });

  test('Merge interleaved keys', () => {
    // Tree1 has keys: 1, 3, 5, 7, 9, ...
    const tree1 = new BTree<number, number>([], compare, maxNodeSize);
    for (let i = 1; i <= 100; i += 2) {
      tree1.set(i, i);
    }

    // Tree2 has keys: 2, 4, 6, 8, 10, ...
    const tree2 = new BTree<number, number>([], compare, maxNodeSize);
    for (let i = 2; i <= 100; i += 2) {
      tree2.set(i, i);
    }

    const mergeFunc = (k: number, v1: number, v2: number) => {
      throw new Error('Should not be called - no overlapping keys');
    };

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(100);
    for (let i = 1; i <= 100; i++) {
      expect(result.get(i)).toBe(i);
    }
    result.checkValid();
  });

  test('Merge excluding all overlapping keys', () => {
    const tree1 = new BTree<number, number>([[1, 10], [2, 20], [3, 30]], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([[2, 200], [3, 300], [4, 400]], compare, maxNodeSize);
    // Exclude all overlapping keys
    const mergeFunc = (k: number, v1: number, v2: number) => undefined;

    const result = tree1.merge(tree2, mergeFunc);

    // Only non-overlapping keys remain
    expect(result.toArray()).toEqual([[1, 10], [4, 400]]);
  });

  test('Merge reuses appended subtree with minimum fanout', () => {
    const tree1 = new BTree<number, number>([], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([], compare, maxNodeSize);

    for (let i = 0; i < 400; i++) {
      tree1.set(i, i);
    }
    for (let i = 400; i < 800; i++) {
      tree2.set(i, i * 2);
    }

    const mergeFunc = (k: number, v1: number, v2: number) => {
      throw new Error('Should not be called for disjoint ranges');
    };

    const result = tree1.merge(tree2, mergeFunc);

    expect(result.size).toBe(tree1.size + tree2.size);
    const resultRoot = result['_root'] as any;
    const tree2Root = tree2['_root'] as any;
    expect(sharesNode(resultRoot, tree2Root)).toBe(true);
    result.checkValid();
  });

  test('Merge with large disjoint ranges', () => {
    const tree1 = new BTree<number, number>([], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([], compare, maxNodeSize);

    for (let i = 0; i <= 10000; i++) {
      tree1.set(i, i);
    }
    for (let i = 10001; i <= 20000; i++) {
      tree2.set(i, i);
    }

    let mergeCalls = 0;
    const mergeFunc = (k: number, v1: number, v2: number) => {
      mergeCalls++;
      return v1 + v2;
    };

    const result = tree1.merge(tree2, mergeFunc);

    expect(mergeCalls).toBe(0);
    expect(result.size).toBe(tree1.size + tree2.size);
    expect(result.get(0)).toBe(0);
    expect(result.get(20000)).toBe(20000);
    const resultRoot = result['_root'] as any;
    const tree2Root = tree2['_root'] as any;
    expect(sharesNode(resultRoot, tree2Root)).toBe(true);
    result.checkValid();
  });

  test('Merge trees with ~10% overlap', () => {
    const size = 200;
    const offset = Math.floor(size * 0.9);
    const overlap = size - offset;

    const tree1 = new BTree<number, number>([], compare, maxNodeSize);
    const tree2 = new BTree<number, number>([], compare, maxNodeSize);

    for (let i = 0; i < size; i++) {
      tree1.set(i, i);
    }
    for (let i = 0; i < size; i++) {
      const key = offset + i;
      tree2.set(key, key * 10);
    }

    const preferLeft = (_k: number, v1: number, _v2: number) => v1;
    const result = tree1.merge(tree2, preferLeft);

    expect(result.size).toBe(size + size - overlap);
    result.checkValid();

    for (let i = 0; i < offset; i++) {
      expect(result.get(i)).toBe(i);
    }
    for (let i = offset; i < size; i++) {
      expect(result.get(i)).toBe(i);
    }
    const upperBound = offset + size;
    for (let i = size; i < upperBound; i++) {
      expect(result.get(i)).toBe(i * 10);
    }

    expect(tree1.size).toBe(size);
    expect(tree2.size).toBe(size);
  });
}

describe('BTree merge fuzz tests', () => {
  const compare = (a: number, b: number) => a - b;
  const branchingFactors = [4, 8, 16, 32];
  const seeds = [0x12345678, 0x9ABCDEF];
  const FUZZ_SETTINGS = {
    scenarioBudget: 1,          // Increase to explore more seed/fanout combinations.
    iterationsPerScenario: 1,   // Increase to deepen each scenario.
    maxInsertSize: 200,         // Maximum keys inserted per iteration.
    keyRange: 10_000,           // Range of key distribution.
    valueRange: 1_000,          // Range of value distribution.
    sampleChecks: 3,            // Number of random spot-checks per result.
    timeoutMs: 10_000           // Jest timeout for the fuzz test.
  } as const;

  const strategies = [
    {
      name: 'prefer-left',
      fn: (k: number, left: number, _right: number) => left,
      apply: (_k: number, left: number, _right: number) => left
    },
    {
      name: 'prefer-right',
      fn: (_k: number, _left: number, right: number) => right,
      apply: (_k: number, _left: number, right: number) => right
    },
    {
      name: 'sum',
      fn: (_k: number, left: number, right: number) => left + right,
      apply: (_k: number, left: number, right: number) => left + right
    },
    {
      name: 'min',
      fn: (_k: number, left: number, right: number) => Math.min(left, right),
      apply: (_k: number, left: number, right: number) => Math.min(left, right)
    },
    {
      name: 'drop-even-sum',
      fn: (_k: number, left: number, right: number) => ((left + right) & 1) === 0 ? undefined : right - left,
      apply: (_k: number, left: number, right: number) => ((left + right) & 1) === 0 ? undefined : right - left
    }
  ] as const;

  test('randomized merges across branching factors', () => {
    jest.setTimeout(FUZZ_SETTINGS.timeoutMs);

    const scenarioConfigs: Array<{ seedBase: number, maxNodeSize: number }> = [];
    for (const seedBase of seeds)
      for (const maxNodeSize of branchingFactors)
        scenarioConfigs.push({ seedBase, maxNodeSize });

    const scenariosToRun = Math.min(FUZZ_SETTINGS.scenarioBudget, scenarioConfigs.length);
    const selectedScenarios = scenarioConfigs.slice(0, scenariosToRun);

    for (const { seedBase, maxNodeSize } of selectedScenarios) {
      const baseSeed = (seedBase ^ (maxNodeSize * 0x9E3779B1)) >>> 0;
      const fuzzRand = new MersenneTwister(baseSeed);
      const nextInt = (limit: number) => {
        if (limit <= 0)
          return 0;
        return Math.floor(fuzzRand.random() * limit);
      };

      let currentTree = new BTree<number, number>([], compare, maxNodeSize);
      let currentMap = new Map<number, number>();

      for (let iteration = 0; iteration < FUZZ_SETTINGS.iterationsPerScenario; iteration++) {
        const size = nextInt(FUZZ_SETTINGS.maxInsertSize);
        const otherTree = new BTree<number, number>([], compare, maxNodeSize);
        const otherMap = new Map<number, number>();

        for (let i = 0; i < size; i++) {
          const key = nextInt(FUZZ_SETTINGS.keyRange);
          const value = nextInt(FUZZ_SETTINGS.valueRange);
          otherTree.set(key, value);
          otherMap.set(key, value);
        }

        const strategy = strategies[nextInt(strategies.length)];
        const mergeFunc = strategy.fn;

        const expectedMap = new Map<number, number>(currentMap);

        otherMap.forEach((rightValue, key) => {
          if (expectedMap.has(key)) {
            const leftValue = expectedMap.get(key)!;
            const mergedValue = strategy.apply(key, leftValue, rightValue);
            if (mergedValue === undefined)
              expectedMap.delete(key);
            else
              expectedMap.set(key, mergedValue);
          } else {
            expectedMap.set(key, rightValue);
          }
        });

        const previousSnapshot = currentTree.toArray();
        const merged = currentTree.merge(otherTree, mergeFunc);

        expect(currentTree.toArray()).toEqual(previousSnapshot);

        if ((iteration & 1) === 0) {
          merged.checkValid();
        }

        const expectedArray = Array.from(expectedMap.entries()).sort((a, b) => a[0] - b[0]);
        expect(merged.toArray()).toEqual(expectedArray);

        // Spot-check a few sampled keys for consistency with the Map
        const sampleCount = Math.min(FUZZ_SETTINGS.sampleChecks, expectedArray.length);
        for (let s = 0; s < sampleCount; s++) {
          const sampleIndex = nextInt(expectedArray.length);
          const [sampleKey, sampleValue] = expectedArray[sampleIndex];
          expect(merged.get(sampleKey)).toBe(sampleValue);
        }

        currentTree = merged;
        currentMap = expectedMap;
      }
    }
  });
});
