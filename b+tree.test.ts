import BTree, {IMap, EmptyBTree} from './b+tree';
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
      expect(tree.forEach(function(v,k,tree_) {
        expect(tree_).toBe(tree);
        expect(this.self).toBe("me");
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
      expect(tree.editRange(tree.minKey(), "F", true, (k,v,counter) => {
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
    expect(tree.reduce((sum, pair) => sum + pair[1], 0)).toBe(501*250);
    
    // Test mapValues()
    tree.mapValues(v => v*10).forEachPair((k, v) => { expect(v).toBe(k) });

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
    for (let k = 0; k <= tree.maxKey(); k += 100)
      list.delete(k);
    expectTreeEqualTo(t9, list);
  });
}
