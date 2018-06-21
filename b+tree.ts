// B+ tree by David Piepgrass. License: MIT

type ForRangeResult = {stop?:boolean} | void;
type EditRangeResult<V> = {value?:V, stop?:boolean, delete?:boolean} | void;
type index = number;

const Delete = {delete: true}, DeleteRange = () => Delete;
const Stop = {stop: true};
const EmptyLeaf = (function() { 
  var n = new BNode<any,any>(); n.isShared = true; return n;
})();

// TODO: it's much simpler and maybe faster to a separate empty array per 
//       node. Test perf of that. (Use shared empty array in shared nodes?)
// Optimization: this array of `undefined`s is used instead of a normal
// array of values in nodes where `undefined` is the only value.
// Its length is extended to max node size on first use; since it can
// be shared between trees with different maximums, its length can only
// increase, never decrease. Its type should be undefined[] but strangely
// TypeScript won't allow the comparison V[] === undefined[]
var undefVals: any[] = [];

function check(fact: boolean, ...args: any[]) {
  if (!fact) {
    args.unshift('B+ tree '); // at beginning of message
    throw args.join(' ');
  }
}

// Informative microbenchmarks & stuff:
// http://www.jayconrod.com/posts/52/a-tour-of-v8-object-representation (very educational)
// https://blog.mozilla.org/luke/2012/10/02/optimizing-javascript-variable-access/ (local vars are faster than properties)
// https://jsperf.com/js-in-operator-vs-alternatives (avoid 'in' operator; `.p!==undefined` faster than `hasOwnProperty('p')` in all browsers)
// https://jsperf.com/instanceof-vs-typeof-vs-constructor-vs-member (speed of type tests varies wildly across browsers)
// https://jsperf.com/detecting-arrays-new (a.constructor===Array is best across browsers, assuming a is an object)
// https://jsperf.com/shallow-cloning-methods (a constructor is faster than Object.create; hand-written clone faster than Object.assign)
// https://jsperf.com/ways-to-fill-an-array (new Array(N) is usually best; slice-and-replace may be even faster)
// https://jsperf.com/math-min-max-vs-ternary-vs-if (Math.min/max is slow on Edge)
// https://jsperf.com/array-vs-property-access-speed (v.x/v.y is faster than a[0]/a[1] in major browsers IF hidden class is constant)
// https://jsperf.com/detect-not-null-or-undefined (`x==null` slightly slower than `x===null||x===undefined` on all browsers)
// Overall, microbenchmarks suggest Firefox is the fastest browser for JavaScript and Edge is the slowest.

/**
 * A reasonably fast B+ tree with a powerful API based on the standard Map.
 * B+ trees are ordered collections of key-value pairs, sorted by key. They
 * tend to use memory more efficiently than hashtables such as the standard Map.
 * 
 * @description
 * The "range" methods (`forEach, forRange, editRange`) will return the number
 * of elements that were scanned. In addition, the callback can return {stop:true}
 * to stop early. If you do this, the return value is the negation of the number of
 * elements that were found. For example, -2 means that two elements were found and
 * then a stop signal was received.
 * 
 * - TODO: Test performance of preallocating values array at max size
 * - TODO: Add fast initialization when a sorted array is provided to constructor
 * - TODO: Unit tests
 * 
 * For more documentation see https://github.com/qwertie/btree-typescript
 *
 * Are you a C# developer? You might like the similar data structures I made for C#: 
 * BDictionary, BList, etc. See http://core.loyc.net/collections/
 * 
 * @author David Piepgrass
 */
export default class BTree<K=any, V=any>
{
  private _root: BNode<K, V> = EmptyLeaf as BNode<K,V>;
  _size: number = 0;
  _maxNodeSize: number;
  _compare: (a:K, b:K) => number;
    
  /**
   * Initializes an empty B+ tree.
   * @param maxNodeSize Branching factor (maximum items or children per node)
   *   Must be in range 4..256. If undefined or <4 then default is used; if >256 then 256.
   * @param compare Custom function to compare pairs of elements in the tree
   */
  public constructor(maxNodeSize?: number, compare?: (a: K, b: K) => number, entries?: [K,V][]) {
    this._maxNodeSize = maxNodeSize as number >= 4 ? Math.min(maxNodeSize!, 256) : 32;
    this._compare = compare || ((a: any, b: any) => a - b);
    if (entries)
      this.setRange(entries);
  }
  
