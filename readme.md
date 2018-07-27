B+ tree
=======

B+ trees are ordered collections of key-value pairs, sorted by key.

This is a fast B+ tree implementation, largely compatible with the standard Map, but with a much more diverse and powerful API. To use it, `import BTree from 'sorted-btree'`.

`BTree` is faster and/or uses less memory than other popular JavaScript sorted trees (see Benchmarks). However, data structures in JavaScript tend to be slower than the built-in `Array` and `Map` data structures in typical cases, because the built-in data structures are mostly implemented in a faster language such as C++. Even so, if you have a large amount of data that you want to keep sorted, the built-in data structures will not serve you well, and `BTree` offers features like fast cloning that the built-in types don't.

Features
--------

- Requires ES5 only (`Symbol.iterator` is not required but is used if defined.)
- Includes typings (`BTree` was written in TypeScript)
- API similar to ES6 `Map` with methods such as `size(), clear()`, 
  `forEach((v,k,tree)=>{}), get(K), set(K,V), has(K), delete(K)`,
  plus iterator functions `keys()`, `values()` and `entries()`.
- Supports keys that are numbers, strings, arrays of numbers/strings, `Date`,
  and objects that have a `valueOf()` method that returns a number or string.
- Other data types can also be supported with a custom comparator (second  
  constructor argument).
- Supports O(1) fast cloning with subtree sharing. This works by marking the
  root node as "shared between instances". This makes the tree read-only 
  with copy-on-edit behavior; both copies of the tree remain mutable.
- When a node fills up, items are shifted to siblings when possible to 
  keep nodes near their capacity, to improve memory utilization.
- Efficiently supports sets (keys without values). The collection does
  not allocate memory for values if the value `undefined` is associated 
  with all keys in a given node.
- Includes neat stuff such as `Range` methods for batch operations
- Throws an exception if you try to use `NaN` as a key, but infinity is allowed.
- No dependencies. Under 14K minified.

Additional operations supported on this B+ tree:

