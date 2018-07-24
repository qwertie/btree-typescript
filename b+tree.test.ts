import BTree, {IMap} from './b+tree';
import MersenneTwister from 'mersenne-twister';

var test: (name:string,f:()=>void)=>void = it;

/** A super-inefficient sorted list for testing purposes */
export class SortedList<K=any, V=any> implements IMap<K,V>
{
  a: [K,V][];
  cmp: (a: K, b: K) => number;

  public constructor(entries?: [K,V][], compare?: (a: K, b: K) => number) {
    this.cmp = compare || ((a: any, b: any) => a - b);
    this.a = [];
    for (var e of entries)
      this.set(e[0], e[1]);
  }

  get size() { return this.a.length; }
  get(key: K, defaultValue?: V): V | undefined {
    var pair = this.a[this.indexOf(key, -1)];
    return pair === undefined ? defaultValue : pair[1];
  }
  set(key: K, value: V, overwrite?: boolean): boolean { 
    var i = this.indexOf(key, -1);
    if (i <= -1)
      this.a.splice(~i, 0, [key, value]);
    else
      this.a[i] = [key, value];
    return i <= -1;
  }
  has(key: K): boolean { 
    return this.indexOf(key, -1) >= 0;
  }
  delete(key: K): boolean {
    var i = this.indexOf(key, -1);
    if (i > -1)
      this.a.splice(i, 1);
    return i > -1;
  }
  clear() { this.a = []; }
  toArray() { return this.a; }
  minKey(): K | undefined { return this.a[0][0]; }
  maxKey(): K | undefined { return this.a[this.a.length-1][0]; }
  forEach(callbackFn: (v:V, k:K) => void) {
    this.a.forEach(pair => callbackFn(pair[1], pair[0]));
  }

  [Symbol.iterator](): IterableIterator<[K,V]> { return this.a.values(); }
  entries(): IterableIterator<[K,V]> { return this.a.values(); }
  keys():    IterableIterator<K> { return this.a.map(pair => pair[0]).values(); }
  values():  IterableIterator<V> { return this.a.map(pair => pair[1]).values(); }

  indexOf(key: K, failXor: number): number {
    var lo = 0, hi = this.a.length, mid = hi >> 1;
    while(lo < hi) {
      var c = this.cmp(this.a[mid][0], key);
      if (c < 0)
        lo = mid + 1;
      else if (c > 0) // keys[mid] > key
        hi = mid;
      else if (c === 0)
        return mid;
      else
        throw new Error("Problem: compare failed");
      mid = (lo + hi) >> 1;
    }
    return mid ^ failXor;
  }
}

var rand: any = new MersenneTwister(1234);
function randInt(max: number) { return rand.random_int() % max; }
function expectTreeEqualTo(a: BTree, b: SortedList) {
  a.checkValid();
  expect(a.toArray()).toEqual(b.toArray());
}
function addToBoth<K,V>(a: IMap<K,V>, b: IMap<K,V>, k: K, v: V) {
  expect(a.set(k,v)).toEqual(b.set(k,v));
}