  // ES6 Map<K,V> methods ///////////////////////////////////////////////////

  /** Gets the number of key-value pairs in the tree. */
  get size() { return this._size; }
  
  /** Releases the tree so that its size is 0. */
  clear() {
    this._root = EmptyLeaf as BNode<K,V>;
    this._size = 0;
  }

  /** Runs a function for each key-value pair, in order from smallest to 
   *  largest key.
   * @returns the number of values in the tree, or a negative number if the
   *  callback function halted early as explained in the class description. */
  forEach(callback: (k:K, v:V) => ForRangeResult): number {
    var low = this.minKey(), high = this.maxKey();
    return this.forRange(low!, high!, true, callback);
  }

  /**
   * Finds a pair in the tree and returns the associated value.
   * @returns the value, or undefined if the key was not found.
   * @description Computational complexity: O(log size)
   */
  get(key: K): V | undefined { return this._root.get(key, this); }
  
  /**
   * Adds or overwrites a key-value pair in the B+ tree.
   * @param key the key is used to determine the sort order of
   *        data in the tree.
   * @param value data to associate with the key (optional)
   * @param overwrite Whether to overwrite an existing key-value pair 
   *        (default: true). If this is false and there is an existing
   *        key-value pair then this method has no effect.
   * @returns true if a new key-value pair was added.
   * @description Computational complexity: O(log size)
   * Note: when overwriting a previous entry, the key is updated
   * as well as the value. This has no effect unless the new key
   * has data that does not affect its sort order.
   */
  set(key: K, value: V, overwrite?: boolean): boolean { 
    var result = this._root.set(key, value, overwrite, this);
    if (result === true || result === false)
      return result;
    // Root node has split, so create a new root node.
    this._root = new BNodeInternal<K,V>([this._root, result]);
    return true;
  }
  
  /**
   * Returns true if the key exists in the B+ tree, false if not.
   * Use get() for best performance; use has() if you need to
   * distinguish between "undefined value" and "key not present".
   * @param key Key to detect
   * @description Computational complexity: O(log size)
   */
  has(key: K): boolean { 
    return this.forRange(key, key, true, undefined) !== 0;
  }

  /**
   * Removes a single key-value pair from the B+ tree.
   * @param key Key to find
   * @returns true if a pair was found and removed, false otherwise.
   * @description Computational complexity: O(log size)
   */
  delete(key: K) {
    return this.editRange(key, key, true, DeleteRange) !== 0;
  }

  /** Gets all entries, sorted (currently returns an array, not an iterator) */
  entries() { return this.toArray(); }
  
  /** Gets all keys, sorted (currently returns an array, not an iterator) */
  keys() {
    var results: K[] = [];
    this._root.forRange(this.minKey()!, this.maxKey()!, true, false, this, 
      (k,v) => { results.push(k); });
    return results;
  }
  
  /** Gets all values, sorted by key (currently returns an array, not an iterator) */
  values() {
    var results: V[] = [];
    this._root.forRange(this.minKey()!, this.maxKey()!, true, false, this, 
      (k,v) => { results.push(v); });
    return results;
  }

  
  // Additional methods /////////////////////////////////////////////////////

  /** Returns the maximum number of children/values before nodes will split. */
  get maxNodeSize() {
    return this._maxNodeSize;
  }

  /** Gets the lowest key in the tree. Complexity: O(log size) */
  minKey(): K | undefined { return this._root.minKey(); }
  
  /** Gets the highest key in the tree. Complexity: O(1) */
  maxKey(): K | undefined { return this._root.maxKey(); }

  /** Quickly clones the tree by marking the root node as shared. */
  clone() {
    this._root.isShared = true;
    var result = new BTree<K,V>(this._maxNodeSize, this._compare);
    result._root = this._root;
    result._size = this._size;
    return result;
  }

  /** Gets an array filled with the contents of the tree */
  toArray(maxLength: number = 0x7FFFFFFF): [K,V][] {
    let min = this.minKey(), max = this.maxKey();
    if (min !== undefined)
      return this.getRange(min, max!, true, maxLength)
    return [];
  }

