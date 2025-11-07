"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyBTree = exports.asSet = exports.simpleComparator = exports.defaultComparator = void 0;
var assert_1 = require("../internal/assert");
var nodes_1 = require("../internal/nodes");
/**
 * Compares DefaultComparables to form a strict partial ordering.
 *
 * Handles +/-0 and NaN like Map: NaN is equal to NaN, and -0 is equal to +0.
 *
 * Arrays are compared using '<' and '>', which may cause unexpected equality:
 * for example [1] will be considered equal to ['1'].
 *
 * Two objects with equal valueOf compare the same, but compare unequal to
 * primitives that have the same value.
 */
function defaultComparator(a, b) {
    // Special case finite numbers first for performance.
    // Note that the trick of using 'a - b' and checking for NaN to detect non-numbers
    // does not work if the strings are numeric (ex: "5"). This would leading most 
    // comparison functions using that approach to fail to have transitivity.
    if (Number.isFinite(a) && Number.isFinite(b)) {
        return a - b;
    }
    // The default < and > operators are not totally ordered. To allow types to be mixed
    // in a single collection, compare types and order values of different types by type.
    var ta = typeof a;
    var tb = typeof b;
    if (ta !== tb) {
        return ta < tb ? -1 : 1;
    }
    if (ta === 'object') {
        // standardized JavaScript bug: null is not an object, but typeof says it is
        if (a === null)
            return b === null ? 0 : -1;
        else if (b === null)
            return 1;
        a = a.valueOf();
        b = b.valueOf();
        ta = typeof a;
        tb = typeof b;
        // Deal with the two valueOf()s producing different types
        if (ta !== tb) {
            return ta < tb ? -1 : 1;
        }
    }
    // a and b are now the same type, and will be a number, string or array 
    // (which we assume holds numbers or strings), or something unsupported.
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    if (a === b)
        return 0;
    // Order NaN less than other numbers
    if (Number.isNaN(a))
        return Number.isNaN(b) ? 0 : -1;
    else if (Number.isNaN(b))
        return 1;
    // This could be two objects (e.g. [7] and ['7']) that aren't ordered
    return Array.isArray(a) ? 0 : Number.NaN;
}
exports.defaultComparator = defaultComparator;
;
function simpleComparator(a, b) {
    return a > b ? 1 : a < b ? -1 : 0;
}
exports.simpleComparator = simpleComparator;
;
/**
 * A reasonably fast collection of key-value pairs with a powerful API.
 * Largely compatible with the standard Map. BTree is a B+ tree data structure,
 * so the collection is sorted by key.
 *
 * B+ trees tend to use memory more efficiently than hashtables such as the
 * standard Map, especially when the collection contains a large number of
 * items. However, maintaining the sort order makes them modestly slower:
 * O(log size) rather than O(1). This B+ tree implementation supports O(1)
 * fast cloning. It also supports freeze(), which can be used to ensure that
 * a BTree is not changed accidentally.
 *
 * Confusingly, the ES6 Map.forEach(c) method calls c(value,key) instead of
 * c(key,value), in contrast to other methods such as set() and entries()
 * which put the key first. I can only assume that the order was reversed on
 * the theory that users would usually want to examine values and ignore keys.
 * BTree's forEach() therefore works the same way, but a second method
 * `.forEachPair((key,value)=>{...})` is provided which sends you the key
 * first and the value second; this method is slightly faster because it is
 * the "native" for-each method for this class.
 *
 * Out of the box, BTree supports keys that are numbers, strings, arrays of
 * numbers/strings, Date, and objects that have a valueOf() method returning a
 * number or string. Other data types, such as arrays of Date or custom
 * objects, require a custom comparator, which you must pass as the second
 * argument to the constructor (the first argument is an optional list of
 * initial items). Symbols cannot be used as keys because they are unordered
 * (one Symbol is never "greater" or "less" than another).
 *
 * @example
 * Given a {name: string, age: number} object, you can create a tree sorted by
 * name and then by age like this:
 *
 *     var tree = new BTree(undefined, (a, b) => {
 *       if (a.name > b.name)
 *         return 1; // Return a number >0 when a > b
 *       else if (a.name < b.name)
 *         return -1; // Return a number <0 when a < b
 *       else // names are equal (or incomparable)
 *         return a.age - b.age; // Return >0 when a.age > b.age
 *     });
 *
 *     tree.set({name:"Bill", age:17}, "happy");
 *     tree.set({name:"Fran", age:40}, "busy & stressed");
 *     tree.set({name:"Bill", age:55}, "recently laid off");
 *     tree.forEachPair((k, v) => {
 *       console.log(`Name: ${k.name} Age: ${k.age} Status: ${v}`);
 *     });
 *
 * @description
 * The "range" methods (`forEach, forRange, editRange`) will return the number
 * of elements that were scanned. In addition, the callback can return {break:R}
 * to stop early and return R from the outer function.
 *
 * - TODO: Test performance of preallocating values array at max size
 * - TODO: Add fast initialization when a sorted array is provided to constructor
 *
 * For more documentation see https://github.com/qwertie/btree-typescript
 *
 * Are you a C# developer? You might like the similar data structures I made for C#:
 * BDictionary, BList, etc. See http://core.loyc.net/collections/
 *
 * @author David Piepgrass
 */
