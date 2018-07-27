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

    0.8     Insert 1000 pairs in sorted-btree's BTree
    0.4     Insert 1000 pairs in sorted-btree's BTree set (no values)
    2.7     Insert 1000 pairs in collections' SortedMap
    1.8     Insert 1000 pairs in collections' SortedSet (no values)
    0.6     Insert 1000 pairs in functional-red-black-tree
    0.5     Insert 1000 pairs in bintrees' RBTree (no values)

    8.5     Insert 10000 pairs in sorted-btree's BTree
    5.4     Insert 10000 pairs in sorted-btree's BTree set (no values)
    37.7    Insert 10000 pairs in collections' SortedMap
    25.8    Insert 10000 pairs in collections' SortedSet (no values)
    10.7    Insert 10000 pairs in functional-red-black-tree
    6.4     Insert 10000 pairs in bintrees' RBTree (no values)

    113.2   Insert 100000 pairs in sorted-btree's BTree
    73.6    Insert 100000 pairs in sorted-btree's BTree set (no values)
    686     Insert 100000 pairs in collections' SortedMap
    390.5   Insert 100000 pairs in collections' SortedSet (no values)
    194.3   Insert 100000 pairs in functional-red-black-tree
    108     Insert 100000 pairs in bintrees' RBTree (no values)

    1506    Insert 1000000 pairs in sorted-btree's BTree
    1085    Insert 1000000 pairs in sorted-btree's BTree set (no values)
    10327   Insert 1000000 pairs in collections' SortedMap
    5975    Insert 1000000 pairs in collections' SortedSet (no values)
    3703    Insert 1000000 pairs in functional-red-black-tree
    2013    Insert 1000000 pairs in bintrees' RBTree (no values)

### Insert in order, delete: sorted-btree vs the competition ###

    0.8     Insert 1000 sorted pairs in B+ tree
    0.4     Insert 1000 sorted keys in B+ tree (no values)
    0.7     Insert 1000 sorted pairs in collections' SortedMap
    0.4     Insert 1000 sorted keys in collections' SortedSet (no values)
    0.7     Insert 1000 sorted pairs in functional-red-black-tree
    0.5     Insert 1000 sorted keys in bintrees' RBTree (no values)
    5       Delete every second item in B+ tree
    3       Delete every second item in B+ tree set
    1       Bulk-delete every second item in B+ tree set
    16      Delete every second item in collections' SortedMap
    6       Delete every second item in collections' SortedSet
    9       Delete every second item in functional-red-black-tree
    15      Delete every second item in bintrees' RBTree

    7.4     Insert 10000 sorted pairs in B+ tree
    4.4     Insert 10000 sorted keys in B+ tree (no values)
    7.7     Insert 10000 sorted pairs in collections' SortedMap
    4.6     Insert 10000 sorted keys in collections' SortedSet (no values)
    13.6    Insert 10000 sorted pairs in functional-red-black-tree
    6.6     Insert 10000 sorted keys in bintrees' RBTree (no values)
    22      Delete every second item in B+ tree
    7       Delete every second item in B+ tree set
    4       Bulk-delete every second item in B+ tree set
    17      Delete every second item in collections' SortedMap
    5       Delete every second item in collections' SortedSet
    17      Delete every second item in functional-red-black-tree
    37      Delete every second item in bintrees' RBTree

    79.3    Insert 100000 sorted pairs in B+ tree
    51.7    Insert 100000 sorted keys in B+ tree (no values)
    107.2   Insert 100000 sorted pairs in collections' SortedMap
    68      Insert 100000 sorted keys in collections' SortedSet (no values)
    151.3   Insert 100000 sorted pairs in functional-red-black-tree
    99.8    Insert 100000 sorted keys in bintrees' RBTree (no values)
    88      Delete every second item in B+ tree
    40      Delete every second item in B+ tree set
    25      Bulk-delete every second item in B+ tree set
    191     Delete every second item in collections' SortedMap
    47      Delete every second item in collections' SortedSet
    69      Delete every second item in functional-red-black-tree
    57      Delete every second item in bintrees' RBTree

    784     Insert 1000000 sorted pairs in B+ tree
    520     Insert 1000000 sorted keys in B+ tree (no values)
    1210    Insert 1000000 sorted pairs in collections' SortedMap
    714     Insert 1000000 sorted keys in collections' SortedSet (no values)
    2111    Insert 1000000 sorted pairs in functional-red-black-tree
    1076    Insert 1000000 sorted keys in bintrees' RBTree (no values)
    504     Delete every second item in B+ tree
    346     Delete every second item in B+ tree set
    194     Bulk-delete every second item in B+ tree set
    1561    Delete every second item in collections' SortedMap
    754     Delete every second item in collections' SortedSet
    673     Delete every second item in functional-red-black-tree
    613     Delete every second item in bintrees' RBTree