  /** Gets a string representing the tree's data based on toArray(). */
  toString() {
    return this.toArray().toString();
  }

  /** Stores a key-value pair only if the key doesn't already exist in the tree. 
   * @returns true if a new key was added
  */
  setIfNotPresent(key: K, value: V): boolean {
    return this.set(key, value, false);
  }

  /** Edits the value associated with a key in the tree, if it already exists. 
   * @returns true if the key existed, false if not.
  */
  changeIfPresent(key: K, value: V): boolean { 
    return this.editRange(key, key, true, (k,v) => ({value})) !== 0;
  }

  /**
   * Builds an array of pairs from the specified range of keys, sorted by key.
   * Each returned pair is also an array: pair[0] is the key, pair[1] is the value.
   * @param low The first key in the array will be greater than or equal to `low`.
   * @param high This method returns when a key larger than this is reached.
   * @param includeHigh If the `high` key is present, its pair will be included
   *        in the output if and only if this parameter is true. Note: if the
   *        `low` key is present, it is always included in the output.
   * @param maxLength Length limit. getRange will stop scanning the tree when 
   *                  the array reaches this size.
   * @description Computational complexity: O(result.length + log size)
   */
  getRange(low: K, high: K, includeHigh?: boolean, maxLength: number = 0x3FFFFFF): [K,V][] {
    var results: [K,V][] = [];
    this._root.forRange(low, high, includeHigh, false, this, (k,v) => {
      results.push([k,v])
      return results.length > maxLength ? Stop : undefined;
    });
    return results;
  }

  /** Adds all pairs from a list of key-value pairs.
   * @param pairs Pairs to add to this tree. If there are duplicate keys, 
   * later pairs currently overwrite earlier ones (e.g. [[0,1],[0,7]] 
   * associates 0 with 7.)
   * @description Computational complexity: O(pairs.length * log(size + pairs.length))
   */
  setRange(pairs: [K,V][]): this {
    for (var i = 0; i < pairs.length; i++)
      this.set(pairs[i][0], pairs[i][1]);
    return this;
  }

  /**
   * Scans the specified range of keys, in ascending order by key.
   * Note: the callback `onFound` must not insert or remove items in the
   * collection. Doing so may cause incorrect data to be sent to the 
   * callback afterward.
   * @param low The first key scanned will be greater than or equal to `low`.
   * @param high Scanning stops when a key larger than this is reached.
   * @param includeHigh If the `high` key is present, `onFound` is called for
   *        that final pair if and only if this parameter is true.
   * @param onFound A function that is called for each key-value pair. This 
   *        function can return {stop:true} to stop early.
   * @returns The number of values scanned, or a negative number if the
   *        `onFound` halted early, as explained in the class description.
   * @description Computational complexity: O(number of items scanned + log size)
   */
  forRange(low: K, high: K, includeHigh: boolean, onFound: (k:K,v:V,tree?:BTree<K,V>) => ForRangeResult): number {
    return this._root.forRange(low, high, includeHigh, false, this, onFound);
  }

  /**
   * Scans and potentially modifies values for a subsequence of keys.
   * Note: the callback `onFound` must not insert items, remove items or 
   * clone() the collection. Doing so may cause an exception or may cause
   * incorrect data to be sent to the callback afterward.
   * @param low The first key scanned will be greater than or equal to `low`.
   * @param high Scanning stops when a key larger than this is reached.
   * @param includeHigh If the `high` key is present, `onFound` is called for
   *        that final pair if and only if this parameter is true.
   * @param onFound A function that is called for each key-value pair. This 
   *        function can return `{stop:true}` to stop early, `{value:v}` to 
   *        change the value associated with the current key, or 
   *        `{delete:true}` to delete the current pair.
   * @returns The number of values scanned, or a negative number if the
   *        `onFound` halted early, as explained in the class description.
   * @description 
   *   Computational complexity: O(number of items scanned + log size)
   *   Note: if the tree has been cloned with clone(), any shared
   *   nodes are copied before `onFound` is called. This takes O(n) time 
   *   where n is proportional to the amount of shared data scanned.
   */
  editRange(low: K, high: K, includeHigh: boolean, onFound: (k:K,v:V,tree?:BTree<K,V>) => EditRangeResult<V>): number {
    var root = this._root;
    if (root.isShared)
      root = this._root = root.clone();
    try {
      return root.forRange(low, high, includeHigh, true, this, onFound);
    } finally {
      while (root.keys.length <= 1 && !root.isLeaf)
        this._root = root.keys.length === 0 ? EmptyLeaf :
                    (root as any as BNodeInternal<K,V>).children[0];
    }
  }