var BTree = /** @class */ (function () {
    /**
     * Initializes an empty B+ tree.
     * @param compare Custom function to compare pairs of elements in the tree.
     *   If not specified, defaultComparator will be used which is valid as long as K extends DefaultComparable.
     * @param entries A set of key-value pairs to initialize the tree
     * @param maxNodeSize Branching factor (maximum items or children per node)
     *   Must be in range 4..256. If undefined or <4 then default is used; if >256 then 256.
     */
    function BTree(entries, compare, maxNodeSize) {
        this._root = nodes_1.EmptyLeaf;
        this._size = 0;
        this._maxNodeSize = maxNodeSize >= 4 ? Math.min(maxNodeSize, 256) : 32;
        this._compare = compare || defaultComparator;
        if (entries)
            this.setPairs(entries);
    }
    BTree.prototype.asHost = function () {
        return this;
    };
    Object.defineProperty(BTree.prototype, "size", {
        /////////////////////////////////////////////////////////////////////////////
        // ES6 Map<K,V> methods /////////////////////////////////////////////////////
        /** Gets the number of key-value pairs in the tree. */
        get: function () { return this._size; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BTree.prototype, "length", {
        /** Gets the number of key-value pairs in the tree. */
        get: function () { return this._size; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BTree.prototype, "isEmpty", {
        /** Returns true iff the tree contains no key-value pairs. */
        get: function () { return this._size === 0; },
        enumerable: false,
        configurable: true
    });
    /** Releases the tree so that its size is 0. */
    BTree.prototype.clear = function () {
        this._root = nodes_1.EmptyLeaf;
        this._size = 0;
    };
    /** Runs a function for each key-value pair, in order from smallest to
     *  largest key. For compatibility with ES6 Map, the argument order to
     *  the callback is backwards: value first, then key. Call forEachPair
     *  instead to receive the key as the first argument.
     * @param thisArg If provided, this parameter is assigned as the `this`
     *        value for each callback.
     * @returns the number of values that were sent to the callback,
     *        or the R value if the callback returned {break:R}. */
    BTree.prototype.forEach = function (callback, thisArg) {
        var _this = this;
        if (thisArg !== undefined)
            callback = callback.bind(thisArg);
        return this.forEachPair(function (k, v) { return callback(v, k, _this); });
    };
    /** Runs a function for each key-value pair, in order from smallest to
     *  largest key. The callback can return {break:R} (where R is any value
     *  except undefined) to stop immediately and return R from forEachPair.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return {break:R} to stop early with result R.
     *        The reason that you must return {break:R} instead of simply R
     *        itself is for consistency with editRange(), which allows
     *        multiple actions, not just breaking.
     * @param initialCounter This is the value of the third argument of
     *        `onFound` the first time it is called. The counter increases
     *        by one each time `onFound` is called. Default value: 0
     * @returns the number of pairs sent to the callback (plus initialCounter,
     *        if you provided one). If the callback returned {break:R} then
     *        the R value is returned instead. */
    BTree.prototype.forEachPair = function (callback, initialCounter) {
        var low = this.minKey(), high = this.maxKey();
        return this.forRange(low, high, true, callback, initialCounter);
    };
    /**
     * Finds a pair in the tree and returns the associated value.
     * @param defaultValue a value to return if the key was not found.
     * @returns the value, or defaultValue if the key was not found.
     * @description Computational complexity: O(log size)
     */
    BTree.prototype.get = function (key, defaultValue) {
        return this._root.get(key, defaultValue, this.asHost());
    };
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
    BTree.prototype.set = function (key, value, overwrite) {
        if (this._root.isShared)
            this._root = this._root.clone();
        var result = this._root.set(key, value, overwrite, this.asHost());
        if (result === true || result === false)
            return result;
        // Root node has split, so create a new root node.
        this._root = new nodes_1.BNodeInternal([this._root, result]);
        return true;
    };
    /**
     * Returns true if the key exists in the B+ tree, false if not.
     * Use get() for best performance; use has() if you need to
     * distinguish between "undefined value" and "key not present".
     * @param key Key to detect
     * @description Computational complexity: O(log size)
     */
    BTree.prototype.has = function (key) {
        return this.forRange(key, key, true, undefined) !== 0;
    };
    /**
     * Removes a single key-value pair from the B+ tree.
     * @param key Key to find
     * @returns true if a pair was found and removed, false otherwise.
     * @description Computational complexity: O(log size)
     */
    BTree.prototype.delete = function (key) {
        return this.editRange(key, key, true, DeleteRange) !== 0;
    };
    BTree.prototype.with = function (key, value, overwrite) {
        var nu = this.clone();
        return nu.set(key, value, overwrite) || overwrite ? nu : this;
    };
    /** Returns a copy of the tree with the specified key-value pairs set. */
    BTree.prototype.withPairs = function (pairs, overwrite) {
        var nu = this.clone();
        return nu.setPairs(pairs, overwrite) !== 0 || overwrite ? nu : this;
    };
    /** Returns a copy of the tree with the specified keys present.
     *  @param keys The keys to add. If a key is already present in the tree,
     *         neither the existing key nor the existing value is modified.
     *  @param returnThisIfUnchanged if true, returns this if all keys already
     *  existed. Performance note: due to the architecture of this class, all
     *  node(s) leading to existing keys are cloned even if the collection is
     *  ultimately unchanged.
    */
    BTree.prototype.withKeys = function (keys, returnThisIfUnchanged) {
        var nu = this.clone(), changed = false;
        for (var i = 0; i < keys.length; i++)
            changed = nu.set(keys[i], undefined, false) || changed;
        return returnThisIfUnchanged && !changed ? this : nu;
    };
    /** Returns a copy of the tree with the specified key removed.
     * @param returnThisIfUnchanged if true, returns this if the key didn't exist.
     *  Performance note: due to the architecture of this class, node(s) leading
     *  to where the key would have been stored are cloned even when the key
     *  turns out not to exist and the collection is unchanged.
     */
    BTree.prototype.without = function (key, returnThisIfUnchanged) {
        return this.withoutRange(key, key, true, returnThisIfUnchanged);
    };
    /** Returns a copy of the tree with the specified keys removed.
     * @param returnThisIfUnchanged if true, returns this if none of the keys
     *  existed. Performance note: due to the architecture of this class,
     *  node(s) leading to where the key would have been stored are cloned
     *  even when the key turns out not to exist.
     */
    BTree.prototype.withoutKeys = function (keys, returnThisIfUnchanged) {
        var nu = this.clone();
        return nu.deleteKeys(keys) || !returnThisIfUnchanged ? nu : this;
    };
    /** Returns a copy of the tree with the specified range of keys removed. */
    BTree.prototype.withoutRange = function (low, high, includeHigh, returnThisIfUnchanged) {
        var nu = this.clone();
        if (nu.deleteRange(low, high, includeHigh) === 0 && returnThisIfUnchanged)
            return this;
        return nu;
    };
    /** Returns a copy of the tree with pairs removed whenever the callback
     *  function returns false. `where()` is a synonym for this method. */
    BTree.prototype.filter = function (callback, returnThisIfUnchanged) {
        var nu = this.greedyClone();
        var del;
        nu.editAll(function (k, v, i) {
            if (!callback(k, v, i))
                return del = Delete;
        });
        if (!del && returnThisIfUnchanged)
            return this;
        return nu;
    };
    /** Returns a copy of the tree with all values altered by a callback function. */
    BTree.prototype.mapValues = function (callback) {
        var tmp = {};
        var nu = this.greedyClone();
        nu.editAll(function (k, v, i) {
            return tmp.value = callback(v, k, i), tmp;
        });
        return nu;
    };
    BTree.prototype.reduce = function (callback, initialValue) {
        var i = 0, p = initialValue;
        var it = this.entries(this.minKey(), ReusedArray), next;
        while (!(next = it.next()).done)
            p = callback(p, next.value, i++, this);
        return p;
    };
    /////////////////////////////////////////////////////////////////////////////
    // Iterator methods /////////////////////////////////////////////////////////
    /** Returns an iterator that provides items in order (ascending order if
     *  the collection's comparator uses ascending order, as is the default.)
     *  @param lowestKey First key to be iterated, or undefined to start at
     *         minKey(). If the specified key doesn't exist then iteration
     *         starts at the next higher key (according to the comparator).
     *  @param reusedArray Optional array used repeatedly to store key-value
     *         pairs, to avoid creating a new array on every iteration.
     */
    BTree.prototype.entries = function (lowestKey, reusedArray) {
        var info = this.findPath(lowestKey);
        if (info === undefined)
            return iterator();
        var nodequeue = info.nodequeue, nodeindex = info.nodeindex, leaf = info.leaf;
        var state = reusedArray !== undefined ? 1 : 0;
        var i = (lowestKey === undefined ? -1 : leaf.indexOf(lowestKey, 0, this._compare) - 1);
        return iterator(function () {
            jump: for (;;) {
                switch (state) {
                    case 0:
                        if (++i < leaf.keys.length)
                            return { done: false, value: [leaf.keys[i], leaf.values[i]] };
                        state = 2;
                        continue;
                    case 1:
                        if (++i < leaf.keys.length) {
                            reusedArray[0] = leaf.keys[i], reusedArray[1] = leaf.values[i];
                            return { done: false, value: reusedArray };
                        }
                        state = 2;
                    case 2:
                        // Advance to the next leaf node
                        for (var level = -1;;) {
                            if (++level >= nodequeue.length) {
                                state = 3;
                                continue jump;
                            }
                            if (++nodeindex[level] < nodequeue[level].length)
                                break;
                        }
                        for (; level > 0; level--) {
                            nodequeue[level - 1] = nodequeue[level][nodeindex[level]].children;
                            nodeindex[level - 1] = 0;
                        }
                        leaf = nodequeue[0][nodeindex[0]];
                        i = -1;
                        state = reusedArray !== undefined ? 1 : 0;
                        continue;
                    case 3:
                        return { done: true, value: undefined };
                }
            }
        });
    };
    /** Returns an iterator that provides items in reversed order.
     *  @param highestKey Key at which to start iterating, or undefined to
     *         start at maxKey(). If the specified key doesn't exist then iteration
     *         starts at the next lower key (according to the comparator).
     *  @param reusedArray Optional array used repeatedly to store key-value
     *         pairs, to avoid creating a new array on every iteration.
     *  @param skipHighest Iff this flag is true and the highestKey exists in the
     *         collection, the pair matching highestKey is skipped, not iterated.
     */
    BTree.prototype.entriesReversed = function (highestKey, reusedArray, skipHighest) {
        if (highestKey === undefined) {
            highestKey = this.maxKey();
            skipHighest = undefined;
            if (highestKey === undefined)
                return iterator(); // collection is empty
        }
        var _a = this.findPath(highestKey) || this.findPath(this.maxKey()), nodequeue = _a.nodequeue, nodeindex = _a.nodeindex, leaf = _a.leaf;
        (0, assert_1.check)(!nodequeue[0] || leaf === nodequeue[0][nodeindex[0]], "wat!");
        var i = leaf.indexOf(highestKey, 0, this._compare);
        if (!skipHighest && i < leaf.keys.length && this._compare(leaf.keys[i], highestKey) <= 0)
            i++;
        var state = reusedArray !== undefined ? 1 : 0;
        return iterator(function () {
            jump: for (;;) {
                switch (state) {
                    case 0:
                        if (--i >= 0)
                            return { done: false, value: [leaf.keys[i], leaf.values[i]] };
                        state = 2;
                        continue;
                    case 1:
                        if (--i >= 0) {
                            reusedArray[0] = leaf.keys[i], reusedArray[1] = leaf.values[i];
                            return { done: false, value: reusedArray };
                        }
                        state = 2;
                    case 2:
                        // Advance to the next leaf node
                        for (var level = -1;;) {
                            if (++level >= nodequeue.length) {
                                state = 3;
                                continue jump;
                            }
                            if (--nodeindex[level] >= 0)
                                break;
                        }
                        for (; level > 0; level--) {
                            nodequeue[level - 1] = nodequeue[level][nodeindex[level]].children;
                            nodeindex[level - 1] = nodequeue[level - 1].length - 1;
                        }
                        leaf = nodequeue[0][nodeindex[0]];
                        i = leaf.keys.length;
                        state = reusedArray !== undefined ? 1 : 0;
                        continue;
                    case 3:
                        return { done: true, value: undefined };
                }
            }
        });
    };
    /** Returns a new iterator for iterating the keys of each pair in ascending order.
     *  @param firstKey: Minimum key to include in the output. */
    BTree.prototype.keys = function (firstKey) {
        var it = this.entries(firstKey, ReusedArray);
        return iterator(function () {
            var n = it.next();
            if (n.value)
                n.value = n.value[0];
            return n;
        });
    };
    /** Returns a new iterator for iterating the values of each pair in order by key.
     *  @param firstKey: Minimum key whose associated value is included in the output. */
    BTree.prototype.values = function (firstKey) {
        var it = this.entries(firstKey, ReusedArray);
        return iterator(function () {
            var n = it.next();
            if (n.value)
                n.value = n.value[1];
            return n;
        });
    };
    /* Used by entries() and entriesReversed() to prepare to start iterating.
     * It develops a "node queue" for each non-leaf level of the tree.
     * Levels are numbered "bottom-up" so that level 0 is a list of leaf
     * nodes from a low-level non-leaf node. The queue at a given level L
     * consists of nodequeue[L] which is the children of a BNodeInternal,
     * and nodeindex[L], the current index within that child list, such
     * such that nodequeue[L-1] === nodequeue[L][nodeindex[L]].children.
     * (However inside this function the order is reversed.)
     */
    BTree.prototype.findPath = function (key) {
        var nextnode = this._root;
        var nodequeue, nodeindex;
        if (nextnode.isLeaf) {
            nodequeue = EmptyArray, nodeindex = EmptyArray; // avoid allocations
        }
        else {
            nodequeue = [], nodeindex = [];
            for (var d = 0; !nextnode.isLeaf; d++) {
                nodequeue[d] = nextnode.children;
                nodeindex[d] = key === undefined ? 0 : nextnode.indexOf(key, 0, this._compare);
                if (nodeindex[d] >= nodequeue[d].length)
                    return; // first key > maxKey()
                nextnode = nodequeue[d][nodeindex[d]];
            }
            nodequeue.reverse();
            nodeindex.reverse();
        }
        return { nodequeue: nodequeue, nodeindex: nodeindex, leaf: nextnode };
    };
    Object.defineProperty(BTree.prototype, "maxNodeSize", {
        /////////////////////////////////////////////////////////////////////////////
        // Additional methods ///////////////////////////////////////////////////////
        /** Returns the maximum number of children/values before nodes will split. */
        get: function () {
            return this._maxNodeSize;
        },
        enumerable: false,
        configurable: true
    });
    /** Gets the lowest key in the tree. Complexity: O(log size) */
    BTree.prototype.minKey = function () { return this._root.minKey(); };
    /** Gets the highest key in the tree. Complexity: O(1) */
    BTree.prototype.maxKey = function () { return this._root.maxKey(); };
    /** Quickly clones the tree by marking the root node as shared.
     *  Both copies remain editable. When you modify either copy, any
     *  nodes that are shared (or potentially shared) between the two
     *  copies are cloned so that the changes do not affect other copies.
     *  This is known as copy-on-write behavior, or "lazy copying". */
    BTree.prototype.clone = function () {
        this._root.isShared = true;
        var result = new BTree(undefined, this._compare, this._maxNodeSize);
        result._root = this._root;
        result._size = this._size;
        return result;
    };
    /** Performs a greedy clone, immediately duplicating any nodes that are
     *  not currently marked as shared, in order to avoid marking any
     *  additional nodes as shared.
     *  @param force Clone all nodes, even shared ones.
     */
    BTree.prototype.greedyClone = function (force) {
        var result = new BTree(undefined, this._compare, this._maxNodeSize);
        result._root = this._root.greedyClone(force);
        result._size = this._size;
        return result;
    };
    /** Gets an array filled with the contents of the tree, sorted by key */
    BTree.prototype.toArray = function (maxLength) {
        if (maxLength === void 0) { maxLength = 0x7FFFFFFF; }
        var min = this.minKey(), max = this.maxKey();
        if (min !== undefined)
            return this.getRange(min, max, true, maxLength);
        return [];
    };
    /** Gets an array of all keys, sorted */
    BTree.prototype.keysArray = function () {
        var results = [];
        this._root.forRange(this.minKey(), this.maxKey(), true, false, this.asHost(), 0, function (k, v) { results.push(k); });
        return results;
    };
    /** Gets an array of all values, sorted by key */
    BTree.prototype.valuesArray = function () {
        var results = [];
        this._root.forRange(this.minKey(), this.maxKey(), true, false, this.asHost(), 0, function (k, v) { results.push(v); });
        return results;
    };
    /** Gets a string representing the tree's data based on toArray(). */
    BTree.prototype.toString = function () {
        return this.toArray().toString();
    };
    /** Stores a key-value pair only if the key doesn't already exist in the tree.
     * @returns true if a new key was added
    */
    BTree.prototype.setIfNotPresent = function (key, value) {
        return this.set(key, value, false);
    };
    /** Returns the next pair whose key is larger than the specified key (or undefined if there is none).
     * If key === undefined, this function returns the lowest pair.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     * avoid creating a new array on every iteration.
     */
    BTree.prototype.nextHigherPair = function (key, reusedArray) {
        reusedArray = reusedArray || [];
        if (key === undefined) {
            return this._root.minPair(reusedArray);
        }
        return this._root.getPairOrNextHigher(key, this._compare, false, reusedArray);
    };
    /** Returns the next key larger than the specified key, or undefined if there is none.
     *  Also, nextHigherKey(undefined) returns the lowest key.
     */
    BTree.prototype.nextHigherKey = function (key) {
        var p = this.nextHigherPair(key, ReusedArray);
        return p && p[0];
    };
    /** Returns the next pair whose key is smaller than the specified key (or undefined if there is none).
     *  If key === undefined, this function returns the highest pair.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     */
    BTree.prototype.nextLowerPair = function (key, reusedArray) {
        reusedArray = reusedArray || [];
        if (key === undefined) {
            return this._root.maxPair(reusedArray);
        }
        return this._root.getPairOrNextLower(key, this._compare, false, reusedArray);
    };
    /** Returns the next key smaller than the specified key, or undefined if there is none.
     *  Also, nextLowerKey(undefined) returns the highest key.
     */
    BTree.prototype.nextLowerKey = function (key) {
        var p = this.nextLowerPair(key, ReusedArray);
        return p && p[0];
    };
    /** Returns the key-value pair associated with the supplied key if it exists
     *  or the pair associated with the next lower pair otherwise. If there is no
     *  next lower pair, undefined is returned.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     * */
    BTree.prototype.getPairOrNextLower = function (key, reusedArray) {
        return this._root.getPairOrNextLower(key, this._compare, true, reusedArray || []);
    };
    /** Returns the key-value pair associated with the supplied key if it exists
     *  or the pair associated with the next lower pair otherwise. If there is no
     *  next lower pair, undefined is returned.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     * */
    BTree.prototype.getPairOrNextHigher = function (key, reusedArray) {
        return this._root.getPairOrNextHigher(key, this._compare, true, reusedArray || []);
    };
    /** Edits the value associated with a key in the tree, if it already exists.
     * @returns true if the key existed, false if not.
    */
    BTree.prototype.changeIfPresent = function (key, value) {
        return this.editRange(key, key, true, function (k, v) { return ({ value: value }); }) !== 0;
    };
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
    BTree.prototype.getRange = function (low, high, includeHigh, maxLength) {
        if (maxLength === void 0) { maxLength = 0x3FFFFFF; }
        var results = [];
        this._root.forRange(low, high, includeHigh, false, this.asHost(), 0, function (k, v) {
            results.push([k, v]);
            return results.length > maxLength ? Break : undefined;
        });
        return results;
    };
    /** Adds all pairs from a list of key-value pairs.
     * @param pairs Pairs to add to this tree. If there are duplicate keys,
     *        later pairs currently overwrite earlier ones (e.g. [[0,1],[0,7]]
     *        associates 0 with 7.)
     * @param overwrite Whether to overwrite pairs that already exist (if false,
     *        pairs[i] is ignored when the key pairs[i][0] already exists.)
     * @returns The number of pairs added to the collection.
     * @description Computational complexity: O(pairs.length * log(size + pairs.length))
     */
    BTree.prototype.setPairs = function (pairs, overwrite) {
        var added = 0;
        for (var i = 0; i < pairs.length; i++)
            if (this.set(pairs[i][0], pairs[i][1], overwrite))
                added++;
        return added;
    };
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
     *        function can return {break:R} to stop early with result R.
     * @param initialCounter Initial third argument of onFound. This value
     *        increases by one each time `onFound` is called. Default: 0
     * @returns The number of values found, or R if the callback returned
     *        `{break:R}` to stop early.
     * @description Computational complexity: O(number of items scanned + log size)
     */
    BTree.prototype.forRange = function (low, high, includeHigh, onFound, initialCounter) {
        var r = this._root.forRange(low, high, includeHigh, false, this.asHost(), initialCounter || 0, onFound);
        return typeof r === "number" ? r : r.break;
    };
    /**
     * Scans and potentially modifies values for a subsequence of keys.
     * Note: the callback `onFound` should ideally be a pure function.
     *   Specfically, it must not insert items, call clone(), or change
     *   the collection except via return value; out-of-band editing may
     *   cause an exception or may cause incorrect data to be sent to
     *   the callback (duplicate or missed items). It must not cause a
     *   clone() of the collection, otherwise the clone could be modified
     *   by changes requested by the callback.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh If the `high` key is present, `onFound` is called for
     *        that final pair if and only if this parameter is true.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return `{value:v}` to change the value associated
     *        with the current key, `{delete:true}` to delete the current pair,
     *        `{break:R}` to stop early with result R, or it can return nothing
     *        (undefined or {}) to cause no effect and continue iterating.
     *        `{break:R}` can be combined with one of the other two commands.
     *        The third argument `counter` is the number of items iterated
     *        previously; it equals 0 when `onFound` is called the first time.
     * @returns The number of values scanned, or R if the callback returned
     *        `{break:R}` to stop early.
     * @description
     *   Computational complexity: O(number of items scanned + log size)
     *   Note: if the tree has been cloned with clone(), any shared
     *   nodes are copied before `onFound` is called. This takes O(n) time
     *   where n is proportional to the amount of shared data scanned.
     */
    BTree.prototype.editRange = function (low, high, includeHigh, onFound, initialCounter) {
        var root = this._root;
        if (root.isShared)
            this._root = root = root.clone();
        try {
            var r = root.forRange(low, high, includeHigh, true, this.asHost(), initialCounter || 0, onFound);
            return typeof r === "number" ? r : r.break;
        }
        finally {
            var isShared = void 0;
            while (root.keys.length <= 1 && !root.isLeaf) {
                isShared || (isShared = root.isShared);
                this._root = root = root.keys.length === 0 ? nodes_1.EmptyLeaf :
                    root.children[0];
            }
            // If any ancestor of the new root was shared, the new root must also be shared
            if (isShared) {
                root.isShared = true;
            }
        }
    };
    /** Same as `editRange` except that the callback is called for all pairs. */
    BTree.prototype.editAll = function (onFound, initialCounter) {
        return this.editRange(this.minKey(), this.maxKey(), true, onFound, initialCounter);
    };
    /**
     * Removes a range of key-value pairs from the B+ tree.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh Specifies whether the `high` key, if present, is deleted.
     * @returns The number of key-value pairs that were deleted.
     * @description Computational complexity: O(log size + number of items deleted)
     */
    BTree.prototype.deleteRange = function (low, high, includeHigh) {
        return this.editRange(low, high, includeHigh, DeleteRange);
    };
    /** Deletes a series of keys from the collection. */
    BTree.prototype.deleteKeys = function (keys) {
        for (var i = 0, r = 0; i < keys.length; i++)
            if (this.delete(keys[i]))
                r++;
        return r;
    };
    Object.defineProperty(BTree.prototype, "height", {
        /** Gets the height of the tree: the number of internal nodes between the
         *  BTree object and its leaf nodes (zero if there are no internal nodes). */
        get: function () {
            var node = this._root;
            var height = -1;
            while (node) {
                height++;
                node = node.isLeaf ? undefined : node.children[0];
            }
            return height;
        },
        enumerable: false,
        configurable: true
    });
    /** Makes the object read-only to ensure it is not accidentally modified.
     *  Freezing does not have to be permanent; unfreeze() reverses the effect.
     *  This is accomplished by replacing mutator functions with a function
     *  that throws an Error. Compared to using a property (e.g. this.isFrozen)
     *  this implementation gives better performance in non-frozen BTrees.
     */
    BTree.prototype.freeze = function () {
        var t = this;
        // Note: all other mutators ultimately call set() or editRange() 
        //       so we don't need to override those others.
        t.clear = t.set = t.editRange = function () {
            throw new Error("Attempted to modify a frozen BTree");
        };
    };
    /** Ensures mutations are allowed, reversing the effect of freeze(). */
    BTree.prototype.unfreeze = function () {
        // @ts-ignore "The operand of a 'delete' operator must be optional."
        //            (wrong: delete does not affect the prototype.)
        delete this.clear;
        // @ts-ignore
        delete this.set;
        // @ts-ignore
        delete this.editRange;
    };
    Object.defineProperty(BTree.prototype, "isFrozen", {
        /** Returns true if the tree appears to be frozen. */
        get: function () {
            return this.hasOwnProperty('editRange');
        },
        enumerable: false,
        configurable: true
    });
    /** Scans the tree for signs of serious bugs (e.g. this.size doesn't match
     *  number of elements, internal nodes not caching max element properly...)
     *  Computational complexity: O(number of nodes), i.e. O(size). This method
     *  skips the most expensive test - whether all keys are sorted - but it
     *  does check that maxKey() of the children of internal nodes are sorted. */
    BTree.prototype.checkValid = function () {
        var size = this._root.checkValid(0, this.asHost(), 0);
        (0, assert_1.check)(size === this.size, "size mismatch: counted ", size, "but stored", this.size);
    };
    return BTree;
}());
exports.default = BTree;
/** A TypeScript helper function that simply returns its argument, typed as
 *  `ISortedSet<K>` if the BTree implements it, as it does if `V extends undefined`.
 *  If `V` cannot be `undefined`, it returns `unknown` instead. Or at least, that
 *  was the intention, but TypeScript is acting weird and may return `ISortedSet<K>`
 *  even if `V` can't be `undefined` (discussion: btree-typescript issue #14) */
function asSet(btree) {
    return btree;
}
exports.asSet = asSet;
if (Symbol && Symbol.iterator) // iterator is equivalent to entries()
    BTree.prototype[Symbol.iterator] = BTree.prototype.entries;
BTree.prototype.where = BTree.prototype.filter;
BTree.prototype.setRange = BTree.prototype.setPairs;
BTree.prototype.add = BTree.prototype.set; // for compatibility with ISetSink<K>
function iterator(next) {
    if (next === void 0) { next = (function () { return ({ done: true, value: undefined }); }); }
    var result = { next: next };
    if (Symbol && Symbol.iterator)
        result[Symbol.iterator] = function () { return this; };
    return result;
}
/**
 * A walkable pointer into a BTree for computing efficient diffs between trees with shared data.
 * - A cursor points to either a key/value pair (KVP) or a node (which can be either a leaf or an internal node).
 *    As a consequence, a cursor cannot be created for an empty tree.
 * - A cursor can be walked forwards using `step`. A cursor can be compared to another cursor to
 *    determine which is ahead in advancement.
 * - A cursor is valid only for the tree it was created from, and only until the first edit made to
 *    that tree since the cursor's creation.
 * - A cursor contains a key for the current location, which is the maxKey when the cursor points to a node
 *    and a key corresponding to a value when pointing to a leaf.
 * - Leaf is only populated if the cursor points to a KVP. If this is the case, levelIndices.length === internalSpine.length + 1
 *    and levelIndices[levelIndices.length - 1] is the index of the value.
 */
var Delete = { delete: true }, DeleteRange = function () { return Delete; };
var Break = { break: true };
var EmptyArray = [];
var ReusedArray = []; // assumed thread-local
/** A BTree frozen in the empty state. */
exports.EmptyBTree = (function () { var t = new BTree(); t.freeze(); return t; })();
