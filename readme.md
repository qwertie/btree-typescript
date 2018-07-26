B+ tree
-------

B+ trees are ordered collections of key-value pairs, sorted by key.

This is a fast B+ tree implementation, largely compatible with the standard Map, but with a much more diverse and powerful API. To use it, `import BTree from 'sorted-btree'`.

### Features ###

- Requires ES5 only (`Symbol.iterator` is not required but is used if defined.)
- Supports a custom comparator, which must be passed to the constructor.
- Supports O(1) fast cloning with subtree sharing. This works by marking the
  root node as "shared between instances". This makes the tree read-only 
  with copy-on-edit behavior; both copies of the tree remain mutable.
- API similar to `Map<K,V>` with methods such as `size(), clear()`, 
  `forEach((v,k,tree)=>{}), get(K), set(K,V), has(K), delete(K)`,
  plus iterator functions `keys()`, `values()` and `entries()`.
- For efficiency, when a node fills up, items are shifted to siblings when
  possible to encourage nodes to stay near their capacity.
- Efficiently supports sets (keys without values). The collection does
  not allocate memory for values if the value `undefined` is associated 
  with all keys in a given node.
- Includes neat stuff such as `Range` methods for batch operations
- Throws an exception if you try to use `NaN` as a key, but infinity is allowed.

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

B+ trees normally use memory more efficiently than hashtables (such as the standard `Map`), although in JavaScript this is not guaranteed because the B+ tree's memory efficiency depends on avoiding wasted space in the arrays for each node, and JavaScript provides no way to detect or control the capacity of an array's underlying memory area.

### Custom comparator example ###

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

### Endnote ###

♥ This package was made to help people [learn TypeScript & React](http://typescript-react-primer.loyc.net/).

Are you a C# developer? You might like the similar data structures I made for C#: 
BDictionary, BList, etc. See http://core.loyc.net/collections/
