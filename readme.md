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
  I call this category of data structure "semi-persistent" because AFAIK no
  one else has given it a name; it walks the line between mutating and 
  [persistent](https://en.wikipedia.org/wiki/Persistent_data_structure).
- Includes persistent methods such as `with` and `without`, which return a
  modified tree without changing the original (in O(log(size)) time).
- When a node fills up, items are shifted to siblings when possible to 
  keep nodes near their capacity, to improve memory utilization.
- Efficiently supports sets (keys without values). The collection does
  not allocate memory for values if the value `undefined` is associated 
  with all keys in a given node.
- Includes neat stuff such as `Range` methods for batch operations
- Throws an exception if you try to use `NaN` as a key, but infinity is allowed.
- No dependencies. 15K minified.

### Additional operations supported on this B+ tree ###

- Set a value only if the key does not already exist: `t.setIfNotPresent(k,v)`
- Set a value only if the key already exists: `t.changeIfPresent(k,v)`
- Iterate in backward order: `for (pair of t.entriesReversed()) {}`
- Iterate from a particular first element: `for (let p of t.entries(first)) {}`
- Convert to an array: `t.toArray()`, `t.keysArray()`, `t.valuesArray()`
- Get pairs for a range of keys ([K,V][]): `t.getRange(loK, hiK, includeHi)`
- Delete a range of keys and their values: `t.deleteRange(loK, hiK, includeHi)`
- Scan all items: `t.forEachPair((key, value, index) => {...})`
- Scan a range of items: `t.forRange(lowKey, highKey, includeHiFlag, (k,v) => {...})`
- Count the number of keys in a range: `c = t.forRange(loK, hiK, includeHi, undefined)`
- Get smallest or largest key: `t.minKey()`, `t.maxKey()`
- Get next larger key/pair than `k`: `t.nextHigherKey(k)`, `t.nextHigherPair(k)`
- Get largest key/pair that is lower than `k`: `t.nextLowerKey(k)`, `t.nextLowerPair(k)`
- Freeze to prevent modifications: `t.freeze()` (you can also `t.unfreeze()`)
- Fast clone: `t.clone()`
- For more information, **see [full documentation](https://github.com/qwertie/btree-typescript/blob/master/b%2Btree.ts) in the source code.**

**Note:** Confusingly, the ES6 `Map.forEach(c)` method calls `c(value,key)` instead of `c(key,value)`, in contrast to other methods such as `set()` and `entries()` which put the key first. I can only assume that they reversed the order on the theory that users would usually want to examine values and ignore keys. BTree's `forEach()` therefore works the same way, but a second method `.forEachPair((key,value)=>{...})` is provided which sends you the key first and the value second; this method is slightly faster because it is the "native" for-each method for this class.

**Note:** Duplicate keys are not allowed (supporting duplicates properly is complex).

The "scanning" methods (`forEach, forRange, editRange, deleteRange`) will normally return the number of elements that were scanned. However, the callback can return `{break:R}` to stop iterating early and return a value `R` from the scanning method.

#### Functional methods

- Get a copy of the tree including only items fitting a criteria: `t.filter((k,v) => k.fitsCriteria())`
- Get a copy of the tree with all values modified: `t.mapValues((v,k) => v.toString())`
- Reduce a tree (see below): `t.reduce((acc, pair) => acc+pair[1], 0)`

#### Persistent methods

- Get a new tree with one pair changed: `t.with(key, value)`
- Get a new tree with multiple pairs changed: `t.withPairs([[k1,v1], [k2,v2]])`
- Ensure that specified keys exist in a new tree: `t.withKeys([k1,k2])`
- Get a new tree with one pair removed: `t.without(key)`
- Get a new tree with specific pairs removed: `t.withoutKeys(keys)`
- Get a new tree with a range of keys removed: `t.withoutRange(low, high, includeHi)`

**Things to keep in mind:** I ran a test which suggested `t.with` is three times slower than `t.set`. These methods do not return a frozen tree even if the original tree was frozen (for performance reasons, e.g. frozen trees use slightly more memory.)

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

### reduce ###

The `reduce` method performs a reduction operation, like the `reduce` method of `Array`. It is used to combine all keys, values or pairs into a single value, or to perform type conversions conversions. `reduce` is best understood by example. So here's how you can multiply all the keys in a tree together:

    var product = tree.reduce((p, pair) => p * pair[0], 1)

It means "start with `p=1`, and for each pair change `p` to `p * pair[0]`" (`pair[0]` is the key). You may be thinking "hey, wouldn't it make more sense if the `1` argument came _first_?" Yes it would, but in `Array` the parameter is second, so it must also be second in `BTree` for consistency.

Here's a similar example that adds all values together:

    var total = tree.reduce((sum, pair) => sum + pair[1], 0)

This final example converts the tree to a Map:

    var map = tree.reduce((m, pair) => m.set(pair[0], pair[1]), new Map())`

Remember that `m.set` returns `m`, which is different from `BTree` where `tree.set` returns a boolean indicating whether a new key was added.

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

- These benchmark results were gathered on my PC in Node v10.4.1, July 2018
- `BTree` is 3 to 5 times faster than `SortedMap` and `SortedSet` in the `collections` package
- `BTree` has similar speed to `RBTree` at smaller sizes, but is faster at very large sizes and uses less memory because it packs many keys into one array instead of allocating an extra heap object for every key.
- If you need [functional persistence](https://en.wikipedia.org/wiki/Persistent_data_structure), `functional-red-black-tree` is remarkably fast for a persistent tree, but `BTree` should require less memory _unless_ you frequently use `clone/with/without` and are saving snapshots of the old tree to prevent garbage collection.
- B+ trees normally use less memory than hashtables (such as the standard `Map`), although in JavaScript this is not guaranteed because the B+ tree's memory efficiency depends on avoiding wasted space in the arrays for each node, and JavaScript provides no way to detect or control the capacity of an array's underlying memory area. Also, `Map` should be faster because it does not sort its keys.
- "Sorted array" refers to `SortedArray<K,V>`, a wrapper class for an array of `[K,V]` pairs. Benchmark results were not gathered for sorted arrays with one million elements (it takes too long)

### Insertions at random locations: sorted-btree vs the competition ###

0.8     Insert 1000 pairs in sorted-btree's BTree
0.4     Insert 1000 pairs in sorted-btree's BTree set (no values)
2.5     Insert 1000 pairs in collections' SortedMap
1.6     Insert 1000 pairs in collections' SortedSet (no values)
0.7     Insert 1000 pairs in functional-red-black-tree
0.5     Insert 1000 pairs in bintrees' RBTree (no values)

8.6     Insert 10000 pairs in sorted-btree's BTree
5.1     Insert 10000 pairs in sorted-btree's BTree set (no values)
37.8    Insert 10000 pairs in collections' SortedMap
25.8    Insert 10000 pairs in collections' SortedSet (no values)
8.7     Insert 10000 pairs in functional-red-black-tree
5.4     Insert 10000 pairs in bintrees' RBTree (no values)

95.9    Insert 100000 pairs in sorted-btree's BTree
69.1    Insert 100000 pairs in sorted-btree's BTree set (no values)
564     Insert 100000 pairs in collections' SortedMap
366.5   Insert 100000 pairs in collections' SortedSet (no values)
192.5   Insert 100000 pairs in functional-red-black-tree
107.3   Insert 100000 pairs in bintrees' RBTree (no values)

1363    Insert 1000000 pairs in sorted-btree's BTree
909     Insert 1000000 pairs in sorted-btree's BTree set (no values)
8783    Insert 1000000 pairs in collections' SortedMap
5443    Insert 1000000 pairs in collections' SortedSet (no values)
3356    Insert 1000000 pairs in functional-red-black-tree
1581    Insert 1000000 pairs in bintrees' RBTree (no values)

### Insert in order, delete: sorted-btree vs the competition ###

0.6     Insert 1000 sorted pairs in B+ tree
0.4     Insert 1000 sorted keys in B+ tree set (no values)
0.6     Insert 1000 sorted pairs in collections' SortedMap
0.4     Insert 1000 sorted keys in collections' SortedSet (no values)
0.7     Insert 1000 sorted pairs in functional-red-black-tree
0.5     Insert 1000 sorted keys in bintrees' RBTree (no values)
1       Delete every second item in B+ tree
3       Delete every second item in B+ tree set
1       Bulk-delete every second item in B+ tree set
1       Delete every second item in collections' SortedMap
1       Delete every second item in collections' SortedSet
5       Delete every second item in functional-red-black-tree
10      Delete every second item in bintrees' RBTree

6.5     Insert 10000 sorted pairs in B+ tree
3.9     Insert 10000 sorted keys in B+ tree set (no values)
6.5     Insert 10000 sorted pairs in collections' SortedMap
3.9     Insert 10000 sorted keys in collections' SortedSet (no values)
12.4    Insert 10000 sorted pairs in functional-red-black-tree
5.8     Insert 10000 sorted keys in bintrees' RBTree (no values)
4       Delete every second item in B+ tree
4       Delete every second item in B+ tree set
3       Bulk-delete every second item in B+ tree set
13      Delete every second item in collections' SortedMap
7       Delete every second item in collections' SortedSet
8       Delete every second item in functional-red-black-tree
6       Delete every second item in bintrees' RBTree

75.9    Insert 100000 sorted pairs in B+ tree
45      Insert 100000 sorted keys in B+ tree set (no values)
98.7    Insert 100000 sorted pairs in collections' SortedMap
61.4    Insert 100000 sorted keys in collections' SortedSet (no values)
145.8   Insert 100000 sorted pairs in functional-red-black-tree
82.6    Insert 100000 sorted keys in bintrees' RBTree (no values)
79      Delete every second item in B+ tree
52      Delete every second item in B+ tree set
18      Bulk-delete every second item in B+ tree set
166     Delete every second item in collections' SortedMap
58      Delete every second item in collections' SortedSet
64      Delete every second item in functional-red-black-tree
74      Delete every second item in bintrees' RBTree

700     Insert 1000000 sorted pairs in B+ tree
452.5   Insert 1000000 sorted keys in B+ tree set (no values)
1069    Insert 1000000 sorted pairs in collections' SortedMap
864     Insert 1000000 sorted keys in collections' SortedSet (no values)
1531    Insert 1000000 sorted pairs in functional-red-black-tree
966     Insert 1000000 sorted keys in bintrees' RBTree (no values)
435     Delete every second item in B+ tree
291     Delete every second item in B+ tree set
159     Bulk-delete every second item in B+ tree set
1447    Delete every second item in collections' SortedMap
796     Delete every second item in collections' SortedSet
573     Delete every second item in functional-red-black-tree
537     Delete every second item in bintrees' RBTree

### Insertions at random locations: sorted-btree vs Array vs Map ###

0.5     Insert 1000 pairs in sorted array
0.6     Insert 1000 pairs in B+ tree
0.1     Insert 1000 pairs in ES6 Map (hashtable)

13.2    Insert 10000 pairs in sorted array
7.2     Insert 10000 pairs in B+ tree
1.3     Insert 10000 pairs in ES6 Map (hashtable)

56980   Insert 100000 pairs in sorted array
122     Insert 100000 pairs in B+ tree
17.7    Insert 100000 pairs in ES6 Map (hashtable)

SLOW!   Insert 1000000 pairs in sorted array
1354    Insert 1000000 pairs in B+ tree
304.5   Insert 1000000 pairs in ES6 Map (hashtable)

### Insert in order, scan, delete: sorted-btree vs Array vs Map ###

0.4     Insert 1000 sorted pairs in array
0.6     Insert 1000 sorted pairs in B+ tree
0.1     Insert 1000 sorted pairs in Map hashtable
0       Sum of all values with forEach in sorted array: 27350180
0       Sum of all values with forEachPair in B+ tree: 27350180
0       Sum of all values with forEach in B+ tree: 27350180
0       Sum of all values with iterator in B+ tree: 27350180
0       Sum of all values with forEach in Map: 27350180
0.1     Delete every second item in sorted array
0.1     Delete every second item in B+ tree
0       Delete every second item in Map hashtable

3.9     Insert 10000 sorted pairs in array
6.7     Insert 10000 sorted pairs in B+ tree
1.3     Insert 10000 sorted pairs in Map hashtable
0.2     Sum of all values with forEach in sorted array: 2716659330
0.3     Sum of all values with forEachPair in B+ tree: 2716659330
0.4     Sum of all values with forEach in B+ tree: 2716659330
0.3     Sum of all values with iterator in B+ tree: 2716659330
0.2     Sum of all values with forEach in Map: 2716659330
1.2     Delete every second item in sorted array
1.1     Delete every second item in B+ tree
0.3     Delete every second item in Map hashtable

68.4    Insert 100000 sorted pairs in array
72.7    Insert 100000 sorted pairs in B+ tree
18.4    Insert 100000 sorted pairs in Map hashtable
2.5     Sum of all values with forEach in sorted array: 275653049020
3.3     Sum of all values with forEachPair in B+ tree: 275653049020
4.5     Sum of all values with forEach in B+ tree: 275653049020
2.8     Sum of all values with iterator in B+ tree: 275653049020
2.2     Sum of all values with forEach in Map: 275653049020
2420    Delete every second item in sorted array
14.4    Delete every second item in B+ tree
3.7     Delete every second item in Map hashtable

969     Insert 1000000 sorted pairs in array
773     Insert 1000000 sorted pairs in B+ tree
305.5   Insert 1000000 sorted pairs in Map hashtable
25.3    Sum of all values with forEach in sorted array: 27510295368690
32.4    Sum of all values with forEachPair in B+ tree: 27510295368690
46.1    Sum of all values with forEach in B+ tree: 27510295368690
29.9    Sum of all values with iterator in B+ tree: 27510295368690
22      Sum of all values with forEach in Map: 27510295368690
SLOW!   Delete every second item in sorted array
305.5   Delete every second item in B+ tree
95.6    Delete every second item in Map hashtable

Version history
---------------

### v1.1 ###

- Added `isEmpty` property getter
- Added `nextHigherPair`, `nextHigherKey`, `nextLowerPair`, `nextLowerKey` methods
- Added `editAll`, which is like `editRange` but touches all keys
- Added `deleteKeys` for deleting a sequence of keys (iterable)
- Added persistent methods `with`, `withPairs`, `withKeys`, `without`, `withoutKeys`, `withoutRange`
- Added functional methods `filter`, `reduce`, `mapValues`
- Added `greedyClone` for cloning nodes immediately, to avoid marking the original tree as shared which slows it down.
- Relaxed type constraint on second parameter of `entries`/`entriesReversed`
- Renamed `setRange` to `setPairs` for logical consistency with `withoutPairs` and `withoutRange`. The old name is deprecated but added to the `prototype` as a synonym. `setPairs` returns the number of pairs added instead of `this`.
- Added export `EmptyBTree`, a frozen empty tree

### v1.0: Initial version ###

- With fast cloning and all that good stuff

### Endnote ###

♥ This package was made to help people [learn TypeScript & React](http://typescript-react-primer.loyc.net/).

Are you a C# developer? You might like the similar data structures I made for C#: 
BDictionary, BList, etc. See http://core.loyc.net/collections/

You might think that the package name "sorted btree" is overly redundant, but I _did_ make a data structure similar to B+ Tree that is _not_ sorted. I called it the [A-List](http://core.loyc.net/collections/alists-part1) (C#). But yeah, the names `btree` and `bplustree` were already taken, so what was I supposed to do, right?