  /**
   * Removes a range of key-value pairs from the B+ tree.
   * @param low The first key scanned will be greater than or equal to `low`.
   * @param high Scanning stops when a key larger than this is reached.
   * @param includeHigh Specifies whether the `high` key, if present, is deleted.
   * @returns The number of key-value pairs that were deleted.
   * @description Computational complexity: O(log size + number of items deleted)
   */
  deleteRange(low: K, high: K, includeHigh: boolean): number {
    return this.editRange(low, high, includeHigh, DeleteRange);
  }

  /** Scans the tree for signs of serious bugs (e.g. this.size doesn't match
   *  number of elements, internal nodes not caching max element properly...)
   *  Computational complexity: O(number of nodes), i.e. O(size). This method
   *  skips the most expensive test - whether all keys are sorted - but it
   *  does check that maxKey() of the children of internal nodes are sorted. */
  checkValid() {
    var size = this._root.checkValid(0, this);
    check(size === this.size, "size mismatch: counted ", size, "but stored", this.size);
  }
}

/** Leaf node / base class. **************************************************/
class BNode<K,V> {
  // If this is an internal node, _keys[i] is the highest key in children[i].
  keys: K[];
  protected values: V[];
  isShared: true | undefined = undefined;
  get isLeaf() { return (this as any).children === undefined; }
  
  constructor(keys: K[] = [], values?: V[]) {
    this.keys = keys;
    this.values = values || undefVals as any[];
  }

  // Shared methods /////////////////////////////////////////////////////////

  maxKey() {
    return this.keys[this.keys.length-1];
  }

  // If key not found, returns i^failXor where i is the insertion index.
  // Callers that don't care whether there was a match will set failXor=0.
  indexOf(key: K, failXor: number, cmp: (a:K, b:K) => number): index {
    // TODO: benchmark multiple search strategies
    var keys = this.keys;
    var lo = 0, hi = keys.length, mid = hi >> 1;
    while(lo < hi) {
      var c = cmp(keys[mid], key);
      if (c < 0)
        hi = mid;
      else if (!(c <= 0)) // keys[mid] > key or c is NaN
        lo = mid + 1;
      else if (c === 0)
        return mid;
      else if (key === key) // c is NaN or otherwise invalid
        return keys.length;
      else
        throw "BTree: NaN was used as a key";
      mid = (lo + hi) >> 1;
    }
    return mid ^ failXor;

    /*var i = 1;
    if (keys.length >= 4) {
      i = 7;
      if (keys.length >= 16) {
        i = 31;
        if (keys.length >= 64) {
          i = 127;
          i += i < keys.length && cmp(keys[i], key) < 0 ? 64 : -64;
          i += i < keys.length && cmp(keys[i], key) < 0 ? 32 : -32;
        }
        i += i < keys.length && cmp(keys[i], key) < 0 ? 16 : -16;
        i += i < keys.length && cmp(keys[i], key) < 0 ? 8 : -8;
      }
      i += i < keys.length && cmp(keys[i], key) < 0 ? 4 : -4;
      i += i < keys.length && cmp(keys[i], key) < 0 ? 2 : -2;
    }
    i += (i < keys.length && cmp(keys[i], key) < 0 ? 1 : -1);
    if (i < keys.length && cmp(keys[i], key) < 0)
      ++i;
    return i;*/
  }

  // Leaf Node: misc //////////////////////////////////////////////////////////

  minKey() {
    return this.keys[0];
  }

  clone(): BNode<K,V> {
    var v = this.values;
    return new BNode<K,V>(this.keys.slice(0), v === undefVals ? v : v.slice(0));
  }

  get(key: K, tree: BTree<K,V>): V | undefined {
    var i = this.indexOf(key, -1, tree._compare);
    return i < 0 ? undefined : this.values[i];
  }