### Insertions at random locations: sorted-btree vs Array vs Map ###

    0.5     Insert 1000 pairs in sorted array
    0.7     Insert 1000 pairs in B+ tree
    0.1     Insert 1000 pairs in ES6 Map (hashtable)

    16.1    Insert 10000 pairs in sorted array
    8.6     Insert 10000 pairs in B+ tree
    1.7     Insert 10000 pairs in ES6 Map (hashtable)

    57498   Insert 100000 pairs in sorted array
    127.5   Insert 100000 pairs in B+ tree
    20.1    Insert 100000 pairs in ES6 Map (hashtable)

    SLOW!   Insert 1000000 pairs in sorted array
    1552    Insert 1000000 pairs in B+ tree
    311     Insert 1000000 pairs in ES6 Map (hashtable)

### Insert in order, scan, delete: sorted-btree vs Array vs Map ###

    0.4     Insert 1000 sorted pairs in array
    0.7     Insert 1000 sorted pairs in B+ tree
    0.1     Insert 1000 sorted pairs in Map hashtable
    0       Sum of all values with forEach in sorted array: 27554680
    0       Sum of all values with forEachPair in B+ tree: 27554680
    0.1     Sum of all values with forEach in B+ tree: 27554680
    0       Sum of all values with forEach in Map: 27554680
    0.1     Delete every second item in sorted array
    0.1     Delete every second item in B+ tree
    0       Delete every second item in Map hashtable

    4.5     Insert 10000 sorted pairs in array
    7.9     Insert 10000 sorted pairs in B+ tree
    1.5     Insert 10000 sorted pairs in Map hashtable
    0.2     Sum of all values with forEach in sorted array: 2753952560
    0.3     Sum of all values with forEachPair in B+ tree: 2753952560
    0.5     Sum of all values with forEach in B+ tree: 2753952560
    0.2     Sum of all values with forEach in Map: 2753952560
    1.4     Delete every second item in sorted array
    1       Delete every second item in B+ tree
    0.3     Delete every second item in Map hashtable

    75.7    Insert 100000 sorted pairs in array
    85.7    Insert 100000 sorted pairs in B+ tree
    21.6    Insert 100000 sorted pairs in Map hashtable
    2.9     Sum of all values with forEach in sorted array: 275508340940
    3.5     Sum of all values with forEachPair in B+ tree: 275508340940
    5.4     Sum of all values with forEach in B+ tree: 275508340940
    2.5     Sum of all values with forEach in Map: 275508340940
    2794    Delete every second item in sorted array
    15      Delete every second item in B+ tree
    4.3     Delete every second item in Map hashtable

    1042    Insert 1000000 sorted pairs in array
    879     Insert 1000000 sorted pairs in B+ tree
    363     Insert 1000000 sorted pairs in Map hashtable
    27.7    Sum of all values with forEach in sorted array: 27486298443010
    36.6    Sum of all values with forEachPair in B+ tree: 27486298443010
    52.2    Sum of all values with forEach in B+ tree: 27486298443010
    24.4    Sum of all values with forEach in Map: 27486298443010
    SLOW!   Delete every second item in sorted array
    516     Delete every second item in B+ tree
    101.4   Delete every second item in Map hashtable

Endnote
-------

♥ This package was made to help people [learn TypeScript & React](http://typescript-react-primer.loyc.net/).

Are you a C# developer? You might like the similar data structures I made for C#: 
BDictionary, BList, etc. See http://core.loyc.net/collections/
