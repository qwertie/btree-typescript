var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // Informative microbenchmarks & stuff:
    // http://www.jayconrod.com/posts/52/a-tour-of-v8-object-representation (very educational)
    // https://blog.mozilla.org/luke/2012/10/02/optimizing-javascript-variable-access/ (local vars are faster than properties)
    // http://benediktmeurer.de/2017/12/13/an-introduction-to-speculative-optimization-in-v8/ (other stuff)
    // https://jsperf.com/js-in-operator-vs-alternatives (avoid 'in' operator; `.p!==undefined` faster than `hasOwnProperty('p')` in all browsers)
    // https://jsperf.com/instanceof-vs-typeof-vs-constructor-vs-member (speed of type tests varies wildly across browsers)
    // https://jsperf.com/detecting-arrays-new (a.constructor===Array is best across browsers, assuming a is an object)
    // https://jsperf.com/shallow-cloning-methods (a constructor is faster than Object.create; hand-written clone faster than Object.assign)
    // https://jsperf.com/ways-to-fill-an-array (slice-and-replace is fastest)
    // https://jsperf.com/math-min-max-vs-ternary-vs-if (Math.min/max is slow on Edge)
    // https://jsperf.com/array-vs-property-access-speed (v.x/v.y is faster than a[0]/a[1] in major browsers IF hidden class is constant)
    // https://jsperf.com/detect-not-null-or-undefined (`x==null` slightly slower than `x===null||x===undefined` on all browsers)
    // Overall, microbenchmarks suggest Firefox is the fastest browser for JavaScript and Edge is the slowest.
    // Lessons from https://v8project.blogspot.com/2017/09/elements-kinds-in-v8.html:
    //   - Avoid holes in arrays. Avoid `new Array(N)`, it will be "holey" permanently.
    //   - Don't read outside bounds of an array (it scans prototype chain).
    //   - Small integer arrays are stored differently from doubles
    //   - Adding non-numbers to an array deoptimizes it permanently into a general array
    //   - Objects can be used like arrays (e.g. have length property) but are slower
    //   - V8 source (NewElementsCapacity in src/objects.h): arrays grow by 50% + 16 elements
    /** Compares two numbers, strings, arrays of numbers/strings, Dates,
     *  or objects that have a valueOf() method returning a number or string.
     *  Optimized for numbers. Returns 1 if a>b, -1 if a<b, and 0 if a===b.
     */
    function defaultComparator(a, b) {
        var c = a - b;
        if (c === c)
            return c; // a & b are number
        // General case (c is NaN): string / arrays / Date / incomparable things
        if (a)
            a = a.valueOf();
        if (b)
            b = b.valueOf();
        return a < b ? -1 : a > b ? 1 : a == b ? 0 : c;
    }
    exports.defaultComparator = defaultComparator;
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
         *   This is not required for numbers, strings and arrays of numbers/strings.
         * @param entries A set of key-value pairs to initialize the tree
         * @param maxNodeSize Branching factor (maximum items or children per node)
         *   Must be in range 4..256. If undefined or <4 then default is used; if >256 then 256.
         */
        function BTree(entries, compare, maxNodeSize) {
            this._root = EmptyLeaf;
            this._size = 0;
            this._maxNodeSize = maxNodeSize >= 4 ? Math.min(maxNodeSize, 256) : 32;
            this._compare = compare || defaultComparator;
            if (entries)
                this.setPairs(entries);
        }
        Object.defineProperty(BTree.prototype, "size", {
            // ES6 Map<K,V> methods ///////////////////////////////////////////////////
            /** Gets the number of key-value pairs in the tree. */
            get: function () { return this._size; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(BTree.prototype, "length", {
            /** Gets the number of key-value pairs in the tree. */
            get: function () { return this._size; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(BTree.prototype, "isEmpty", {
            /** Returns true iff the tree contains no key-value pairs. */
            get: function () { return this._size === 0; },
            enumerable: true,
            configurable: true
        });
        /** Releases the tree so that its size is 0. */
        BTree.prototype.clear = function () {
            this._root = EmptyLeaf;
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
            return this._root.get(key, defaultValue, this);
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
            var result = this._root.set(key, value, overwrite, this);
            if (result === true || result === false)
                return result;
            // Root node has split, so create a new root node.
            this._root = new BNodeInternal([this._root, result]);
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
        // Iterator methods ///////////////////////////////////////////////////////
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
         *         start at minKey(). If the specified key doesn't exist then iteration
         *         starts at the next lower key (according to the comparator).
         *  @param reusedArray Optional array used repeatedly to store key-value
         *         pairs, to avoid creating a new array on every iteration.
         *  @param skipHighest Iff this flag is true and the highestKey exists in the
         *         collection, the pair matching highestKey is skipped, not iterated.
         */
        BTree.prototype.entriesReversed = function (highestKey, reusedArray, skipHighest) {
            if ((highestKey = highestKey || this.maxKey()) === undefined)
                return iterator(); // collection is empty
            var _a = this.findPath(highestKey) || this.findPath(this.maxKey()), nodequeue = _a.nodequeue, nodeindex = _a.nodeindex, leaf = _a.leaf;
            check(!nodequeue[0] || leaf === nodequeue[0][nodeindex[0]], "wat!");
            var i = leaf.indexOf(highestKey, 0, this._compare);
            if (!(skipHighest || this._compare(leaf.keys[i], highestKey) > 0))
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
        Object.defineProperty(BTree.prototype, "maxNodeSize", {
            // Additional methods /////////////////////////////////////////////////////
            /** Returns the maximum number of children/values before nodes will split. */
            get: function () {
                return this._maxNodeSize;
            },
            enumerable: true,
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
         *  not currently marked as shared, in order to avoid marking any nodes
         *  as shared.
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
            this._root.forRange(this.minKey(), this.maxKey(), true, false, this, 0, function (k, v) { results.push(k); });
            return results;
        };
        /** Gets an array of all values, sorted by key */
        BTree.prototype.valuesArray = function () {
            var results = [];
            this._root.forRange(this.minKey(), this.maxKey(), true, false, this, 0, function (k, v) { results.push(v); });
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
        /** Returns the next pair whose key is larger than the specified key (or undefined if there is none) */
        BTree.prototype.nextHigherPair = function (key) {
            var it = this.entries(key, ReusedArray);
            var r = it.next();
            if (!r.done && this._compare(r.value[0], key) <= 0)
                r = it.next();
            return r.value;
        };
        /** Returns the next key larger than the specified key (or undefined if there is none) */
        BTree.prototype.nextHigherKey = function (key) {
            var p = this.nextHigherPair(key);
            return p ? p[0] : p;
        };
        /** Returns the next pair whose key is smaller than the specified key (or undefined if there is none) */
        BTree.prototype.nextLowerPair = function (key) {
            var it = this.entriesReversed(key, ReusedArray, true);
            return it.next().value;
        };
        /** Returns the next key smaller than the specified key (or undefined if there is none) */
        BTree.prototype.nextLowerKey = function (key) {
            var p = this.nextLowerPair(key);
            return p ? p[0] : p;
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
            this._root.forRange(low, high, includeHigh, false, this, 0, function (k, v) {
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
            var r = this._root.forRange(low, high, includeHigh, false, this, initialCounter || 0, onFound);
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
                var r = root.forRange(low, high, includeHigh, true, this, initialCounter || 0, onFound);
                return typeof r === "number" ? r : r.break;
            }
            finally {
                while (root.keys.length <= 1 && !root.isLeaf)
                    this._root = root = root.keys.length === 0 ? EmptyLeaf :
                        root.children[0];
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
                for (var node = this._root, h = -1; node != null; h++)
                    node = node.children;
                return h;
            },
            enumerable: true,
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
            delete this.clear;
            delete this.set;
            delete this.editRange;
        };
        Object.defineProperty(BTree.prototype, "isFrozen", {
            /** Returns true if the tree appears to be frozen. */
            get: function () {
                return this.hasOwnProperty('editRange');
            },
            enumerable: true,
            configurable: true
        });
        /** Scans the tree for signs of serious bugs (e.g. this.size doesn't match
         *  number of elements, internal nodes not caching max element properly...)
         *  Computational complexity: O(number of nodes), i.e. O(size). This method
         *  skips the most expensive test - whether all keys are sorted - but it
         *  does check that maxKey() of the children of internal nodes are sorted. */
        BTree.prototype.checkValid = function () {
            var size = this._root.checkValid(0, this);
            check(size === this.size, "size mismatch: counted ", size, "but stored", this.size);
        };
        return BTree;
    }());
    exports.default = BTree;
    if (Symbol && Symbol.iterator) // iterator is equivalent to entries()
        BTree.prototype[Symbol.iterator] = BTree.prototype.entries;
    BTree.prototype.where = BTree.prototype.filter;
    BTree.prototype.setRange = BTree.prototype.setPairs;
    BTree.prototype.add = BTree.prototype.set;
    function iterator(next) {
        if (next === void 0) { next = (function () { return ({ done: true, value: undefined }); }); }
        var result = { next: next };
        if (Symbol && Symbol.iterator)
            result[Symbol.iterator] = function () { return this; };
        return result;
    }
    /** Leaf node / base class. **************************************************/
    var BNode = /** @class */ (function () {
        function BNode(keys, values) {
            if (keys === void 0) { keys = []; }
            this.keys = keys;
            this.values = values || undefVals;
            this.isShared = undefined;
        }
        Object.defineProperty(BNode.prototype, "isLeaf", {
            get: function () { return this.children === undefined; },
            enumerable: true,
            configurable: true
        });
        // Shared methods /////////////////////////////////////////////////////////
        BNode.prototype.maxKey = function () {
            return this.keys[this.keys.length - 1];
        };
        // If key not found, returns i^failXor where i is the insertion index.
        // Callers that don't care whether there was a match will set failXor=0.
        BNode.prototype.indexOf = function (key, failXor, cmp) {
            // TODO: benchmark multiple search strategies
            var keys = this.keys;
            var lo = 0, hi = keys.length, mid = hi >> 1;
            while (lo < hi) {
                var c = cmp(keys[mid], key);
                if (c < 0)
                    lo = mid + 1;
                else if (c > 0) // key < keys[mid]
                    hi = mid;
                else if (c === 0)
                    return mid;
                else {
                    // c is NaN or otherwise invalid
                    if (key === key) // at least the search key is not NaN
                        return keys.length;
                    else
                        throw new Error("BTree: NaN was used as a key");
                }
                mid = (lo + hi) >> 1;
            }
            return mid ^ failXor;
            // Unrolled version: benchmarks show same speed, not worth using
            /*var i = 1, c: number = 0, sum = 0;
            if (keys.length >= 4) {
              i = 3;
              if (keys.length >= 8) {
                i = 7;
                if (keys.length >= 16) {
                  i = 15;
                  if (keys.length >= 32) {
                    i = 31;
                    if (keys.length >= 64) {
                      i = 127;
                      i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 64 : -64;
                      sum += c;
                      i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 32 : -32;
                      sum += c;
                    }
                    i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 16 : -16;
                    sum += c;
                  }
                  i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 8 : -8;
                  sum += c;
                }
                i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 4 : -4;
                sum += c;
              }
              i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 2 : -2;
              sum += c;
            }
            i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 1 : -1;
            c = i < keys.length ? cmp(keys[i], key) : 1;
            sum += c;
            if (c < 0) {
              ++i;
              c = i < keys.length ? cmp(keys[i], key) : 1;
              sum += c;
            }
            if (sum !== sum) {
              if (key === key) // at least the search key is not NaN
                return keys.length ^ failXor;
              else
                throw new Error("BTree: NaN was used as a key");
            }
            return c === 0 ? i : i ^ failXor;*/
        };
        // Leaf Node: misc //////////////////////////////////////////////////////////
        BNode.prototype.minKey = function () {
            return this.keys[0];
        };
        BNode.prototype.clone = function () {
            var v = this.values;
            return new BNode(this.keys.slice(0), v === undefVals ? v : v.slice(0));
        };
        BNode.prototype.greedyClone = function (force) {
            return this.isShared && !force ? this : this.clone();
        };
        BNode.prototype.get = function (key, defaultValue, tree) {
            var i = this.indexOf(key, -1, tree._compare);
            return i < 0 ? defaultValue : this.values[i];
        };
        BNode.prototype.checkValid = function (depth, tree) {
            var kL = this.keys.length, vL = this.values.length;
            check(this.values === undefVals ? kL <= vL : kL === vL, "keys/values length mismatch: depth", depth, "with lengths", kL, vL);
            // Note: we don't check for "node too small" because sometimes a node
            // can legitimately have size 1. This occurs if there is a batch 
            // deletion, leaving a node of size 1, and the siblings are full so
            // it can't be merged with adjacent nodes. However, the parent will
            // verify that the average node size is at least half of the maximum.
            check(depth == 0 || kL > 0, "empty leaf at depth", depth);
            return kL;
        };
        // Leaf Node: set & node splitting //////////////////////////////////////////
        BNode.prototype.set = function (key, value, overwrite, tree) {
            var i = this.indexOf(key, -1, tree._compare);
            if (i < 0) {
                // key does not exist yet
                i = ~i;
                tree._size++;
                if (this.keys.length < tree._maxNodeSize) {
                    return this.insertInLeaf(i, key, value, tree);
                }
                else {
                    // This leaf node is full and must split
                    var newRightSibling = this.splitOffRightSide(), target = this;
                    if (i > this.keys.length) {
                        i -= this.keys.length;
                        target = newRightSibling;
                    }
                    target.insertInLeaf(i, key, value, tree);
                    return newRightSibling;
                }
            }
            else {
                // Key already exists
                if (overwrite !== false) {
                    if (value !== undefined)
                        this.reifyValues();
                    // usually this is a no-op, but some users may wish to edit the key
                    this.keys[i] = key;
                    this.values[i] = value;
                }
                return false;
            }
        };
        BNode.prototype.reifyValues = function () {
            if (this.values === undefVals)
                return this.values = this.values.slice(0, this.keys.length);
            return this.values;
        };
        BNode.prototype.insertInLeaf = function (i, key, value, tree) {
            this.keys.splice(i, 0, key);
            if (this.values === undefVals) {
                while (undefVals.length < tree._maxNodeSize)
                    undefVals.push(undefined);
                if (value === undefined) {
                    return true;
                }
                else {
                    this.values = undefVals.slice(0, this.keys.length - 1);
                }
            }
            this.values.splice(i, 0, value);
            return true;
        };
        BNode.prototype.takeFromRight = function (rhs) {
            // Reminder: parent node must update its copy of key for this node
            // assert: neither node is shared
            // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
            var v = this.values;
            if (rhs.values === undefVals) {
                if (v !== undefVals)
                    v.push(undefined);
            }
            else {
                v = this.reifyValues();
                v.push(rhs.values.shift());
            }
            this.keys.push(rhs.keys.shift());
        };
        BNode.prototype.takeFromLeft = function (lhs) {
            // Reminder: parent node must update its copy of key for this node
            // assert: neither node is shared
            // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
            var v = this.values;
            if (lhs.values === undefVals) {
                if (v !== undefVals)
                    v.unshift(undefined);
            }
            else {
                v = this.reifyValues();
                v.unshift(lhs.values.pop());
            }
            this.keys.unshift(lhs.keys.pop());
        };
        BNode.prototype.splitOffRightSide = function () {
            // Reminder: parent node must update its copy of key for this node
            var half = this.keys.length >> 1, keys = this.keys.splice(half);
            var values = this.values === undefVals ? undefVals : this.values.splice(half);
            return new BNode(keys, values);
        };
        // Leaf Node: scanning & deletions //////////////////////////////////////////
        BNode.prototype.forRange = function (low, high, includeHigh, editMode, tree, count, onFound) {
            var cmp = tree._compare;
            var iLow, iHigh;
            if (high === low) {
                if (!includeHigh)
                    return count;
                iHigh = (iLow = this.indexOf(low, -1, cmp)) + 1;
                if (iLow < 0)
                    return count;
            }
            else {
                iLow = this.indexOf(low, 0, cmp);
                iHigh = this.indexOf(high, -1, cmp);
                if (iHigh < 0)
                    iHigh = ~iHigh;
                else if (includeHigh === true)
                    iHigh++;
            }
            var keys = this.keys, values = this.values;
            if (onFound !== undefined) {
                for (var i = iLow; i < iHigh; i++) {
                    var key = keys[i];
                    var result = onFound(key, values[i], count++);
                    if (result !== undefined) {
                        if (editMode === true) {
                            if (key !== keys[i] || this.isShared === true)
                                throw new Error("BTree illegally changed or cloned in editRange");
                            if (result.delete) {
                                this.keys.splice(i, 1);
                                if (this.values !== undefVals)
                                    this.values.splice(i, 1);
                                tree._size--;
                                i--;
                                iHigh--;
                            }
                            else if (result.hasOwnProperty('value')) {
                                values[i] = result.value;
                            }
                        }
                        if (result.break !== undefined)
                            return result;
                    }
                }
            }
            else
                count += iHigh - iLow;
            return count;
        };
        /** Adds entire contents of right-hand sibling (rhs is left unchanged) */
        BNode.prototype.mergeSibling = function (rhs, _) {
            this.keys.push.apply(this.keys, rhs.keys);
            if (this.values === undefVals) {
                if (rhs.values === undefVals)
                    return;
                this.values = this.values.slice(0, this.keys.length);
            }
            this.values.push.apply(this.values, rhs.reifyValues());
        };
        return BNode;
    }());
    /** Internal node (non-leaf node) ********************************************/
    var BNodeInternal = /** @class */ (function (_super) {
        __extends(BNodeInternal, _super);
        function BNodeInternal(children, keys) {
            var _this = this;
            if (!keys) {
                keys = [];
                for (var i = 0; i < children.length; i++)
                    keys[i] = children[i].maxKey();
            }
            _this = _super.call(this, keys) || this;
            _this.children = children;
            return _this;
        }
        BNodeInternal.prototype.clone = function () {
            var children = this.children.slice(0);
            for (var i = 0; i < children.length; i++)
                children[i].isShared = true;
            return new BNodeInternal(children, this.keys.slice(0));
        };
        BNodeInternal.prototype.greedyClone = function (force) {
            if (this.isShared && !force)
                return this;
            var nu = new BNodeInternal(this.children.slice(0), this.keys.slice(0));
            for (var i = 0; i < nu.children.length; i++)
                nu.children[i] = nu.children[i].greedyClone();
            return nu;
        };
        BNodeInternal.prototype.minKey = function () {
            return this.children[0].minKey();
        };
        BNodeInternal.prototype.get = function (key, defaultValue, tree) {
            var i = this.indexOf(key, 0, tree._compare), children = this.children;
            return i < children.length ? children[i].get(key, defaultValue, tree) : undefined;
        };
        BNodeInternal.prototype.checkValid = function (depth, tree) {
            var kL = this.keys.length, cL = this.children.length;
            check(kL === cL, "keys/children length mismatch: depth", depth, "lengths", kL, cL);
            check(kL > 1, "internal node has length", kL, "at depth", depth);
            var size = 0, c = this.children, k = this.keys, childSize = 0;
            for (var i = 0; i < cL; i++) {
                size += c[i].checkValid(depth + 1, tree);
                childSize += c[i].keys.length;
                check(size >= childSize, "wtf"); // no way this will ever fail
                check(i === 0 || c[i - 1].constructor === c[i].constructor, "type mismatch");
                if (c[i].maxKey() != k[i])
                    check(false, "keys[", i, "] =", k[i], "is wrong, should be ", c[i].maxKey(), "at depth", depth);
                if (!(i === 0 || tree._compare(k[i - 1], k[i]) < 0))
                    check(false, "sort violation at depth", depth, "index", i, "keys", k[i - 1], k[i]);
            }
            var toofew = childSize < (tree.maxNodeSize >> 1) * cL;
            if (toofew || childSize > tree.maxNodeSize * cL)
                check(false, toofew ? "too few" : "too many", "children (", childSize, size, ") at depth", depth, ", maxNodeSize:", tree.maxNodeSize, "children.length:", cL);
            return size;
        };
        // Internal Node: set & node splitting //////////////////////////////////////
        BNodeInternal.prototype.set = function (key, value, overwrite, tree) {
            var c = this.children, max = tree._maxNodeSize, cmp = tree._compare;
            var i = Math.min(this.indexOf(key, 0, cmp), c.length - 1), child = c[i];
            if (child.isShared)
                c[i] = child = child.clone();
            if (child.keys.length >= max) {
                // child is full; inserting anything else will cause a split.
                // Shifting an item to the left or right sibling may avoid a split.
                // We can do a shift if the adjacent node is not full and if the
                // current key can still be placed in the same node after the shift.
                var other;
                if (i > 0 && (other = c[i - 1]).keys.length < max && cmp(child.keys[0], key) < 0) {
                    if (other.isShared)
                        c[i - 1] = other = other.clone();
                    other.takeFromRight(child);
                    this.keys[i - 1] = other.maxKey();
                }
                else if ((other = c[i + 1]) !== undefined && other.keys.length < max && cmp(child.maxKey(), key) < 0) {
                    if (other.isShared)
                        c[i + 1] = other = other.clone();
                    other.takeFromLeft(child);
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
                this.insert(i + 1, result);
                return true;
            }
            else { // no, we must split also
                var newRightSibling = this.splitOffRightSide(), target = this;
                if (cmp(result.maxKey(), this.maxKey()) > 0) {
                    target = newRightSibling;
                    i -= this.keys.length;
                }
                target.insert(i + 1, result);
                return newRightSibling;
            }
        };
        BNodeInternal.prototype.insert = function (i, child) {
            this.children.splice(i, 0, child);
            this.keys.splice(i, 0, child.maxKey());
        };
        BNodeInternal.prototype.splitOffRightSide = function () {
            var half = this.children.length >> 1;
            return new BNodeInternal(this.children.splice(half), this.keys.splice(half));
        };
        BNodeInternal.prototype.takeFromRight = function (rhs) {
            // Reminder: parent node must update its copy of key for this node
            // assert: neither node is shared
            // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
            this.keys.push(rhs.keys.shift());
            this.children.push(rhs.children.shift());
        };
        BNodeInternal.prototype.takeFromLeft = function (lhs) {
            // Reminder: parent node must update its copy of key for this node
            // assert: neither node is shared
            // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
            this.keys.unshift(lhs.keys.pop());
            this.children.unshift(lhs.children.pop());
        };
        // Internal Node: scanning & deletions //////////////////////////////////////
        BNodeInternal.prototype.forRange = function (low, high, includeHigh, editMode, tree, count, onFound) {
            var cmp = tree._compare;
            var iLow = this.indexOf(low, 0, cmp), i = iLow;
            var iHigh = Math.min(high === low ? iLow : this.indexOf(high, 0, cmp), this.keys.length - 1);
            var keys = this.keys, children = this.children;
            if (!editMode) {
                // Simple case
                for (; i <= iHigh; i++) {
                    var result = children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound);
                    if (typeof result !== 'number')
                        return result;
                    count = result;
                }
            }
            else if (i <= iHigh) {
                try {
                    for (; i <= iHigh; i++) {
                        if (children[i].isShared)
                            children[i] = children[i].clone();
                        var result = children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound);
                        if (children[i].keys.length > 0) {
                            keys[i] = children[i].maxKey();
                        }
                        else {
                            // delete empty child
                            keys.splice(i, 1);
                            children.splice(i, 1);
                            iHigh--;
                            i--;
                        }
                        if (typeof result !== 'number')
                            return result;
                        count = result;
                    }
                }
                finally {
                    // Deletions may have occurred, so look for opportunities to merge nodes.
                    var half = tree._maxNodeSize >> 1;
                    if (iLow > 0)
                        iLow--;
                    for (i = iHigh; i >= iLow; i--) {
                        if (children[i].keys.length <= half)
                            this.tryMerge(i, tree._maxNodeSize);
                    }
                    // Are we completely empty?
                    if (children.length > 0 && children[0].keys.length === 0) {
                        check(children.length === 1 && keys.length === 1, "emptiness bug");
                        children.shift();
                        keys.shift();
                    }
                }
            }
            return count;
        };
        /** Merges child i with child i+1 if their combined size is not too large */
        BNodeInternal.prototype.tryMerge = function (i, maxSize) {
            var children = this.children;
            if (i >= 0 && i + 1 < children.length) {
                if (children[i].keys.length + children[i + 1].keys.length <= maxSize) {
                    if (children[i].isShared) // cloned already UNLESS i is outside scan range
                        children[i] = children[i].clone();
                    children[i].mergeSibling(children[i + 1], maxSize);
                    children.splice(i + 1, 1);
                    this.keys.splice(i + 1, 1);
                    this.keys[i] = children[i].maxKey();
                    return true;
                }
            }
            return false;
        };
        BNodeInternal.prototype.mergeSibling = function (rhs, maxNodeSize) {
            // assert !this.isShared;
            var oldLength = this.keys.length;
            this.keys.push.apply(this.keys, rhs.keys);
            this.children.push.apply(this.children, rhs.children);
            // If our children are themselves almost empty due to a mass-delete,
            // they may need to be merged too (but only the oldLength-1 and its
            // right sibling should need this).
            this.tryMerge(oldLength - 1, maxNodeSize);
        };
        return BNodeInternal;
    }(BNode));
    // Optimization: this array of `undefined`s is used instead of a normal
    // array of values in nodes where `undefined` is the only value.
    // Its length is extended to max node size on first use; since it can
    // be shared between trees with different maximums, its length can only
    // increase, never decrease. Its type should be undefined[] but strangely
    // TypeScript won't allow the comparison V[] === undefined[]. To prevent
    // users from making this array too large, BTree has a maximum node size.
    var undefVals = [];
    var Delete = { delete: true }, DeleteRange = function () { return Delete; };
    var Break = { break: true };
    var EmptyLeaf = (function () {
        var n = new BNode();
        n.isShared = true;
        return n;
    })();
    var EmptyArray = [];
    var ReusedArray = []; // assumed thread-local
    function check(fact) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (!fact) {
            args.unshift('B+ tree '); // at beginning of message
            throw new Error(args.join(' '));
        }
    }
    /** A BTree frozen in the empty state. */
    exports.EmptyBTree = (function () { var t = new BTree(); t.freeze(); return t; })();
});