describe('Simple tests on leaf nodes', () =>
{
  test('A few insertions (fanout 8)', insert8.bind(null, 4));
  test('A few insertions (fanout 4)', insert8.bind(null, 8));
  function insert8(maxNodeSize: number) {
    var items: [number,any][] = [[6,"six"],[7,7],[5,5],[2,"two"],[4,4],[1,"one"],[3,3],[8,8]];
    var tree = new BTree<number>(items, undefined, maxNodeSize);
    var list = new SortedList(items, undefined);
    tree.checkValid();
    expect(tree.keysArray()).toEqual([1,2,3,4,5,6,7,8]);
    expectTreeEqualTo(tree, list);
  }

  {
    let tree = new BTree<number,string>([[0,""],[1,"1"],[2,"to"],[3,"tri"],[4,"four"],[5,"five!"]]);
    function forExpector(k:number, v:string, counter:number, i:number) {
      expect(k).toEqual(v.length);
      expect(k).toEqual(counter);
      expect(k).toEqual(i);
    }
    test('forEach', () => {
      let i = 0;
      expect(tree.forEach(function(v,k,tree_) {
        expect(tree_).toBe(tree);
        expect(this.self).toBe("me");
        forExpector(k, v, i, i++);
      }, {self:"me"})).toBe(4);
    });
    test('forEachPair', () => {
      let i = 0;
      expect(tree.forEachPair(function(k,v,counter) {
        forExpector(k, v, counter - 10, i++);
      }, 10)).toBe(14);
    });
    test('forRange', () => {
      let i = 0;
      expect(tree.forRange(2, 4, false, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++);
      }, 10)).toBe(12);
      i = 0;
      expect(tree.forRange(2, 4, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++);
      }, 10)).toBe(13);
    });
    test('editRange', () => {
      let i = 0;
      expect(tree.editRange(1, 4, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++);
      }, 10)).toBe(14);
      i = 0;
      expect(tree.editRange(1, 9, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++);
        if (k & 1) return {delete:true};
        if (k == 2) return {value:"TWO!"};
        if (k >= 4) return {break:"STOP"};
      }, 10)).toBe("STOP");
      expect(tree.toArray()).toEqual([[0,""],[2,"TWO!"],[4,"four"],[4,"five!"]])
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
      expect(tree.getRange("#", "B", false)).toBe([["A",1]]);
      expect(tree.getRange("#", "B", true)).toBe([["A",1],["B",2]]);
      expect(tree.getRange("G", "S", true)).toBe([["G",7],["H",8]]);
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
      expectTreeEqualTo(tree, new SortedList([["B",2],["D",4],["E",5],["F",6],["G",7]]));
    });
    test('editRange() - again', () => {
      expect(tree.editRange(tree.minKey(), "F", false, (k,v) => {
        if (k == "D")
          return {value: 44};
        if (k == "E" || k == "G")
          return {delete: true};
        if (k >= "F")
          return {stop: true};
      })).toBe(4);
      expectTreeEqualTo(tree, new SortedList([["B",2],["D",44],["F",6],["G",7]]));
    });
    test("A clone is independent", () => {
      var tree2 = tree.clone();
      expect(tree.delete("G")).toBe(true);
      expect(tree2.deleteRange("A", "F", false)).toBe(2);
      expect(tree2.deleteRange("A", "F", true)).toBe(1);
      expectTreeEqualTo(tree, new SortedList([["B",2],["D",44],["F",6]]));
      expectTreeEqualTo(tree2, new SortedList([["G",7]]));
    });
  }

  test('Can be frozen and unfrozen', () => {
    var tree = new BTree([[1,"one"]]);
    tree.freeze();
    expect(() => tree.set(2, "two")).toThrowError(/frozen/);
    expect(() => tree.setRange([[2, "two"]])).toThrowError(/frozen/);
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
    tree.set({name:"Bill", age:"17"}, "happy");
    tree.set({name:"Rose", age:"40"}, "busy & stressed");
    tree.set({name:"Bill", age:"55"}, "recently laid off");
    tree.set({name:"Rose", age:"10"}, "rambunctious");
    tree.set({name:"Chad", age:"18"}, "smooth");
    var list: any[] = [];
    expect(tree.forEachPair((k, v) => {
      list.push(Object.assign({value: v}, k));
    }, 10)).toBe(14);
    expect(list).toEqual([
      { name: "Bill", age: "17", value: "happy" },
      { name: "Bill", age: "55", value: "recently laid off" },
      { name: "Chad", age: "18", value: "smooth" },
      { name: "Rose", age: "10", value: "rambunctious" },
      { name: "Rose", age: "40", value: "busy & stressed" },
    ]);
  });
});

describe('B+ tree with fanout 32', testBTree.bind(null, 32));
describe('B+ tree with fanout 10', testBTree.bind(null, 10));
describe('B+ tree with fanout 4',  testBTree.bind(null, 4));

function testBTree(maxNodeSize: number)
{
  for (var size = 8; size <= 512; size *= 8) {
    test(`Iterators [size ${size}]`, () => {
      var tree = new BTree<number,number|undefined>(undefined, undefined, maxNodeSize);
      var list = new SortedList<number,number|undefined>();
      for (var i = 0; i < size; i++) {
        var key = randInt(size * 2);
        addToBoth(tree, list, key, key);
      }
      expectTreeEqualTo(tree, list);

      for (var i = 0; i < size/4; i++) {
        var key = randInt(size + 10);
        var nextPair = list.toArray()[list.indexOf(key, 0)];
        expect(tree)
      }
    });
  }

  for (var size = 5; size <= 125; size *= 5) {
    // Ensure standard operations work for various list sizes
    test('Various operations [starting size ${size}]', () => {
      var tree = new BTree<number,number|undefined>(undefined, undefined, maxNodeSize);
      var list = new SortedList<number,number|undefined>();
    
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
      expect(Array.from(tree.entries())).toEqual(Array.from(list.entries()));
      expect(Array.from(tree.keys())).toEqual(Array.from(list.keys()));
      expect(Array.from(tree.values())).toEqual(Array.from(list.values()));
      
      // Try iterating from past the end...
      expect(Array.from(tree.entries(tree.maxKey()!+1))).toEqual([]);
      expect(Array.from(tree.keys(tree.maxKey()!+1))).toEqual([]);
      expect(Array.from(tree.values(tree.maxKey()!+1))).toEqual([]);
      
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
      }

      expectTreeEqualTo(tree, list);
    });
  }

  for (var size = 6; size <= 216; size *= 6) {
    test(`setRange & deleteRange [size ${size}]`, () => {
      // Store numbers in descending order
      var reverseComparator = (a:number, b:number) => b - a;

      // Prepare reference list
      var list = new SortedList<number,string>([], reverseComparator);
      for (var i = size-1; i >= 0; i--)
        list.set(i, i.toString());
  
      // Add all to tree in the "wrong" order (ascending)
      var tree = new BTree<number,string>(undefined, reverseComparator, maxNodeSize);
      tree.setRange(list.toArray().slice(0).reverse());
      expectTreeEqualTo(tree, list);

      // Remove most of the items
      expect(tree.deleteRange(size-2, 5, true)).toEqual(size-6);
      expectTreeEqualTo(tree, new SortedList<number,string>([
        [size-1, (size-1).toString()], [4,"4"], [3,"3"], [2,"2"], [1,"1"], [0,"0"]
      ]));
      expect(tree.deleteRange(size, 0, true)).toEqual(6);
      expect(tree.toArray()).toEqual([]);
    });
  }
}