  checkValid(depth: number, tree: BTree<K,V>): number {
    var kL = this.keys.length, vL = this.values.length;
    check(this.values === undefVals ? kL <= vL : kL === vL,
      "keys/values length mismatch: depth", depth, "with lengths", kL, vL);
    // Note: we don't check for "node too small" because sometimes a node
    // can legitimately have size 1. This occurs if there is a batch 
    // deletion, leaving a node of size 1, and the siblings are full so
    // it can't be merged with adjacent nodes. However, the parent will
    // verify that the average node size is at least half of the maximum.
    check(depth == 0 || kL > 0, "empty leaf at depth", depth);
    return kL;
  }

  // Leaf Node: set & node splitting //////////////////////////////////////////

  set(key: K, value: V, overwrite: boolean|undefined, tree: BTree<K,V>): boolean|BNode<K,V> { 
    var i = this.indexOf(key, -1, tree._compare);
    if (i < 0) {
      // key does not exist yet
      i = ~i;
      tree._size++;
      
      if (this.keys.length < tree._maxNodeSize) {
        return this.insertL(i, key, value, tree);
      } else {
        // This leaf node is full and must split
        var newRightSibling = this.splitOffRightSide(), target: BNode<K,V> = this;
        if (i > this.keys.length) {
          i -= this.keys.length;
          target = newRightSibling;
        }
        target.insertL(i, key, value, tree);
        return newRightSibling;
      }
    } else {
      // Key already exists
      if (overwrite !== false) {
        if (this.values === undefVals) {
          if (value === undefined)
            return false;
          this.values = this.values.slice(0, this.keys.length);
        }
        // usually this is a no-op, but some users may wish to edit the key
        this.keys[i] = key;
        this.values[i] = value;
      }
      return false;
    }
  }

  insertL(i: index, key: K, value: V, tree: BTree<K,V>) {
    this.keys.splice(i, 0, key);
    if (this.values === undefVals) {
      if (value === undefined) {
        while (undefVals.length < tree._maxNodeSize)
          undefVals.push(undefined);
        return true;
      } else {
        this.values = new Array<V>(this.keys.length - 1);
      }
    }
    this.values.splice(i, 0, value);
    return true;
  }
  
  takeFromRight(rhs: BNode<K,V>) {
    // Reminder: parent node must update its copy of key for this node
    // assert: neither node is shared
    // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
    var v = this.values;
    if (rhs.values === undefVals) {
      if (v !== undefVals)
        v.push(undefined as any);
    } else {
      if (v === undefVals)
        v = this.values = this.values.slice(0, this.keys.length);
      v.push(rhs.values.shift()!);
    }
    this.keys.push(rhs.keys.shift()!);
  }

  takeFromLeft(lhs: BNode<K,V>) {
    // Reminder: parent node must update its copy of key for this node
    // assert: neither node is shared
    // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
    var v = this.values;
    if (lhs.values === undefVals) {
      if (v !== undefVals)
        v.unshift(undefined as any);
    } else {
      if (v === undefVals)
        v = this.values = this.values.slice(0, this.keys.length);
      v.unshift(lhs.values.pop()!);
    }
    this.keys.unshift(lhs.keys.pop()!);
  }

  splitOffRightSide(): BNode<K,V> {
    // Reminder: parent node must update its copy of key for this node
    var half = this.keys.length >> 1, keys = this.keys.splice(half);
    var values = this.values === undefVals ? undefVals : this.values.splice(half);
    return new BNode<K,V>(keys, values);
  }

  // Leaf Node: scanning & deletions //////////////////////////////////////////

