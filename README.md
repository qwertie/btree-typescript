B+ tree
-------

**Not yet tested.**

B+ trees are ordered collections of key-value pairs, sorted by key. They tend to use memory more efficiently than hashtables such as the standard Map. 

To use this implementation, `import BTree<K,V> from 'b+tree'` (??).

- Supports a custom comparator, which must be passed to the constructor.
- Supports O(1) fast cloning with subtree sharing. This works by marking the
  root node as "shared between instances". This makes the tree read-only 
  with copy-on-edit behavior; the collection remains mutable.
- For efficiency, when a node fills up, items are shifted to siblings when
  possible.
- Supports sets efficiently. The collection will use less memory if 
  `undefined` is associated with all keys in a given node.
- Includes neat stuff such as `Range` methods for batch operations
- API similar to `Map<K,V>` with methods such as `size(), clear()`, 
  `foreach((k,v,tree)=>void), get(K), set(K,V), has(K), delete(K)`.
- Iterators are not implemented; `keys()`, `values()` and `entries()` return arrays.
- Duplicate keys are not allowed (supporting duplicates properly is complex).
- Throws an exception if you try to use `NaN` as a key, but infinity is allowed.

Additional operations supported on this B+ tree include:

- Set a value only if the key does not already exist: `t.setIfNotPresent(k,v)`
- Set a value only if the key already exists: `t.changeIfPresent(k,v)`
- Get a range of values: `t.getRange(loK, hiK, includeHi)`
- Delete a range of values: `t.deleteRange(loK, hiK, includeHi)`
- Scan all items (`t.forEach((k,v) => {})`) or a range of items (`t.forRange(...)`)
- Count the number of values in a range: `c = t.forRange(loK, hiK, includeHi, undefined)`
- Generate an array of key-value pairs ([K,V][]): `t.toArray()`
- Fast clone: `t.clone()`
- Get smallest or largest key: `t.minKey()`, `t.maxKey()`

Finally, you can scan a range of items and selectively delete or change some of them using `t.editRange`. For example, the following code adds an exclamation mark to each non-boring value and deletes key number 4:

~~~js
var t = new BTree().setRange([[1,"fun"],[2,"yay"],[4,"whee"],[8,"zany"],[10,"boring"]);
t.editRange(t.minKey(), t.maxKey(), true, (k, v) => {
  if (k === 4) 
    return {delete: true};
  if (v !== "boring")
    return {value: v + '!'};
})
~~~

The "scanning" methods (`forEach, forRange, editRange, deleteRange`) will return the number of elements that were scanned. In addition, the callback can return `{stop:true}` to stop early.

Are you a C# developer? You might like the similar data structures I made for C#: 
BDictionary, BList, etc. See http://core.loyc.net/collections/