- Set a value only if the key does not already exist: `t.setIfNotPresent(k,v)`
- Set a value only if the key already exists: `t.changeIfPresent(k,v)`
- Iterate in backward order: `for (pair of t.entriesReversed()) {}`
- Iterate from a particular first element: `for (let p of t.entries(first)) {}`
- Convert to an array: `t.toArray()`, `t.keysArray()`, `t.valuesArray()`
- Get pairs for a range of keys ([K,V][]): `t.getRange(loK, hiK, includeHi)`
- Delete a range of keys and their values: `t.deleteRange(loK, hiK, includeHi)`
- Scan all items: `t.forEachPair((key, value, index) => {...})`
- Scan a range of items: `t.forRange(lowKey, highKey, includeHighFlag, (k,v) => {...})`
- Count the number of keys in a range: `c = t.forRange(loK, hiK, includeHi, undefined)`
- Get smallest or largest key: `t.minKey()`, `t.maxKey()`
- Freeze to prevent modifications: `t.freeze()` (you can also `t.unfreeze()`)
- Fast clone: `t.clone()`
- For more information, **see [full documentation](https://github.com/qwertie/btree-typescript/blob/master/b%2Btree.ts) in the source code.**

**Note:** Confusingly, the ES6 `Map.forEach(c)` method calls `c(value,key)` instead of `c(key,value)`, in contrast to other methods such as `set()` and `entries()` which put the key first. I can only assume that they reversed the order on the theory that users would usually want to examine values and ignore keys. BTree's `forEach()` therefore works the same way, but a second method `.forEachPair((key,value)=>{...})` is provided which sends you the key first and the value second; this method is slightly faster because it is the "native" for-each method for this class.

**Note:** Duplicate keys are not allowed (supporting duplicates properly is complex).

The "scanning" methods (`forEach, forRange, editRange, deleteRange`) will normally return the number of elements that were scanned. However, the callback can return `{break:R}` to stop iterating early and return a value `R` from the scanning method.

Examples
--------

### Custom comparator ###

Given a set of `{name: string, age: number}` objects, you can create a tree sorted by name and then by age like this:

~~~js
  // First constructor argument is an optional list of pairs ([K,V][])
  var tree = new BTree(undefined, (a, b) => {
    if (a.name > b.name)
      return 1; // Return a number >0 when a > b
    else if (a.name < b.name)
      return -1; // Return a number <0 when a < b
    else // names are equal (or incomparable)
      return a.age - b.age; // Return >0 when a.age > b.age
  });

  tree.set({name:"Bill", age:17}, "happy");
  tree.set({name:"Fran", age:40}, "busy & stressed");
  tree.set({name:"Bill", age:55}, "recently laid off");
  tree.forEachPair((k, v) => {
    console.log(`Name: ${k.name} Age: ${k.age} Status: ${v}`);
  });
~~~

### editRange ###

You can scan a range of items and selectively delete or change some of them using `t.editRange`. For example, the following code adds an exclamation mark to each non-boring value and deletes key number 4:

~~~js
var t = new BTree().setRange([[1,"fun"],[2,"yay"],[4,"whee"],[8,"zany"],[10,"boring"]);
t.editRange(t.minKey(), t.maxKey(), true, (k, v) => {
  if (k === 4) 
    return {delete: true};
  if (v !== "boring")
    return {value: v + '!'};
})
~~~

Benchmarks (in milliseconds for integer keys/values)
----------------------------------------------------

- These benchmark results were gathered on my PC in Node v10.4.1
- `BTree` is 3 to 5 times faster than `SortedMap` and `SortedSet` in the `collections` package
- `BTree` has similar speed to `RBTree` at smaller sizes, but is faster at very large sizes and uses less memory because it packs many keys into one array instead of allocating an extra heap object for every key.
- If you need a persistent tree, `functional-red-black-tree` is faster than I expected, but `BTree` should require less memory.
- B+ trees normally use less memory than hashtables (such as the standard `Map`), although in JavaScript this is not guaranteed because the B+ tree's memory efficiency depends on avoiding wasted space in the arrays for each node, and JavaScript provides no way to detect or control the capacity of an array's underlying memory area. Also, `Map` should be faster because it does not sort its keys.
- "Sorted array" refers to `SortedArray<K,V>`, a wrapper class for an array of `[K,V]` pairs. Benchmark results were not gathered for sorted arrays with one million elements (it takes too long)

### Insertions at random locations: sorted-btree vs the competition ###

    0.9     Insert 1000 pairs in sorted-btree's BTree
    0.5     Insert 1000 pairs in sorted-btree's BTree set (no values)
    2.6     Insert 1000 pairs in collections' SortedMap
    1.7     Insert 1000 pairs in collections' SortedSet (no values)
    0.7     Insert 1000 pairs in functional-red-black-tree
    0.5     Insert 1000 pairs in bintrees' RBTree (no values)
    
    10.9    Insert 10000 pairs in sorted-btree's BTree
    8.6     Insert 10000 pairs in sorted-btree's BTree set (no values)
    47.7    Insert 10000 pairs in collections' SortedMap
    27.8    Insert 10000 pairs in collections' SortedSet (no values)
    9.4     Insert 10000 pairs in functional-red-black-tree
    6.6     Insert 10000 pairs in bintrees' RBTree (no values)
    
    138.5   Insert 100000 pairs in sorted-btree's BTree
    92.3    Insert 100000 pairs in sorted-btree's BTree set (no values)
    601     Insert 100000 pairs in collections' SortedMap
    450     Insert 100000 pairs in collections' SortedSet (no values)
    179.3   Insert 100000 pairs in functional-red-black-tree
    110     Insert 100000 pairs in bintrees' RBTree (no values)
    
    1834    Insert 1000000 pairs in sorted-btree's BTree
    1262    Insert 1000000 pairs in sorted-btree's BTree set (no values)
    9674    Insert 1000000 pairs in collections' SortedMap
    6108    Insert 1000000 pairs in collections' SortedSet (no values)
    3811    Insert 1000000 pairs in functional-red-black-tree
    1883    Insert 1000000 pairs in bintrees' RBTree (no values)

### Insertions at random locations: sorted-btree vs Array vs Map ###

    0.5     Insert 1000 pairs in sorted array
    0.8     Insert 1000 pairs in B+ tree
    0.1     Insert 1000 pairs in ES6 Map (hashtable)
    
    16.6    Insert 10000 pairs in sorted array
    9.9     Insert 10000 pairs in B+ tree
    1.4     Insert 10000 pairs in ES6 Map (hashtable)
    
    56670   Insert 100000 pairs in sorted array
    140.5   Insert 100000 pairs in B+ tree
    21.8    Insert 100000 pairs in ES6 Map (hashtable)
    
    SLOW!   Insert 1000000 pairs in sorted array
    1913    Insert 1000000 pairs in B+ tree
    346.5   Insert 1000000 pairs in ES6 Map (hashtable)

### Insert in order, delete: sorted-btree vs the competition ###

    0.8     Insert 1000 sorted pairs in B+ tree
    0.7     Insert 1000 sorted keys in B+ tree (no values)
    0.6     Insert 1000 sorted pairs in collections' SortedMap
    0.4     Insert 1000 sorted keys in collections' SortedSet (no values)
    0.7     Insert 1000 sorted pairs in functional-red-black-tree
    0.5     Insert 1000 sorted keys in bintrees' RBTree (no values)
    0.1     Delete every second item in B+ tree
    0.1     Delete every second item in B+ tree set
    0.3     Delete every second item in collections' SortedMap
    0.3     Delete every second item in collections' SortedSet
    0.1     Delete every second item in functional-red-black-tree
    0.2     Delete every second item in bintrees' RBTree
    
    8.9     Insert 10000 sorted pairs in B+ tree
    8.4     Insert 10000 sorted keys in B+ tree (no values)
    6.3     Insert 10000 sorted pairs in collections' SortedMap
    3.9     Insert 10000 sorted keys in collections' SortedSet (no values)
    11.4    Insert 10000 sorted pairs in functional-red-black-tree
    6.8     Insert 10000 sorted keys in bintrees' RBTree (no values)
    1.7     Delete every second item in B+ tree
    1.6     Delete every second item in B+ tree set
    3.2     Delete every second item in collections' SortedMap
    3       Delete every second item in collections' SortedSet
    1       Delete every second item in functional-red-black-tree
    2.6     Delete every second item in bintrees' RBTree
    
    87.5    Insert 100000 sorted pairs in B+ tree
    88.2    Insert 100000 sorted keys in B+ tree (no values)
    102.2   Insert 100000 sorted pairs in collections' SortedMap
    65      Insert 100000 sorted keys in collections' SortedSet (no values)
    177.7   Insert 100000 sorted pairs in functional-red-black-tree
    84.8    Insert 100000 sorted keys in bintrees' RBTree (no values)
    25.4    Delete every second item in B+ tree
    25.1    Delete every second item in B+ tree set
    37.4    Delete every second item in collections' SortedMap
    32.1    Delete every second item in collections' SortedSet
    12.9    Delete every second item in functional-red-black-tree
    37.3    Delete every second item in bintrees' RBTree
    
    965     Insert 1000000 sorted pairs in B+ tree
    945     Insert 1000000 sorted keys in B+ tree (no values)
    1162    Insert 1000000 sorted pairs in collections' SortedMap
    689     Insert 1000000 sorted keys in collections' SortedSet (no values)
    2177    Insert 1000000 sorted pairs in functional-red-black-tree
    1033    Insert 1000000 sorted keys in bintrees' RBTree (no values)
    589     Delete every second item in B+ tree
    579     Delete every second item in B+ tree set
    1578    Delete every second item in collections' SortedMap
    734     Delete every second item in collections' SortedSet
    898     Delete every second item in functional-red-black-tree
    639     Delete every second item in bintrees' RBTree

### Insert in order, scan, delete: sorted-btree vs the competition ###

    0.3     Insert 1000 sorted pairs in array
    0.7     Insert 1000 sorted pairs in B+ tree
    0.1     Insert 1000 sorted pairs in Map hashtable
    0       Sum of all values with forEach in sorted array: 26886700
    0       Sum of all values with forEachPair in B+ tree: 26886700
    0       Sum of all values with forEach in B+ tree: 26886700
    0       Sum of all values with forEach in Map: 26886700
    0.1     Delete every second item in sorted array
    0.1     Delete every second item in B+ tree
    0       Delete every second item in Map hashtable
    
    4.1     Insert 10000 sorted pairs in array
    8.3     Insert 10000 sorted pairs in B+ tree
    1.4     Insert 10000 sorted pairs in Map hashtable
    0.2     Sum of all values with forEach in sorted array: 2744969490
    0.3     Sum of all values with forEachPair in B+ tree: 2744969490
    0.5     Sum of all values with forEach in B+ tree: 2744969490
    0.2     Sum of all values with forEach in Map: 2744969490
    1.4     Delete every second item in sorted array
    1.8     Delete every second item in B+ tree
    0.3     Delete every second item in Map hashtable
    
    74.6    Insert 100000 sorted pairs in array
    101.6   Insert 100000 sorted pairs in B+ tree
    20.3    Insert 100000 sorted pairs in Map hashtable
    2.6     Sum of all values with forEach in sorted array: 275145933120
    3.6     Sum of all values with forEachPair in B+ tree: 275145933120
    5.2     Sum of all values with forEach in B+ tree: 275145933120
    2.2     Sum of all values with forEach in Map: 275145933120
    2369    Delete every second item in sorted array
    28.4    Delete every second item in B+ tree
    3.9     Delete every second item in Map hashtable
    
    1030    Insert 1000000 sorted pairs in array
    983     Insert 1000000 sorted pairs in B+ tree
    331     Insert 1000000 sorted pairs in Map hashtable
    26.1    Sum of all values with forEach in sorted array: 27505579162970
    38.3    Sum of all values with forEachPair in B+ tree: 27505579162970
    52.9    Sum of all values with forEach in B+ tree: 27505579162970
    23      Sum of all values with forEach in Map: 27505579162970
    SLOW!   Delete every second item in sorted array
    658     Delete every second item in B+ tree
    98.3    Delete every second item in Map hashtable

Endnote
-------

♥ This package was made to help people [learn TypeScript & React](http://typescript-react-primer.loyc.net/).

Are you a C# developer? You might like the similar data structures I made for C#: 
BDictionary, BList, etc. See http://core.loyc.net/collections/