  forRange(low: K, high: K, includeHigh: boolean|undefined, editMode: boolean, tree: BTree<K,V>, 
           onFound?: (k:K, v:V) => EditRangeResult<V>): number {
    var count = 0;
    var cmp = tree._compare;
    var iLow = this.indexOf(low, 0, cmp);
    var iHigh = high === low ? iLow : this.indexOf(high, -1, cmp);
    if (iHigh < 0)
      iHigh = ~iHigh;
    else if (includeHigh === true)
      iHigh++;
    var keys = this.keys, values = this.values;
    if (onFound !== undefined) {
      for(var i = iLow; i < iHigh; i++) {
        var key = keys[i];
        var result = onFound(key, values[i]);
        if (result !== undefined) {
          if (editMode === true) {
            if (key !== keys[i] || this.isShared === true)
              throw "BTree illegally changed or cloned in editRange";
            if (result.delete) {
              this.keys.splice(i, 1);
              if (this.values !== undefVals)
                this.values.splice(i, 1);
              tree._size--;
              i--;
              iHigh--;
            } else if (result.hasOwnProperty('value')) {
              values![i] = result.value!;
            }
          }
          if (result.stop)
            return -1 - (i - iLow);
        }
      }
    }
    return iHigh - iLow;
  }

  /** Adds entire contents of right-hand sibling (rhs is left unchanged) */
  mergeSibling(rhs: BNode<K,V>) {
    this.keys.push(... rhs.keys);
    if (this.values === undefVals) {
      if (rhs.values === undefVals)
        return;
      this.values = undefVals.slice(0, this.keys.length);
    }
    this.values.push(... rhs.values === undefVals ?
                     rhs.values.slice(0, rhs.keys.length) : rhs.values);
  }
}

/** Internal node (non-leaf node) ********************************************/
class BNodeInternal<K,V> extends BNode<K,V> {
  // Note: conventionally B+ trees have one fewer key than the number of 
  // children, but I find it easier to keep the array lengths equal: each
  // keys[i] caches the value of children[i].maxKey().
  children: BNode<K,V>[];

  constructor(children: BNode<K,V>[], keys?: K[]) {
    if (!keys) {
      keys = new Array<K>(children.length);
      for (var i = 0; i < keys.length; i++)
        keys[i] = children[i].maxKey();
    }
    super(keys);
    this.children = children;
  }

  clone(): BNode<K,V> {
    var children = this.children.slice(0);
    for (var i = 0; i < children.length; i++)
      children[i].isShared = true;
    return new BNodeInternal<K,V>(children, this.keys.slice(0));
  }

  minKey() {
    return this.children[0].minKey();
  }

  get(key: K, tree: BTree<K,V>): V | undefined {
    var i = this.indexOf(key, 0, tree._compare), children = this.children;
    return i < children.length ? children[i].get(key, tree) : undefined;
  }

  checkValid(depth: number, tree: BTree<K,V>) : number {
    var kL = this.keys.length, cL = this.children.length;
    check(kL === cL, "keys/children length mismatch: depth", depth, "lengths", kL, cL);
    check(kL > 1, "internal node has length", kL, "at depth", depth);
    var size = 0, c = this.children, k = this.keys, childSize = 0;
    for (var i = 0; i < cL; i++) {
      size += c[i].checkValid(depth + 1, tree);
      childSize += c[i].keys.length;
      check(size >= childSize, "wtf"); // no way this will ever fail
      check(i === 0 || c[i-1].constructor === c[i].constructor, "type mismatch");
      if (c[i].maxKey() != k[i])
        check(false, "keys[", i, "] =", k[i], "is wrong, should be ", c[i].maxKey(), "at depth", depth);
      if (!(i === 0 || tree._compare(k[i-1], k[i]) < 0))
        check(false, "sort violation at depth", depth, "index", i, "keys", k[i-1], k[i]);
    }
    var toofew;
    if ((toofew = childSize < (tree.maxNodeSize >> 1)*cL) || childSize > tree.maxNodeSize*cL)
      check(false, toofew ? "too few" : "too many", "children (", childSize, size, ") at depth", depth, ", maxNodeSize:", tree.maxNodeSize, "children.length:", cL);
    return size;
  }

  // Internal Node: set & node splitting //////////////////////////////////////

