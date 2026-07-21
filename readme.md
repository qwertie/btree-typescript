B+ tree
=======

B+ trees are ordered collections of key-value pairs, sorted by key.

This is a fast B+ tree implementation, largely compatible with the standard Map, but with a much more diverse and powerful API. To use it, `import BTree from 'sorted-btree'`.

`BTree` is faster and/or uses less memory than other popular JavaScript sorted trees (see Benchmarks). However, data structures in JavaScript tend to be slower than the built-in `Array` and `Map` data structures in typical cases, because the built-in data structures are mostly implemented in a faster language such as C++. Even so, if you have a large amount of data that you want to keep sorted, the built-in data structures will not serve you well, and `BTree` offers a variety of features like fast cloning and diffing, which the built-in types don't.

Use `npm install sorted-btree` in a terminal to install it in your npm-based project.

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
  with copy-on-edit behavior; both copies of the tree remain mutable. I call 
  this category of data structure "dynamically persistent" or "mutably 
  persistent" because AFAIK no one else has given it a name; it walks the line 
  between mutating and [persistent](https://en.wikipedia.org/wiki/Persistent_data_structure).
- Includes persistent methods such as `with` and `without`, which return a
  modified tree without changing the original (in O(log(size)) time).
- When a node fills up, items are shifted to siblings when possible to 
  keep nodes near their capacity, to improve memory utilization.
- Efficiently supports sets (keys without values). The collection does
  not allocate memory for values if the value `undefined` is associated 
  with all keys in a given node.
- Includes neat stuff such as `Range` methods for batch operations
- Throws an exception if you try to use `NaN` as a key, but infinity is allowed.
- No dependencies. 19.6K minified, 5.5K gzipped, plus an extra 22.0K minified / 9.0K gzipped if you use `BTreeEx`
- Includes a lattice of interfaces for TypeScript users (see below)
- Supports diffing computation between two trees that is highly optimized for the case
  in which a majority of nodes are shared (such as when persistent methods are used).
- Supports fast union & shared-key iteration via `forEachKeyInBoth` with asymptotic speedups when large disjoint ranges of keys are present.
  The union operation generates a new tree that shares nodes with the original trees when possible.

### Additional operations supported on this `BTree` ###

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

**Note:** Confusingly, the ES6 `Map.forEach(c)` method calls `c(value,key)` instead of `c(key,value)`, in contrast to other methods such as `set()` and `entries()` which put the key first. I can only assume that they reversed the order on the hypothesis that users would usually want to examine values and ignore keys. BTree's `forEach()` therefore works the same way, but there is a second method `.forEachPair((key,value)=>{...})` which sends you the key first and the value second; this method is slightly faster because it is the "native" for-each method for this class.

**Note:** Duplicate keys are not allowed (supporting duplicates properly is complex).

The "scanning" methods (`forEach, forRange, editRange, deleteRange`) will normally return the number of elements that were scanned. However, the callback can return `{break:R}` to stop iterating early and return a value `R` from the scanning method.

#### Functional methods

- Get a copy of the tree including only items fitting a criteria: `t.filter((k,v) => k.fitsCriteria())`
- Get a copy of the tree with all values modified: `t.mapValues((v,k) => v.toString())`
- Reduce a tree (see below): `t.reduce((acc, pair) => acc+pair[1], 0)`

#### Persistent methods

- Get a new tree with one pair changed: `t.with(key, value)`
- Get a new tree with multiple pairs changed: `t.withPairs([[k1,v1], [k2,v2]], overwriteFlag)`
- Ensure that specified keys exist in a new tree: `t.withKeys([k1,k2])`
- Get a new tree with one pair removed: `t.without(key)`
- Get a new tree with specific pairs removed: `t.withoutKeys(keys)`
- Get a new tree with a range of keys removed: `t.withoutRange(low, high, includeHi)`
- Get a new tree that is the result of a union: `t.union(other, unionFn)`

**Things to keep in mind:** I ran a test which suggested `t.with` is three times slower than `t.set`. These methods do not return a frozen tree even if the original tree was frozen (for performance reasons, e.g. frozen trees use slightly more memory.)

### Additional optimized operations in `BTreeEx`

- Find differences between two trees, quickly skipping shared subtrees: `tree1.diffAgainst(tree2, function tree1Only(k, v) {}, function tree2Only(k, v) {}, function different(k, v1, v2) {})` (standalone: `diffAgainst(treeA, treeB, ...)`)
- Examine keys shared between two trees: `tree1.forEachKeyInBoth(tree2, (k, val1, val2) => {...})`
- Examine keys unique to this tree: `tree1.forEachKeyNotIn(tree2, (k, v) => {...})`
- Get the intersection (overlap) between two trees: `tree1.intersect(tree2, (k, val1, val2) => val1)`
- Get the union (combination) of two trees: `tree1.union(tree2, (k, val1, val2) => val1)`
- Get a copy without keys from another tree: `tree1.subtract(tree2)`
- Fast bulk load: `BTreeEx.bulkLoad(entries, 32)`
- For more information, **see [full documentation](https://github.com/qwertie/btree-typescript/blob/master/extended/index.ts) in the source code.**

### Two ways to use the extra algorithms

The default export gives you the core tree and functionality; import `BTreeEx` to get an extended `BTreeEx` class with all the extra goodies:

```ts
import BTreeEx from 'sorted-btree/extended';
```

Alternately, you can continue using `BTree` but import individual algorithms instead:

```ts
import diffAgainst from 'sorted-btree/extended/diffAgainst';
```

`BTreeEx` is a drop-in subclass of `BTree` that keeps advanced helpers on the instance, while the standalone `diffAgainst` entry point lets bundlers include only that function when you don't need the rest of the extended surface.

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

Interface lattice
-----------------

BTree includes a [lattice of interface types](https://github.com/qwertie/btree-typescript/blob/master/interfaces.d.ts) representing subsets of BTree's interface. I would encourage other authors of map/dictionary/tree/hashtable types to utilize these interfaces. These interfaces can be divided along three dimensions:

### 1. Read/write access ###

I have defined several kinds of interfaces along the read/write access dimension:

- **Source**: A "source" is a read-only interface (`ISetSource<K>` and `IMapSource<K,V>`). At minimum, sources include a `size` property and methods `get`, `has`, `forEach`, and `keys`.
- **Sink**: A "sink" is a write-only interface (`ISetSink<K>` and `IMapSink<K,V>`). At minimum, sinks have `set`, `delete` and `clear` methods.
- **Mutable**: An interface that combines the source and sink interfaces (`ISet<K>` and `IMap<K,V>`).
- **Functional**: An interface for [persistent](https://en.wikipedia.org/wiki/Persistent_data_structure) data structures. It combines a read-only interface with methods that return a modified copy of the collection. The functional interfaces end with `F` (`ISetF<K>` and `IMapF<K,V>`).

### 2. Sorted versus unsorted ###

The `Sorted` interfaces extend the non-sorted interfaces with queries that only a sorted collection can perform efficiently, such as `minKey()` and `nextHigherKey(k)`. At minimum, sorted interfaces add methods `minKey`, `maxKey`, `nextHigherKey`, `nextLowerKey`, and `forRange`, plus iterators that return keys/values/pairs in sorted order and accept a `firstKey` parameter to control the starting point of iteration.

**Note:** in sorted-btree ≤ v1.7.x, these interfaces have methods `nextHigherKey(key: K)` and `nextLowerKey(key: K)` which should be `nextHigherKey(key: K|undefined)` and `nextLowerKey(key: K|undefined)`. These signatures are changed in the next version.

### 3. Set versus map ###

A map is a collection of keys with values, while a set is a collection of keys without values.

For the most part, each `Set` interface is a subset of the corresponding `Map` interface with "values" removed. For example, `MapF<K,V>` extends `SetF<K>`. An exception to this is that `IMapSink<K, V>` could not be derived from `ISetSink<K>` (and thus `IMap<K,V>` is not derived from `ISet<K>`) because the type `V` does not necessarily include `undefined`. Therefore you can write `set.set(key)` to add a key to a set, but you cannot write `map.set(key)` without specifying a value (in TypeScript this is true _even if `V` includes undefined_.)

### List of interfaces ###

All of these [interfaces](https://github.com/qwertie/btree-typescript/blob/master/interfaces.d.ts) use `any` as the default type of `K` and `V`.

- `ISetSource<K>`
- `ISetSink<K>`
- `ISet<K>               extends ISetSource<K>, ISetSink<K>`
- `IMapSource<K, V>      extends ISetSource<K>`
- `IMapSink<K, V>`
- `IMap<K, V>            extends IMapSource<K,V>, IMapSink<K,V>`
- `ISortedSetSource<K>   extends ISetSource<K>`
- `ISortedSet<K>         extends ISortedSetSource<K>, ISetSink<K>`
- `ISortedMapSource<K,V> extends IMapSource<K, V>, ISortedSetSource<K>`
- `ISortedMap<K,V>       extends IMap<K,V>, ISortedMapSource<K,V>`
- `ISetF<K>              extends ISetSource<K>`
- `IMapF<K, V>           extends IMapSource<K,V>, ISetF<K>`
- `ISortedSetF<K>        extends ISetF<K>, ISortedSetSource<K>`
- `ISortedMapF<K,V>      extends ISortedSetF<K>, IMapF<K,V>, ISortedMapSource<K,V>`

If the lattice were complete there would be 16 interfaces (`4*2*2`). In fact there are only 14 interfaces because `ISortedMapSink<K,V>` and `ISortedSetSink<K, V>` don't exist, because sorted sinks are indistinguishable from unsorted sinks.

`BTree<K,V>` implements all of these interfaces except `ISetSink<K>`, `ISet<K>`, and `ISortedSet<K>`. However, `BTree<K,V>` may be _compatible_ with these interfaces even if TypeScript doesn't realize it. Therefore, if `V` includes `undefined`, the `BTree<K,V>.asSet` property is provided to cast the `BTree` to a set type. The `asSet` property returns the same `BTree` as type `ISortedSet<K>` (which is assignable to `ISetSink<K>`, `ISet<K>` and `ISortedSetSource<K>`).

### ES6 Map/Set compatibility ###

The `IMap<K,V>` interface is compatible with the ES6 `Map<K,V>` type as well as `BTree<K,V>`. In order to accomplish this, compromises had to be made:

- The `set(k,v)` method returns `any` for compatibility with both `BTree` and `Map`, since `BTree` returns `boolean` (true if an item was added or false if it already existed), while `Map` returns `this`.
- ES6's `Map.forEach(c)` method calls `c(value,key)` instead of `c(key,value)`, unlike all other methods which put the key first. Therefore `IMap` works the same way. Unfortunately, this means that `ISetSource<K>`, the supertype of `IMapSource<K,V>`, cannot sanely have a `forEach` method because if it did, the first parameter to the callback would be unused.
- The batch operations `setPairs`, `deletePairs` and `reduce` are left out because they are not defined by `Map`. Instead, these methods are defined in `ISortedMap<K,V>`.
- Likewise, the functional operations `reduce`, `filter` and `mapValues` are not included in `IMap`, but they are defined in `IMapF<K,V>` and (except `mapValues`) `ISetF<K>`.

Similarly, `ISet<K>` is compatible with ES6 `Set`. Again there are compromises:

- The `set` method is renamed `add` in `Set` and `ISet<K>`, so `add` exists on `BTree.prototype` as a synonym for `set`.
- There is no `forEach` method for reasons alluded to above. Use `keys()` instead.
- There is no `filter` or `reduce` because `Set` doesn't support them.

Although `BTree<K,V>` doesn't directly implement `ISet<K>`, it does implement `ISetSource<K>` and it is safe to cast `BTree<K,V>` to `ISet<K>` or `ISortedSet<K>` provided that `V` is allowed to be undefined.

Ukraine is still under attack
-----------------------------

I wrote this on March 24, 2022: the one-month anniversary of the full-scale invasion of Ukraine.

![Mariupol](http://david.loyc.net/misc/ukraine/Mariupol-from-above.webp)

This is the city of Mariupol, which Russia badly damaged after cutting off electricity, water and heat on March 1. Pre-war population: 431,859. Do you see any military targets here? No, these are homes that many people still live in. Russia has even made it [dangerous to leave](https://www.bbc.com/news/world-europe-60629851). [An official told NPR:](https://www.dailymail.co.uk/news/article-10580113/All-people-die-Zelensky-slams-NATOs-refusal-establish-no-fly-zone.html) 'When the people organised in evacuation points, they [Russians] started attack on evacuation points. Not all the city. Just evacuation points.'

Officially, [as of 9 days ago, 2,400 civilians had been killed](https://www.nytimes.com/2022/03/15/world/europe/mariupol-death-toll-ukraine.html), but this is said to be an underestimate and the actual number of murders may have been as high as 20,000... nine days ago.

Now, I'm just a lowly programming-language designer with no real following on [Twitter](https://twitter.com/DPiepgrass), so I'm venting here.

I have donated to the Red Cross in support of Ukraine [update: reports have said this is not an effective charity], and also to AVD-Info and Meduza in order to help give Russians access to information (the Russian internet is heavily censored, and independent media are banned). For more donation ideas, [see here](https://forum.effectivealtruism.org/posts/qkhoBJRNQT4EFWos7/what-are-effective-ways-to-help-ukrainians-right-now).

[As of 2025, I still find it hard to find effective charities. The most impactful thing you could do is probably to request that your government support Ukraine financially. Trump has cut aid almost to zero, invited Putin to Alaska and proposed restoring economic ties to Russia, which has emboldened Putin to fight harder. I remind people that Putin is wanted by the ICC for mass-kidnapping of Ukrainian children. Don't forget the Bucha massacre, the [genocidal rhetoric](https://www.youtube.com/watch?v=I5yvjyJdDW0), the poison-gas attacks, or the executions on video of Ukrainian POWs. Don't forget the Human Safari (Documentary [one](https://www.youtube.com/watch?v=yaAUV3JmxwM), [two](https://khersonhumansafari.com/), [three](https://www.youtube.com/watch?v=xZ60RwJk88A)). Don't forget that Russia still maintains enormous demands that the Ukrainian people can't accept, including giving up the fortress belt that protects Ukraine from Russian advances in the Donbass region, the Ukrainian-held city of Zaporizhzhia (pre-war population: over 700,000), the Ukrainian-held city of Kherson, two large bridgeheads over the Dnipro river, and most recently, [the Russians claim "Novorussiya"](https://x.com/DPiepgrass/status/1903806027872809231) ― two extra provinces, to turn Ukraine into a landlocked country in order to destroy Ukraine's economy. They also want to prevent Ukraine from having effective guarantees against further attacks. Don't forget that Russia destroys every city before taking it, because they don't want infrastructure, they want a Russian empire bordered by a Europe filled with Ukrainian refugees. In short, they continue to insist that Ukraine give up almost everything valuable and place themselves at the mercy of Russia, and this extremism is why we must ensure that they fail. And now, back to 2022:]

Without electricity, reports from Mariupol have been limited, but certainly there is enough information to see that the situation is very bad.

![Mariupol apartment bombed](http://david.loyc.net/misc/ukraine/Mariupol-explosion.webp)

Here you can see the famous Donetsk Academic Regional Drama Theatre, labeled "дети" ("children") in huge letters, which held over 1,000 civilians. Russia bombed it anyway.

![Mariupol theatre](http://david.loyc.net/misc/ukraine/Mariupol-theatre-children.webp)
![Mariupol theatre before](http://david.loyc.net/misc/ukraine/Mariupol-theatre-children-before.jpg)

For more images and stories from Mariupol, [see here](https://twitter.com/DPiepgrass/status/1506642788074536965).

Meanwhile, I hope you don't live in an apartment in [Borodyanka](https://euromaidanpress.com/2022/03/06/close-the-sky-or-how-russia-bombed-out-my-town-of-borodyanka), near Kyiv...

![Borodyanka 1](http://david.loyc.net/misc/ukraine/central-Borodyanka-after.jpeg)
![Borodyanka 2](http://david.loyc.net/misc/ukraine/Borodyanka.png)

Or in these other places...

![Before/after](http://david.loyc.net/misc/ukraine/before-after.jpg)
![Chernihiv](http://david.loyc.net/misc/ukraine/Chernihiv-before-after.webp)
![Irpin](http://david.loyc.net/misc/ukraine/Irpin-burns.webp)
![Kharkiv](http://david.loyc.net/misc/ukraine/Kharkiv-firefighters-rubble.webp)
![Kharkiv](http://david.loyc.net/misc/ukraine/Kharkiv-two-dead.webp)

It was true in 2022 and remains true in 2025: **Russia will not stop until it is stopped.** Democracies are on the decline globally ― as India, Hungary and Turkey slide into authoritarianism, the internet fills with dis/misinformation, some of it generated by dictatorships, while China prepares to blockade and invade Taiwan. Russia has turned totalitarian, and now Russia wants to destroy yet another democracy after previously invading Chechnya, Georgia, and Ukraine (in 2014). Please care about this, because democracies need to stick together. The intensity of the war hasn't slowed down after three years; instead, Russia spent a majority of its cash reserves to ramp up attacks (see [Inside Russia](https://www.youtube.com/@INSIDERUSSIA) and [Ukraine Matters](https://www.youtube.com/@UkraineMatters)). Ukrainians want peace, but they also want to keep their democracy, their homes, their land and their livelihoods (see [Ukrainian public opinion survey](https://www.ipsos.com/en/survey-ukranian-citizens)). They have fought long and hard, and remain willing, but can only succeed with strong western support. Russian cash will not last forever, and our economies are much stronger than Russia's.

Ukrainians have the only army in the world that knows how to fight a modern war, and they manufacture more drones than any country besides China and maybe Russia. If we let Ukraine lose, we lose their military strength and production capacity at a time when we might well need it ourselves, for Ukraine is not the only territory that Putin believes belongs to him, nor is Putin the only one who considers starting wars. Ukrainians offer to teach our militaries something they don't know: how to fight a modern drone war. All they want in exchange is to keep existing as a free people, and we in the west can grant them that. Slava Ukrayini, i dyakuyu.

Benchmarks (in milliseconds for integer keys/values)
----------------------------------------------------

- These benchmark results were gathered on my PC in Node v20.11.1, December 2025
- `BTree` is 3 to 5 times faster than `SortedMap` and `SortedSet` in the `collections` package
- `BTree` has similar speed to `RBTree` at smaller sizes, but is faster at very large sizes and uses less memory because it packs many keys into one array instead of allocating an extra heap object for every key.
- If you need [functional persistence](https://en.wikipedia.org/wiki/Persistent_data_structure), `functional-red-black-tree` is remarkably fast for a persistent tree, but `BTree` should require less memory _unless_ you frequently use `clone/with/without` and are saving snapshots of the old tree to prevent garbage collection.
- B+ trees normally use less memory than hashtables (such as the standard `Map`), although in JavaScript this is not guaranteed because the B+ tree's memory efficiency depends on avoiding wasted space in the arrays for each node, and JavaScript provides no way to detect or control the capacity of an array's underlying memory area. Also, `Map` should be faster because it does not sort its keys.
- "Sorted array" refers to `SortedArray<K,V>`, a wrapper class for an array of `[K,V]` pairs. Benchmark results were not gathered for sorted arrays with one million elements (it takes too long).
- "Baseline algorithms" below are typically based on converting the B+ tree to an array (`toArray()`) and doing the operation in that array.

### Insertions at random locations: sorted-btree vs the competition (millisec) ###

    1.16    Insert 1000 pairs in sorted-btree's BTree
    0.39    Insert 1000 pairs in sorted-btree's BTree set (no values)
    3.07    Insert 1000 pairs in collections' SortedMap
    2.44    Insert 1000 pairs in collections' SortedSet (no values)
    1.86    Insert 1000 pairs in functional-red-black-tree
    1.22    Insert 1000 pairs in bintrees' RBTree (no values)
    
    3.25    Insert 10000 pairs in sorted-btree's BTree
    2.31    Insert 10000 pairs in sorted-btree's BTree set (no values)
    21.08   Insert 10000 pairs in collections' SortedMap
    12.66   Insert 10000 pairs in collections' SortedSet (no values)
    4.14    Insert 10000 pairs in functional-red-black-tree
    1.84    Insert 10000 pairs in bintrees' RBTree (no values)
    
    37.29   Insert 100000 pairs in sorted-btree's BTree
    27.88   Insert 100000 pairs in sorted-btree's BTree set (no values)
    329.64  Insert 100000 pairs in collections' SortedMap
    206.27  Insert 100000 pairs in collections' SortedSet (no values)
    81.06   Insert 100000 pairs in functional-red-black-tree
    28.54   Insert 100000 pairs in bintrees' RBTree (no values)
    
    625.89  Insert 1000000 pairs in sorted-btree's BTree
    437.59  Insert 1000000 pairs in sorted-btree's BTree set (no values)
    5673.62 Insert 1000000 pairs in collections' SortedMap
    3496.35 Insert 1000000 pairs in collections' SortedSet (no values)
    1892.51 Insert 1000000 pairs in functional-red-black-tree
    834.54  Insert 1000000 pairs in bintrees' RBTree (no values)

### Insert in order, delete: sorted-btree vs the competition ###

    0.16    Insert 1000 sorted pairs in B+ tree
    0.14    Insert 1000 sorted keys in B+ tree set (no values)
    0.4     Insert 1000 sorted pairs in collections' SortedMap
    0.2     Insert 1000 sorted keys in collections' SortedSet (no values)
    0.24    Insert 1000 sorted pairs in functional-red-black-tree
    0.78    Insert 1000 sorted keys in bintrees' RBTree (no values)
    0.41    Delete every second item in B+ tree
    0.66    Delete every second item in B+ tree set
    0.42    Bulk-delete every second item in B+ tree set
    0.79    Delete every second item in collections' SortedMap
    0.6     Delete every second item in collections' SortedSet
    1.66    Delete every second item in functional-red-black-tree
    1.23    Delete every second item in bintrees' RBTree
    
    2.22    Insert 10000 sorted pairs in B+ tree
    1.52    Insert 10000 sorted keys in B+ tree set (no values)
    3.28    Insert 10000 sorted pairs in collections' SortedMap
    2.4     Insert 10000 sorted keys in collections' SortedSet (no values)
    5.77    Insert 10000 sorted pairs in functional-red-black-tree
    2.48    Insert 10000 sorted keys in bintrees' RBTree (no values)
    2.15    Delete every second item in B+ tree
    2.01    Delete every second item in B+ tree set
    1.26    Bulk-delete every second item in B+ tree set
    5.17    Delete every second item in collections' SortedMap
    4.46    Delete every second item in collections' SortedSet
    7.33    Delete every second item in functional-red-black-tree
    1.82    Delete every second item in bintrees' RBTree
    
    22.26   Insert 100000 sorted pairs in B+ tree
    17      Insert 100000 sorted keys in B+ tree set (no values)
    53.62   Insert 100000 sorted pairs in collections' SortedMap
    34.65   Insert 100000 sorted keys in collections' SortedSet (no values)
    70.5    Insert 100000 sorted pairs in functional-red-black-tree
    29.61   Insert 100000 sorted keys in bintrees' RBTree (no values)
    18.91   Delete every second item in B+ tree
    16.52   Delete every second item in B+ tree set
    5.31    Bulk-delete every second item in B+ tree set
    50.01   Delete every second item in collections' SortedMap
    33.12   Delete every second item in collections' SortedSet
    28.09   Delete every second item in functional-red-black-tree
    13.79   Delete every second item in bintrees' RBTree
    
    239.15  Insert 1000000 sorted pairs in B+ tree
    194.53  Insert 1000000 sorted keys in B+ tree set (no values)
    652.82  Insert 1000000 sorted pairs in collections' SortedMap
    364.85  Insert 1000000 sorted keys in collections' SortedSet (no values)
    833.39  Insert 1000000 sorted pairs in functional-red-black-tree
    367.05  Insert 1000000 sorted keys in bintrees' RBTree (no values)
    177.48  Delete every second item in B+ tree
    137.5   Delete every second item in B+ tree set
    43.13   Bulk-delete every second item in B+ tree set
    407.36  Delete every second item in collections' SortedMap
    349.39  Delete every second item in collections' SortedSet
    337.67  Delete every second item in functional-red-black-tree
    116.74  Delete every second item in bintrees' RBTree

### Insertions at random locations: sorted-btree vs Array vs Map ###

    0.16    Insert 1000 pairs in sorted array
    0.2     Insert 1000 pairs in B+ tree
    0.03    Insert 1000 pairs in ES6 Map (hashtable)
    
    6.04    Insert 10000 pairs in sorted array
    2.66    Insert 10000 pairs in B+ tree
    0.7     Insert 10000 pairs in ES6 Map (hashtable)
    
    1852.77 Insert 100000 pairs in sorted array
    36.07   Insert 100000 pairs in B+ tree
    8.64    Insert 100000 pairs in ES6 Map (hashtable)
    
    SLOW!   Insert 1000000 pairs in sorted array
    613.34  Insert 1000000 pairs in B+ tree
    133.13  Insert 1000000 pairs in ES6 Map (hashtable)

### Insert in order, scan, delete: sorted-btree vs Array vs Map ###

    0.16    Insert 1000 sorted pairs in array
    0.27    Insert 1000 sorted pairs in B+ tree
    0.09    Insert 1000 sorted pairs in Map hashtable
    0.03    Sum of all values with forEach in sorted array: 27414400
    0.09    Sum of all values with forEachPair in B+ tree: 27414400
    0.1     Sum of all values with forEach in B+ tree: 27414400
    0.18    Sum of all values with iterator in B+ tree: 27414400
    0.03    Sum of all values with forEach in Map: 27414400
    0.19    Delete every second item in sorted array
    0.32    Delete every second item in B+ tree
    0.06    Delete every second item in Map hashtable
    
    1.48    Insert 10000 sorted pairs in array
    2.02    Insert 10000 sorted pairs in B+ tree
    0.7     Insert 10000 sorted pairs in Map hashtable
    0.17    Sum of all values with forEach in sorted array: 2727131580
    0.13    Sum of all values with forEachPair in B+ tree: 2727131580
    0.15    Sum of all values with forEach in B+ tree: 2727131580
    1.05    Sum of all values with iterator in B+ tree: 2727131580
    0.11    Sum of all values with forEach in Map: 2727131580
    0.36    Delete every second item in sorted array
    0.62    Delete every second item in B+ tree
    0.18    Delete every second item in Map hashtable
    
    16.46   Insert 100000 sorted pairs in array
    23.9    Insert 100000 sorted pairs in B+ tree
    8.07    Insert 100000 sorted pairs in Map hashtable
    0.95    Sum of all values with forEach in sorted array: 274463815510
    1.4     Sum of all values with forEachPair in B+ tree: 274463815510
    1.37    Sum of all values with forEach in B+ tree: 274463815510
    1.61    Sum of all values with iterator in B+ tree: 274463815510
    0.82    Sum of all values with forEach in Map: 274463815510
    1478.85 Delete every second item in sorted array
    7.69    Delete every second item in B+ tree
    2.32    Delete every second item in Map hashtable
    
    298.73  Insert 1000000 sorted pairs in array
    241.94  Insert 1000000 sorted pairs in B+ tree
    125.53  Insert 1000000 sorted pairs in Map hashtable
    12.13   Sum of all values with forEach in sorted array: 27511905926210
    15.43   Sum of all values with forEachPair in B+ tree: 27511905926210
    15.72   Sum of all values with forEach in B+ tree: 27511905926210
    13.65   Sum of all values with iterator in B+ tree: 27511905926210
    8.72    Sum of all values with forEach in Map: 27511905926210
    SLOW!   Delete every second item in sorted array
    79.73   Delete every second item in B+ tree
    85.45   Delete every second item in Map hashtable

### BTree.diffAgainst() ###

    0.3     BTree.diffAgainst 1000 pairs vs 100 pairs
    0.83    BTree.diffAgainst 10000 pairs vs 100 pairs
    0.18    BTree.diffAgainst 10000 pairs vs 1000 pairs
    1.15    BTree.diffAgainst 100000 pairs vs 100 pairs
    2.29    BTree.diffAgainst 100000 pairs vs 1000 pairs
    1.31    BTree.diffAgainst 100000 pairs vs 10000 pairs
    13.04   BTree.diffAgainst 1000000 pairs vs 100 pairs
    13.14   BTree.diffAgainst 1000000 pairs vs 1000 pairs
    14.12   BTree.diffAgainst 1000000 pairs vs 10000 pairs
    15.79   BTree.diffAgainst 1000000 pairs vs 100000 pairs
    
    0.03    BTree.diffAgainst 100 pairs vs cloned copy with 100 extra pairs
    0.14    BTree.diffAgainst 100 pairs vs cloned copy with 1000 extra pairs
    0.31    BTree.diffAgainst 100 pairs vs cloned copy with 10000 extra pairs
    2.09    BTree.diffAgainst 100 pairs vs cloned copy with 100000 extra pairs
    26.64   BTree.diffAgainst 100 pairs vs cloned copy with 1000000 extra pairs
    0.15    BTree.diffAgainst 1000 pairs vs cloned copy with 100 extra pairs
    0.27    BTree.diffAgainst 1000 pairs vs cloned copy with 1000 extra pairs
    0.39    BTree.diffAgainst 1000 pairs vs cloned copy with 10000 extra pairs
    2.29    BTree.diffAgainst 1000 pairs vs cloned copy with 100000 extra pairs
    29.45   BTree.diffAgainst 1000 pairs vs cloned copy with 1000000 extra pairs
    0.09    BTree.diffAgainst 10000 pairs vs cloned copy with 100 extra pairs
    0.4     BTree.diffAgainst 10000 pairs vs cloned copy with 1000 extra pairs
    0.58    BTree.diffAgainst 10000 pairs vs cloned copy with 10000 extra pairs
    2.99    BTree.diffAgainst 10000 pairs vs cloned copy with 100000 extra pairs
    29.59   BTree.diffAgainst 10000 pairs vs cloned copy with 1000000 extra pairs
    0.2     BTree.diffAgainst 100000 pairs vs cloned copy with 100 extra pairs
    1.02    BTree.diffAgainst 100000 pairs vs cloned copy with 1000 extra pairs
    3.71    BTree.diffAgainst 100000 pairs vs cloned copy with 10000 extra pairs
    7.58    BTree.diffAgainst 100000 pairs vs cloned copy with 100000 extra pairs
    34.55   BTree.diffAgainst 100000 pairs vs cloned copy with 1000000 extra pairs
    0.38    BTree.diffAgainst 1000000 pairs vs cloned copy with 100 extra pairs
    4.29    BTree.diffAgainst 1000000 pairs vs cloned copy with 1000 extra pairs
    18.86   BTree.diffAgainst 1000000 pairs vs cloned copy with 10000 extra pairs
    48.21   BTree.diffAgainst 1000000 pairs vs cloned copy with 100000 extra pairs
    90.29   BTree.diffAgainst 1000000 pairs vs cloned copy with 1000000 extra pairs

### Accelerated union of B+ trees (vs non-accelerated baseline algorithm) ###

#### Adjacent ranges (one intersection point)

    0.04    union():  Union 100+100 trees with 1 keys overlaping
            union():  6/10 shared nodes, 0/10 underfilled nodes, 65.00% average load factor
    0.2     union():  Union 1000+1000 trees with 1 keys overlaping
            union():  62/70 shared nodes, 0/70 underfilled nodes, 92.32% average load factor
    0.22    union():  Union 10000+10000 trees with 1 keys overlaping
            union():  641/650 shared nodes, 0/650 underfilled nodes, 99.27% average load factor
    0.1     union():  Union 100000+100000 trees with 1 keys overlaping
            union():  6446/6459 shared nodes, 0/6459 underfilled nodes, 99.89% average load factor

#### 10% overlap

    0.01    union():  Union trees with 10% overlap (100+100 keys)
            union():  6/9 shared nodes, 0/9 underfilled nodes, 68.75% average load factor
    0.02    baseline: Union trees with 10% overlap (100+100 keys)
            baseline: 2/7 shared nodes, 0/7 underfilled nodes, 87.50% average load factor
    0.03    union():  Union trees with 10% overlap (1000+1000 keys)
            union():  56/66 shared nodes, 0/66 underfilled nodes, 93.04% average load factor
    0.21    baseline: Union trees with 10% overlap (1000+1000 keys)
            baseline: 28/63 shared nodes, 0/63 underfilled nodes, 97.32% average load factor
    0.12    union():  Union trees with 10% overlap (10000+10000 keys)
            union():  578/630 shared nodes, 0/630 underfilled nodes, 97.37% average load factor
    2.33    baseline: Union trees with 10% overlap (10000+10000 keys)
            baseline: 289/614 shared nodes, 0/614 underfilled nodes, 99.82% average load factor
    1.42    union():  Union trees with 10% overlap (100000+100000 keys)
            union():  5803/6276 shared nodes, 0/6276 underfilled nodes, 97.73% average load factor
    24.69   baseline: Union trees with 10% overlap (100000+100000 keys)
            baseline: 2901/6131 shared nodes, 0/6131 underfilled nodes, 99.97% average load factor

#### Large sparse-overlap trees (1M keys each, 10 overlaps per 100k)

    0.5     union():  Union 1000000+1000000 sparse-overlap trees
            union():  64461/64552 shared nodes, 0/64552 underfilled nodes, 99.94% average load factor
    288.2   baseline: Union 1000000+1000000 sparse-overlap trees
            baseline: 32223/64516 shared nodes, 0/64516 underfilled nodes, 100.00% average load factor
    
### Subtraction of B+ trees (vs non-accelerated baseline algorithm) ###

#### Non-overlapping ranges (nothing removed)

    0.01    subtract: Subtract 100+100 disjoint trees
            subtract: 4/5 shared nodes, 0/5 underfilled nodes, 65.00% average load factor
    0.02    baseline: Subtract 100+100 disjoint trees
            baseline: 4/5 shared nodes, 0/5 underfilled nodes, 65.00% average load factor
    0.01    subtract: Subtract 1000+1000 disjoint trees
            subtract: 33/33 shared nodes, 0/33 underfilled nodes, 97.73% average load factor
    0.18    baseline: Subtract 1000+1000 disjoint trees
            baseline: 32/33 shared nodes, 0/33 underfilled nodes, 97.73% average load factor
    0.01    subtract: Subtract 10000+10000 disjoint trees
            subtract: 323/324 shared nodes, 0/324 underfilled nodes, 99.57% average load factor
    0.38    baseline: Subtract 10000+10000 disjoint trees
            baseline: 323/324 shared nodes, 0/324 underfilled nodes, 99.57% average load factor
    0.01    subtract: Subtract 100000+100000 disjoint trees
            subtract: 3227/3228 shared nodes, 0/3228 underfilled nodes, 99.93% average load factor
    2.55    baseline: Subtract 100000+100000 disjoint trees
            baseline: 3227/3228 shared nodes, 0/3228 underfilled nodes, 99.93% average load factor

#### Partial overlap (middle segment removed)

    0.03    subtract: Subtract 100+50 partially overlapping trees
            subtract: 1/3 shared nodes, 0/3 underfilled nodes, 54.17% average load factor
    0.03    baseline: Subtract 100+50 partially overlapping trees
            baseline: 1/3 shared nodes, 0/3 underfilled nodes, 54.17% average load factor
    0.23    subtract: Subtract 1000+500 partially overlapping trees
            subtract: 15/18 shared nodes, 0/18 underfilled nodes, 89.76% average load factor
    0.31    baseline: Subtract 1000+500 partially overlapping trees
            baseline: 15/18 shared nodes, 1/18 underfilled nodes, 89.76% average load factor
    0.94    subtract: Subtract 10000+5000 partially overlapping trees
            subtract: 159/164 shared nodes, 0/164 underfilled nodes, 98.38% average load factor
    2.12    baseline: Subtract 10000+5000 partially overlapping trees
            baseline: 160/163 shared nodes, 0/163 underfilled nodes, 98.96% average load factor
    3.82    subtract: Subtract 100000+50000 partially overlapping trees
            subtract: 1608/1619 shared nodes, 0/1619 underfilled nodes, 99.63% average load factor
    17.3    baseline: Subtract 100000+50000 partially overlapping trees
            baseline: 1610/1616 shared nodes, 0/1616 underfilled nodes, 99.81% average load factor

#### Interleaved keys (every other key removed)

    0.02    subtract: Subtract 200-100 interleaved trees
            subtract: 0/6 shared nodes, 0/6 underfilled nodes, 54.69% average load factor
    0.08    baseline: Subtract 200-100 interleaved trees
            baseline: 0/5 shared nodes, 1/5 underfilled nodes, 65.00% average load factor
    0.15    subtract: Subtract 2000-1000 interleaved trees
            subtract: 0/47 shared nodes, 0/47 underfilled nodes, 69.55% average load factor
    0.54    baseline: Subtract 2000-1000 interleaved trees
            baseline: 0/33 shared nodes, 0/33 underfilled nodes, 97.73% average load factor
    1.94    subtract: Subtract 20000-10000 interleaved trees
            subtract: 0/463 shared nodes, 0/463 underfilled nodes, 70.61% average load factor
    3.14    baseline: Subtract 20000-10000 interleaved trees
            baseline: 0/324 shared nodes, 0/324 underfilled nodes, 99.57% average load factor
    20.97   subtract: Subtract 200000-100000 interleaved trees
            subtract: 0/4636 shared nodes, 0/4636 underfilled nodes, 70.53% average load factor
    39.68   baseline: Subtract 200000-100000 interleaved trees
            baseline: 0/3229 shared nodes, 2/3229 underfilled nodes, 99.90% average load factor

#### Large sparse-overlap trees (1M keys each, 10 overlaps per 100k)

    0.25    subtract: Subtract 1000000+1000000 sparse-overlap trees
            subtract: 32208/32291 shared nodes, 0/32291 underfilled nodes, 99.89% average load factor
    49.97   baseline: Subtract 1000000+1000000 sparse-overlap trees
            baseline: 32228/32259 shared nodes, 0/32259 underfilled nodes, 99.99% average load factor

### Intersection between B+ trees (vs non-accelerated baseline algorithm) ###

#### Non-overlapping ranges (no shared keys)

    0.01    intersect: Intersect 100+100 disjoint trees
            intersect: 0/0 shared nodes, 0/0 underfilled nodes, 0.00% average load factor
    0.04    baseline:  Intersect 100+100 disjoint trees
            baseline:  0/0 shared nodes, 0/0 underfilled nodes, 0.00% average load factor
    0.01    intersect: Intersect 1000+1000 disjoint trees
            intersect: 0/0 shared nodes, 0/0 underfilled nodes, 0.00% average load factor
    0.08    baseline:  Intersect 1000+1000 disjoint trees
            baseline:  0/0 shared nodes, 0/0 underfilled nodes, 0.00% average load factor
    0       intersect: Intersect 10000+10000 disjoint trees
            intersect: 0/0 shared nodes, 0/0 underfilled nodes, 0.00% average load factor
    0.57    baseline:  Intersect 10000+10000 disjoint trees
            baseline:  0/0 shared nodes, 0/0 underfilled nodes, 0.00% average load factor
    0       intersect: Intersect 100000+100000 disjoint trees
            intersect: 0/0 shared nodes, 0/0 underfilled nodes, 0.00% average load factor
    10.02   baseline:  Intersect 100000+100000 disjoint trees
            baseline:  0/0 shared nodes, 0/0 underfilled nodes, 0.00% average load factor

#### Partial overlap (middle segment shared)

    0.02    intersect: Intersect 100+50 partially overlapping trees
            intersect: 0/3 shared nodes, 0/3 underfilled nodes, 54.17% average load factor
    0.02    baseline:  Intersect 100+50 partially overlapping trees
            baseline:  0/3 shared nodes, 0/3 underfilled nodes, 54.17% average load factor
    0.14    intersect: Intersect 1000+500 partially overlapping trees
            intersect: 0/21 shared nodes, 0/21 underfilled nodes, 77.38% average load factor
    0.51    baseline:  Intersect 1000+500 partially overlapping trees
            baseline:  0/17 shared nodes, 0/17 underfilled nodes, 94.85% average load factor
    0.62    intersect: Intersect 10000+5000 partially overlapping trees
            intersect: 0/202 shared nodes, 0/202 underfilled nodes, 80.46% average load factor
    1.71    baseline:  Intersect 10000+5000 partially overlapping trees
            baseline:  0/163 shared nodes, 0/163 underfilled nodes, 98.96% average load factor
    4.65    intersect: Intersect 100000+50000 partially overlapping trees
            intersect: 0/2002 shared nodes, 0/2002 underfilled nodes, 81.17% average load factor
    17.16   baseline:  Intersect 100000+50000 partially overlapping trees
            baseline:  0/1615 shared nodes, 0/1615 underfilled nodes, 99.87% average load factor

#### Interleaved keys (every other key shared)

    0.01    intersect: Intersect 200+100 interleaved trees
            intersect: 0/5 shared nodes, 0/5 underfilled nodes, 65.00% average load factor
    0.02    baseline:  Intersect 200+100 interleaved trees
            baseline:  0/5 shared nodes, 0/5 underfilled nodes, 65.00% average load factor
    0.17    intersect: Intersect 2000+1000 interleaved trees
            intersect: 0/42 shared nodes, 0/42 underfilled nodes, 77.46% average load factor
    0.28    baseline:  Intersect 2000+1000 interleaved trees
            baseline:  0/33 shared nodes, 0/33 underfilled nodes, 97.73% average load factor
    1.11    intersect: Intersect 20000+10000 interleaved trees
            intersect: 0/401 shared nodes, 0/401 underfilled nodes, 81.05% average load factor
    3.16    baseline:  Intersect 20000+10000 interleaved trees
            baseline:  0/324 shared nodes, 0/324 underfilled nodes, 99.57% average load factor
    12.65   intersect: Intersect 200000+100000 interleaved trees
            intersect: 0/4002 shared nodes, 0/4002 underfilled nodes, 81.21% average load factor
    73.05   baseline:  Intersect 200000+100000 interleaved trees
            baseline:  0/3228 shared nodes, 0/3228 underfilled nodes, 99.93% average load factor

#### Large sparse-overlap trees (1M keys each, 10 overlaps per 100k)

    0.02    intersect: Intersect 1000000+1000000 sparse-overlap trees
            intersect: 0/5 shared nodes, 0/5 underfilled nodes, 65.00% average load factor
    327.57  baseline:  Intersect 1000000+1000000 sparse-overlap trees
            baseline:  0/5 shared nodes, 0/5 underfilled nodes, 65.00% average load factor

### forEachKeyInBoth ###

#### Non-overlapping ranges (no shared keys)

    0       forEachKeyInBoth: [count=0, checksum=0]
    0       forEachKeyInBoth: [count=0, checksum=0]
    0       forEachKeyInBoth: [count=0, checksum=0]
    0       forEachKeyInBoth: [count=0, checksum=0]

#### 50% overlapping ranges

    0.01    forEachKeyInBoth: [count=50, checksum=11175]
    0.09    forEachKeyInBoth: [count=500, checksum=1124250]
    0.89    forEachKeyInBoth: [count=5000, checksum=112492500]
    2.14    forEachKeyInBoth: [count=50000, checksum=11249925000]

#### Random overlaps (~10% shared keys)

    0.01    forEachKeyInBoth: [count=22, checksum=70248]
    0.09    forEachKeyInBoth: [count=252, checksum=7524384]
    1.32    forEachKeyInBoth: [count=2409, checksum=772269240]
    9.69    forEachKeyInBoth: [count=24895, checksum=80459452812]

#### Large sparse-overlap trees (1M keys each, 10 overlaps per 100k)

    0.01    forEachKeyInBoth: [count=100, checksum=360003600]

### forEachKeyNotIn ###

#### Non-overlapping ranges (all keys survive)

    0.02    forEachKeyNotIn: [count=100, checksum=4950]
    0.41    forEachKeyNotIn: [count=1000, checksum=499500]
    3.04    forEachKeyNotIn: [count=10000, checksum=49995000]
    4.93    forEachKeyNotIn: [count=100000, checksum=4999950000]

#### 50% overlapping ranges

    0.03    forEachKeyNotIn: [count=50, checksum=1225]
    0.18    forEachKeyNotIn: [count=500, checksum=124750]
    0.99    forEachKeyNotIn: [count=5000, checksum=12497500]
    7.02    forEachKeyNotIn: [count=50000, checksum=1249975000]

#### Random overlaps (~10% of include removed)

    0.01    forEachKeyNotIn: [count=67, checksum=83085]
    0.07    forEachKeyNotIn: [count=743, checksum=10109320]
    1.5     forEachKeyNotIn: [count=7492, checksum=1035797435]
    8.29    forEachKeyNotIn: [count=75400, checksum=104318180340]

#### Large sparse-overlap trees (1M keys each, 10 overlaps per 100k)

    33.03   forEachKeyNotIn: [count=999900, checksum=499954499550]

Version history
---------------

### v2.1.2 ###

- Fix `IMapSource.forEach` having incorrectly mandatory `thisArg`
- [PR from Taylor Williams](https://github.com/qwertie/btree-typescript/pull/54):
  - Fixed an issue in which certain extended algorithms misbehave when two non-empty key-identical trees are processed with compareFn => undefined, resulting in a malformed tree.
  - Updated documentation of the extended algorithms with correct complexity bounds

### v2.1.1 ###

- Make `BTree` also available as non-default export (#35)

### v2.1.0 ###

- Introduced the new `sorted-btree/extended` entry point that holds `BTreeEx`. The default `sorted-btree` export stays lean (tree-shakable) while the extended build keeps parity with the old API surface.
  - Thanks to Microsoft, Taylor Williams and Craig Macomber for these new features.
- Added a dedicated `sorted-btree/extended/diffAgainst` entry so apps can import just the standalone diff helper without pulling in `BTreeEx`.
- **Breaking change:** `diffAgainst` is no longer available on the default `BTree` export. Switch to `BTreeEx#diffAgainst` (imported from `sorted-btree/extended`) or the standalone `diffAgainst(treeA, treeB, ...)` helper to continue using the diff API.
- `checkValid` now has a parameter `checkOrdering = false` for more thorough checking

### v1.8.0 ###

- Argument of `ISortedSetSource.nextHigherKey(key: K)` changed to `key?: K`
- Argument of `ISortedSetSource.nextLowerKey(key: K)` changed to `key?: K`
- Argument of `ISortedMapSource.nextHigherPair(key: K)` changed to `key?: K`
- Argument of `ISortedMapSource.nextLowerPair(key: K)` changed to `key?: K`

### v1.7.0 ###

- Added `asSet` method, defined as follows: `asSet<K,V>(btree: BTree<K,V>): undefined extends V ? ISortedSet<K> : unknown { return btree as any; }`

### v1.6.2 ###

- Bug fixes: two rare situations were discovered in which shared nodes could fail to be marked as shared, and as a result, mutations could affect copies that should have been completely separate.
- Bug fix: greedyClone(true) did not clone shared nodes recursively.

### v1.6.0 ###

- Added `BTree.getPairOrNextLower` and `BTree.getPairOrNextHigher` methods (PR #23)
- Added optional second parameter `reusedArray` to `nextHigherPair` and `nextLowerPair` (PR #23)
- Optimizations added in `diffAgainst` (PR #24) and `nextLowerPair` (PR #23)

### v1.5.0 ###

- Added `BTree.diffAgainst` method (PR #16)
- Added `simpleComparator` function (PR #15)
- Improved `defaultComparator` (PR #15) to support edge cases better. Most notably, heterogenous key types will no longer cause trouble such as failure to find keys that are, in fact, present in the tree. `BTree` is slightly slower using the new default comparator, but the benchmarks above have not been refreshed. For maximum performance, use `simpleComparator` or a custom comparator as the second constructor parameter. The simplest possible comparator is `(a, b) => a - b`, which works for finite numbers only.

### v1.4.0 ###

- Now built as CommonJS module instead of UMD module, for better compatibility with webpack. No semantic change.

### v1.3.0 ###

- Now built with TypeScript v3.8.3. No semantic change.

### v1.2.4 ###

- Issue #9 fixed: `nextLowerPair(0)` was being treated like `nextLowerPair(undefined)`, and `nextLowerPair(undefined)` was returning the second-highest pair when it should have returned the highest pair.

### v1.2.3 ###

- Important bug fix in deletion code avoids occasional tree corruption that can occur after a series of delete operations
- Add `typings` option in package.json so that `tsc` works for end-users

### v1.2 ###

- Added a complete lattice of interfaces as described above.
- Interfaces have been moved to a separate *interfaces.d.ts* file which is re-exported by the main module in *b+tree.d.ts*.

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

Are you a C# developer? You might like the similar data structures I made for C# ([BDictionary, BList, etc.](core.loyc.net/collections/alists-part2)), and other [dynamically persistent collection types](http://core.loyc.net/collections/).

You might think that the package name "sorted btree" is overly redundant, but I _did_ make a data structure similar to B+ Tree that is _not_ sorted. I called it the [A-List](http://core.loyc.net/collections/alists-part1) (C#). But yeah, the names `btree` and `bplustree` were already taken, so what was I supposed to do, right?