  set(key: K, value: V, overwrite: boolean|undefined, tree: BTree<K,V>): boolean|BNodeInternal<K,V> {
    var c = this.children, max = tree._maxNodeSize;
    var i = Math.max(this.indexOf(key, 0, tree._compare), c.length - 1), child = c[i];
    
    if (child.keys.length >= max) {
      // child is full; we might not be able to insert anything else.
      // Shifting an item to the left or right sibling may avoid a split:
      if (i > 0 && c[i-1].keys.length < max) {
        c[i-1].takeFromRight(child);
        this.keys[i-1] = c[i-1].maxKey();
      } else if (i+1 < c.length && c[i+1].keys.length < max) {
        c[i+1].takeFromLeft(child);
        this.keys[i] = c[i].maxKey();
      }
    }

    var result = child.set(key, value, overwrite, tree);
    if (result === false)
      return false;
    this.keys[i] = child.maxKey();
    if (result === true)
      return true;

    // The child has split and `result` is a new right child... does it fit?
    if (this.keys.length < max) { // yes
      this.insert(i, result);
      return true;
    } else { // no, we must split also
      var newRightSibling = this.splitOffRightSide(), target: BNodeInternal<K,V> = this;
      if (tree._compare(result.maxKey(), this.maxKey()) > 0) {
        target = newRightSibling;
        i -= this.keys.length;
      }
      target.insert(i, result);
      return newRightSibling;
    }
  }

  insert(i: index, child: BNode<K,V>) {
    this.children.splice(i, 0, child);
    this.keys.splice(i, 0, child.maxKey());
  }

  splitOffRightSide() {
    var half = this.children.length >> 1;
    return new BNodeInternal<K,V>(this.children.splice(half), this.keys.splice(half));
  }

  takeFromRight(rhs: BNode<K,V>) {
    // Reminder: parent node must update its copy of key for this node
    // assert: neither node is shared
    // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
    this.keys.push(rhs.keys.shift()!);
    this.children.push((rhs as BNodeInternal<K,V>).children.shift()!);
  }

  takeFromLeft(lhs: BNode<K,V>) {
    // Reminder: parent node must update its copy of key for this node
    // assert: neither node is shared
    // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
    this.keys.unshift(lhs.keys.pop()!);
    this.children.unshift((lhs as BNodeInternal<K,V>).children.pop()!);
  }

  // Internal Node: scanning & deletions //////////////////////////////////////

  forRange(low: K, high: K, includeHigh: boolean|undefined, editMode: boolean, tree: BTree<K,V>, 
    onFound?: (k:K, v:V) => EditRangeResult<V>): number
  {
    var cmp = tree._compare;
    var iLow = this.indexOf(low, 0, cmp), i = iLow;
    var iHigh = Math.max(high === low ? iLow : this.indexOf(high, 0, cmp), this.keys.length-1);
    var keys = this.keys, children = this.children;
    var count = 0, result = 0;
    if (!editMode) {
      // Simple case
      for(; i <= iHigh; i++) {
        result = children[i].forRange(low, high, includeHigh, editMode, tree, onFound);
        if (result < 0)
          return result - count;
        count += result;
      }
    } else {
      try {
        for(; i <= iHigh; i++) {
          if (children[i].isShared)
            children[i] = children[i].clone();
          result = children[i].forRange(low, high, includeHigh, editMode, tree, onFound);
          if (result < 0) {
            count -= result;
            break;
          }
          count += result;
        }
      } finally {
        // Deletions may have occurred, so look for opportunities to merge nodes.
        var half = tree._maxNodeSize >> 1;
        for(i = iLow; i <= iHigh; i++) {
          if (children[i].keys.length <= half) {
            if (this.tryMerge(i-1, tree._maxNodeSize) || this.tryMerge(i, tree._maxNodeSize)) {
              i--; iHigh--;
            }
          }
        }
      }
      if (result < 0)
        return -count;
    }
    return count;
  }

  /** Merges child i with child i+1 if their combined size is not too large */
  tryMerge(i: index, maxSize: number): boolean {
    var children = this.children;
    if (i >= 0 && i + 1 < children.length) {
      if (children[i].keys.length + children[i+1].keys.length <= maxSize) {
        if (children[i].isShared) // cloned already UNLESS i is outside scan range
          children[i] = children[i].clone();
        children[i].mergeSibling(children[i+1]);
        children.splice(i + 1, 1);
        this.keys.splice(i + 1, 1);
        this.keys[i] = children[i].maxKey();
        return true;
      }
    }
    return false;
  }

  mergeSibling(rhs: BNode<K,V>) {
    // assert !this.isShared;
    this.keys.push(... rhs.keys);
    this.children.push(... (rhs as any as BNodeInternal<K,V>).children);
  }
}
