"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyBTree = exports.asSet = exports.simpleComparator = exports.defaultComparator = void 0;
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
        this._root = EmptyLeaf;
        this._maxNodeSize = maxNodeSize >= 4 ? Math.min(maxNodeSize, 256) : 32;
        this._compare = compare || defaultComparator;
        if (entries)
            this.setPairs(entries);
    }
    Object.defineProperty(BTree.prototype, "size", {
        /////////////////////////////////////////////////////////////////////////////
        // ES6 Map<K,V> methods /////////////////////////////////////////////////////
        /** Gets the number of key-value pairs in the tree. */
        get: function () { return this._root.size(); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BTree.prototype, "length", {
        /** Gets the number of key-value pairs in the tree. */
        get: function () { return this.size; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BTree.prototype, "isEmpty", {
        /** Returns true iff the tree contains no key-value pairs. */
        get: function () { return this._root.size() === 0; },
        enumerable: false,
        configurable: true
    });
    /** Releases the tree so that its size is 0. */
    BTree.prototype.clear = function () {
        this._root = EmptyLeaf;
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
        var children = [this._root, result];
        this._root = new BNodeInternal(children, sumChildSizes(children));
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
        check(!nodequeue[0] || leaf === nodequeue[0][nodeindex[0]], "wat!");
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
    /**
     * Intersects this tree with `other`, calling the supplied `intersection` callback for each intersecting key/value pair.
     * Neither tree is modified.
     * @param other The other tree to intersect with this one.
     * @param intersection Called for keys that appear in both trees.
     * @description Complexity is bounded O(N + M) time and O(log(N + M)) for allocations.
     * However, time is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
     * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
     * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
     * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
     * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than calling `toArray`
     * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
     */
    BTree.prototype.intersect = function (other, intersection) {
        var cmp = this._compare;
        if (cmp !== other._compare)
            throw new Error("Cannot intersect BTrees with different comparators.");
        if (this._maxNodeSize !== other._maxNodeSize)
            throw new Error("Cannot intersect BTrees with different max node sizes.");
        if (other.size === 0 || this.size === 0)
            return;
        var makePayload = function () { return undefined; };
        var cursorA = BTree.createCursor(this, makePayload, BTree.noop, BTree.noop, BTree.noop, BTree.noop, BTree.noop);
        var cursorB = BTree.createCursor(other, makePayload, BTree.noop, BTree.noop, BTree.noop, BTree.noop, BTree.noop);
        var leading = cursorA;
        var trailing = cursorB;
        var order = cmp(BTree.getKey(leading), BTree.getKey(trailing));
        // The intersect walk is somewhat similar to a merge walk in that it does an alternating hop walk with cursors.
        // However, the only thing we care about is when the two cursors are equal (equality is intersection).
        // When they are not equal we just advance the trailing cursor.
        while (true) {
            var areEqual = order === 0;
            if (areEqual) {
                var key = BTree.getKey(leading);
                var vA = cursorA.leaf.values[cursorA.leafIndex];
                var vB = cursorB.leaf.values[cursorB.leafIndex];
                intersection(key, vA, vB);
                var outT = BTree.moveForwardOne(trailing, leading, key, cmp);
                var outL = BTree.moveForwardOne(leading, trailing, key, cmp);
                if (outT && outL)
                    break;
                order = cmp(BTree.getKey(leading), BTree.getKey(trailing));
            }
            else {
                if (order < 0) {
                    var tmp = trailing;
                    trailing = leading;
                    leading = tmp;
                }
                // At this point, leading is guaranteed to be ahead of trailing.
                var _a = BTree.moveTo(trailing, leading, BTree.getKey(leading), true, areEqual, cmp), out = _a[0], nowEqual = _a[1];
                if (out) {
                    // We've reached the end of one tree, so intersections are guaranteed to be done.
                    break;
                }
                else if (nowEqual) {
                    order = 0;
                }
                else {
                    order = -1; // trailing is ahead of leading
                }
            }
        }
    };
    /**
     * Efficiently merges this tree with `other`, reusing subtrees wherever possible.
     * Neither input tree is modified.
     * @param other The other tree to merge into this one.
     * @param merge Called for keys that appear in both trees. Return the desired value, or
     *        `undefined` to omit the key from the result.
     * @returns A new BTree that contains the merged key/value pairs.
     * @description Complexity is bounded O(N + M) for both time and allocations.
     * However, it is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
     * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
     * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
     * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
     * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than cloning `this`
     * and inserting the contents of `other` into the clone.
     */
    BTree.prototype.merge = function (other, merge) {
        if (this._compare !== other._compare)
            throw new Error("Cannot merge BTrees with different comparators.");
        var branchingFactor = this._maxNodeSize;
        if (branchingFactor !== other._maxNodeSize)
            throw new Error("Cannot merge BTrees with different max node sizes.");
        if (this._root.size() === 0)
            return other.clone();
        if (other._root.size() === 0)
            return this.clone();
        // Decompose both trees into disjoint subtrees leaves.
        // As many of these as possible will be reused from the original trees, and the remaining
        // will be leaves that are the result of merging intersecting leaves.
        var _a = BTree.decompose(this, other, merge), disjoint = _a.disjoint, tallestIndex = _a.tallestIndex;
        var disjointEntryCount = BTree.alternatingCount(disjoint);
        // Now we have a set of disjoint subtrees and we need to merge them into a single tree.
        // To do this, we start with the tallest subtree from the disjoint set and, for all subtrees
        // to the "right" and "left" of it in sorted order, we append them onto the appropriate side
        // of the current tree, splitting nodes as necessary to maintain balance.
        // A "side" is referred to as a frontier, as it is a linked list of nodes from the root down to
        // the leaf level on that side of the tree. Each appended subtree is appended to the node at the
        // same height as itself on the frontier. Each tree is guaranteed to be at most as tall as the
        // current frontier because we start from the tallest subtree and work outward.
        var initialRoot = BTree.alternatingGetSecond(disjoint, tallestIndex);
        var frontier = [initialRoot];
        // Process all subtrees to the right of the tallest subtree
        if (tallestIndex + 1 <= disjointEntryCount - 1) {
            BTree.updateFrontier(frontier, 0, BTree.getRightmostIndex);
            BTree.processSide(branchingFactor, disjoint, frontier, tallestIndex + 1, disjointEntryCount, 1, BTree.getRightmostIndex, BTree.getRightInsertionIndex, BTree.splitOffRightSide, BTree.updateRightMax);
        }
        // Process all subtrees to the left of the current tree
        if (tallestIndex - 1 >= 0) {
            // Note we need to update the frontier here because the right-side processing may have grown the tree taller.
            BTree.updateFrontier(frontier, 0, BTree.getLeftmostIndex);
            BTree.processSide(branchingFactor, disjoint, frontier, tallestIndex - 1, -1, -1, BTree.getLeftmostIndex, BTree.getLeftmostIndex, BTree.splitOffLeftSide, BTree.noop // left side appending doesn't update max keys
            );
        }
        var merged = new BTree(undefined, this._compare, this._maxNodeSize);
        merged._root = frontier[0];
        // Return the resulting tree
        return merged;
    };
    /**
     * Processes one side (left or right) of the disjoint subtree set during a merge operation.
     * Merges each subtree in the disjoint set from start to end (exclusive) into the given spine.
     */
    BTree.processSide = function (branchingFactor, disjoint, spine, start, end, step, sideIndex, sideInsertionIndex, splitOffSide, updateMax) {
        // Determine the depth of the first shared node on the frontier.
        // Appending subtrees to the frontier must respect the copy-on-write semantics by cloning
        // any shared nodes down to the insertion point. We track it by depth to avoid a log(n) walk of the
        // frontier for each insertion as that would fundamentally change our asymptotics.
        var isSharedFrontierDepth = 0;
        var cur = spine[0];
        // Find the first shared node on the frontier
        while (!cur.isShared && isSharedFrontierDepth < spine.length - 1) {
            isSharedFrontierDepth++;
            cur = cur.children[sideIndex(cur)];
        }
        // This array holds the sum of sizes of nodes that have been inserted but not yet propagated upward.
        // For example, if a subtree of size 5 is inserted at depth 2, then unflushedSizes[1] += 5.
        // These sizes are added to the depth above the insertion point because the insertion updates the direct parent of the insertion.
        // These sizes are flushed upward any time we need to insert at level higher than pending unflushed sizes.
        // E.g. in our example, if we later insert at depth 0, we will add 5 to the node at depth 1 and the root at depth 0 before inserting.
        // This scheme enables us to avoid a log(n) propagation of sizes for each insertion.
        var unflushedSizes = new Array(spine.length).fill(0); // pre-fill to avoid "holey" array
        for (var i = start; i != end; i += step) {
            var currentHeight = spine.length - 1; // height is number of internal levels; 0 means leaf
            var subtree = BTree.alternatingGetSecond(disjoint, i);
            var subtreeHeight = BTree.alternatingGetFirst(disjoint, i);
            var insertionDepth = currentHeight - (subtreeHeight + 1); // node at this depth has children of height 'subtreeHeight'
            // Ensure path is unshared before mutation
            BTree.ensureNotShared(spine, isSharedFrontierDepth, insertionDepth, sideIndex);
            // Calculate expansion depth (first ancestor with capacity)
            var expansionDepth = Math.max(0, BTree.findCascadeEndDepth(spine, insertionDepth, branchingFactor));
            // Update sizes on spine above the shared ancestor before we expand
            BTree.updateSizeAndMax(spine, unflushedSizes, isSharedFrontierDepth, expansionDepth, updateMax);
            // Append and cascade splits upward
            var newRoot = BTree.appendAndCascade(spine, insertionDepth, branchingFactor, subtree, sideIndex, sideInsertionIndex, splitOffSide);
            if (newRoot) {
                // Set the spine root to the highest up new node; the rest of the spine is updated below
                spine[0] = newRoot;
                unflushedSizes.forEach(function (count) { return check(count === 0, "Unexpected unflushed size after root split."); });
                unflushedSizes.push(0); // new root level
                isSharedFrontierDepth = insertionDepth + 2;
                unflushedSizes[insertionDepth + 1] += subtree.size();
            }
            else {
                isSharedFrontierDepth = insertionDepth + 1;
                unflushedSizes[insertionDepth] += subtree.size();
            }
            // Finally, update the frontier from the highest new node downward
            // Note that this is often the point where the new subtree is attached,
            // but in the case of cascaded splits it may be higher up.
            BTree.updateFrontier(spine, expansionDepth, sideIndex);
            check(isSharedFrontierDepth === spine.length - 1 || spine[isSharedFrontierDepth].isShared === true, "Non-leaf subtrees must be shared.");
            check(unflushedSizes.length === spine.length, "Unflushed sizes length mismatch after root split.");
        }
        // Finally, propagate any remaining unflushed sizes upward and update max keys
        BTree.updateSizeAndMax(spine, unflushedSizes, isSharedFrontierDepth, 0, updateMax);
    };
    ;
    /**
     * Append a subtree at a given depth on the chosen side; cascade splits upward if needed.
     * All un-propagated sizes must have already been applied to the spine up to the end of any cascading expansions.
     * This method guarantees that the size of the inserted subtree will not propagate upward beyond the insertion point.
     * Returns a new root if the root was split, otherwise undefined.
     */
    BTree.appendAndCascade = function (spine, insertionDepth, branchingFactor, subtree, sideIndex, sideInsertionIndex, splitOffSide) {
        // We must take care to avoid accidental propogation upward of the size of the inserted subtree.
        // To do this, we first split nodes upward from the insertion point until we find a node with capacity
        // or create a new root. Since all un-propagated sizes have already been applied to the spine up to this point,
        // inserting at the end ensures no accidental propagation.
        // Depth is -1 if the subtree is the same height as the current tree
        if (insertionDepth >= 0) {
            var carry = undefined;
            // Determine initially where to insert after any splits
            var insertTarget = spine[insertionDepth];
            if (insertTarget.keys.length >= branchingFactor) {
                insertTarget = carry = splitOffSide(insertTarget);
            }
            var d = insertionDepth - 1;
            while (carry && d >= 0) {
                var parent = spine[d];
                var idx = sideIndex(parent);
                // Refresh last key since child was split
                parent.keys[idx] = parent.children[idx].maxKey();
                if (parent.keys.length < branchingFactor) {
                    // We have reached the end of the cascade
                    BTree.insertNoCount(parent, sideInsertionIndex(parent), carry);
                    carry = undefined;
                }
                else {
                    // Splitting the parent here requires care to avoid incorrectly double counting sizes
                    // Example: a node is at max capacity 4, with children each of size 4 for 16 total.
                    // We split the node into two nodes of 2 children each, but this does *not* modify the size
                    // of its parent. Therefore when we insert the carry into the torn-off node, we must not
                    // increase its size or we will double-count the size of the carry subtree.
                    var tornOff = splitOffSide(parent);
                    BTree.insertNoCount(tornOff, sideInsertionIndex(tornOff), carry);
                    carry = tornOff;
                }
                d--;
            }
            var newRoot = undefined;
            if (carry !== undefined) {
                // Expansion reached the root, need a new root to hold carry
                var oldRoot = spine[0];
                newRoot = new BNodeInternal([oldRoot], oldRoot.size() + carry.size());
                BTree.insertNoCount(newRoot, sideInsertionIndex(newRoot), carry);
            }
            // Finally, insert the subtree at the insertion point
            BTree.insertNoCount(insertTarget, sideInsertionIndex(insertTarget), subtree);
            return newRoot;
        }
        else {
            // Insertion of subtree with equal height to current tree
            var oldRoot = spine[0];
            var newRoot = new BNodeInternal([oldRoot], oldRoot.size());
            BTree.insertNoCount(newRoot, sideInsertionIndex(newRoot), subtree);
            return newRoot;
        }
    };
    ;
    /**
     * Clone along the spine from [isSharedFrontierDepth to depthTo] inclusive so path is safe to mutate.
     * Short-circuits if first shared node is deeper than depthTo (the insertion depth).
     */
    BTree.ensureNotShared = function (spine, isSharedFrontierDepth, depthToInclusive, sideIndex) {
        if (spine.length === 1 /* only a leaf */ || depthToInclusive < 0 /* new root case */)
            return; // nothing to clone when root is a leaf; equal-height case will handle this
        // Clone root if needed first (depth 0)
        if (isSharedFrontierDepth === 0) {
            var root = spine[0];
            spine[0] = root.clone();
        }
        // Clone downward along the frontier to 'depthToInclusive'
        for (var depth = Math.max(isSharedFrontierDepth, 1); depth <= depthToInclusive; depth++) {
            var parent = spine[depth - 1];
            var childIndex = sideIndex(parent);
            var clone = parent.children[childIndex].clone();
            parent.children[childIndex] = clone;
            spine[depth] = clone;
        }
    };
    ;
    /**
     * Propogates size updates and updates max keys for nodes in (isSharedFrontierDepth, depthTo)
     */
    BTree.updateSizeAndMax = function (spine, unflushedSizes, isSharedFrontierDepth, depthUpToInclusive, updateMax) {
        // If isSharedFrontierDepth is <= depthUpToInclusive there is nothing to update because
        // the insertion point is inside a shared node which will always have correct sizes
        var maxKey = spine[isSharedFrontierDepth].maxKey();
        var startDepth = isSharedFrontierDepth - 1;
        for (var depth = startDepth; depth >= depthUpToInclusive; depth--) {
            var sizeAtLevel = unflushedSizes[depth];
            unflushedSizes[depth] = 0; // we are propagating it now
            if (depth > 0) {
                // propagate size upward, will be added lazily, either when a subtree is appended at or above that level or
                // at the end of processing the entire side
                unflushedSizes[depth - 1] += sizeAtLevel;
            }
            var node = spine[depth];
            node._size += sizeAtLevel;
            // No-op if left side, as max keys in parents are unchanged by appending to the beginning of a node
            updateMax(node, maxKey);
        }
    };
    ;
    /**
     * Update a spine (frontier) from a specific depth down, inclusive.
     * Extends the frontier array if it is not already as long as the frontier.
     */
    BTree.updateFrontier = function (frontier, depthLastValid, sideIndex) {
        check(frontier.length > depthLastValid, "updateFrontier: depthLastValid exceeds frontier height");
        var startingAncestor = frontier[depthLastValid];
        if (startingAncestor.isLeaf)
            return;
        var internal = startingAncestor;
        var cur = internal.children[sideIndex(internal)];
        var depth = depthLastValid + 1;
        while (!cur.isLeaf) {
            var ni = cur;
            frontier[depth] = ni;
            cur = ni.children[sideIndex(ni)];
            depth++;
        }
        frontier[depth] = cur;
    };
    ;
    /**
     * Find the first ancestor (starting at insertionDepth) with capacity.
     */
    BTree.findCascadeEndDepth = function (spine, insertionDepth, branchingFactor) {
        for (var depth = insertionDepth; depth >= 0; depth--) {
            if (spine[depth].keys.length < branchingFactor)
                return depth;
        }
        return -1; // no capacity, will need a new root
    };
    ;
    /**
     * Inserts the child without updating cached size counts.
     */
    BTree.insertNoCount = function (parent, index, child) {
        parent.children.splice(index, 0, child);
        parent.keys.splice(index, 0, child.maxKey());
    };
    // ---- Side-specific delegates for merging subtrees into a frontier ----
    BTree.getLeftmostIndex = function () {
        return 0;
    };
    BTree.getRightmostIndex = function (node) {
        return node.children.length - 1;
    };
    BTree.getRightInsertionIndex = function (node) {
        return node.children.length;
    };
    BTree.splitOffRightSide = function (node) {
        return node.splitOffRightSide();
    };
    BTree.splitOffLeftSide = function (node) {
        return node.splitOffLeftSide();
    };
    BTree.updateRightMax = function (node, maxBelow) {
        node.keys[node.keys.length - 1] = maxBelow;
    };
    BTree.noop = function () { };
    /**
     * Decomposes two trees into disjoint nodes. Reuses interior nodes when they do not overlap/intersect with any leaf nodes
     * in the other tree. Overlapping leaf nodes are broken down into new leaf nodes containing merged entries.
     * The algorithm is a parallel tree walk using two cursors. The trailing cursor (behind in key space) is walked forward
     * until it is at or after the leading cursor. As it does this, any whole nodes or subtrees it passes are guaranteed to
     * be disjoint. This is true because the leading cursor was also previously walked in this way, and is thus pointing to
     * the first key at or after the trailing cursor's previous position.
     * The cursor walk is efficient, meaning it skips over disjoint subtrees entirely rather than visiting every leaf.
     */
    BTree.decompose = function (left, right, mergeValues) {
        var cmp = left._compare;
        check(left._root.size() > 0 && right._root.size() > 0, "decompose requires non-empty inputs");
        // Holds the disjoint nodes that result from decomposition.
        // Alternating entries of (height, node) to avoid creating small tuples
        var disjoint = [];
        // During the decomposition, leaves that are not disjoint are decomposed into individual entries
        // that accumulate in this array in sorted order. They are flushed into leaf nodes whenever a reused
        // disjoint subtree is added to the disjoint set.
        // Note that there are unavoidable cases in which this will generate underfilled leaves.
        // An example of this would be a leaf in one tree that contained keys [0, 100, 101, 102].
        // In the other tree, there is a leaf that contains [2, 3, 4, 5]. This leaf can be ruesed entirely,
        // but the first tree's leaf must be decomposed into [0] and [100, 101, 102]
        var pending = [];
        var tallestIndex = -1, tallestHeight = -1;
        // During the upward part of the cursor walk, this holds the highest disjoint node seen so far.
        // This is done because we cannot know immediately whether we can add the node to the disjoint set
        // because its ancestor may also be disjoint and should be reused instead.
        var highestDisjoint = undefined;
        var flushPendingEntries = function () {
            var totalPairs = BTree.alternatingCount(pending);
            if (totalPairs === 0)
                return;
            // This method creates as many evenly filled leaves as possible from
            // the pending entries. All will be > 50% full if we are creating more than one leaf.
            var max = left._maxNodeSize;
            var leafCount = Math.ceil(totalPairs / max);
            var remaining = totalPairs;
            var pairIndex = 0;
            while (leafCount > 0) {
                var chunkSize = Math.ceil(remaining / leafCount);
                var keys = new Array(chunkSize);
                var vals = new Array(chunkSize);
                for (var i = 0; i < chunkSize; i++) {
                    keys[i] = BTree.alternatingGetFirst(pending, pairIndex);
                    vals[i] = BTree.alternatingGetSecond(pending, pairIndex);
                    pairIndex++;
                }
                remaining -= chunkSize;
                leafCount--;
                var leaf = new BNode(keys, vals);
                BTree.alternatingPush(disjoint, 0, leaf);
                if (tallestHeight < 0) {
                    tallestIndex = BTree.alternatingCount(disjoint) - 1;
                    tallestHeight = 0;
                }
            }
            pending.length = 0;
        };
        var addSharedNodeToDisjointSet = function (node, height) {
            flushPendingEntries();
            node.isShared = true;
            BTree.alternatingPush(disjoint, height, node);
            if (height > tallestHeight) {
                tallestIndex = BTree.alternatingCount(disjoint) - 1;
                tallestHeight = height;
            }
        };
        var addHighestDisjoint = function () {
            if (highestDisjoint !== undefined) {
                addSharedNodeToDisjointSet(highestDisjoint.node, highestDisjoint.height);
                highestDisjoint = undefined;
            }
        };
        // Mark all nodes at or above depthFrom in the cursor spine as disqualified (non-disjoint)
        var disqualifySpine = function (cursor, depthFrom) {
            var spine = cursor.spine;
            for (var i = depthFrom; i >= 0; --i) {
                var payload = spine[i].payload;
                // Safe to early out because we always disqualify all ancestors of a disqualified node
                // That is correct because every ancestor of a non-disjoint node is also non-disjoint
                // because it must enclose the non-disjoint range.
                if (payload.disqualified)
                    break;
                payload.disqualified = true;
            }
        };
        // Cursor payload factory
        var makePayload = function () { return ({ disqualified: false }); };
        var pushLeafRange = function (leaf, from, toExclusive) {
            var keys = leaf.keys;
            var values = leaf.values;
            for (var i = from; i < toExclusive; ++i)
                BTree.alternatingPush(pending, keys[i], values[i]);
        };
        var onMoveInLeaf = function (leaf, payload, fromIndex, toIndex, startedEqual) {
            check(payload.disqualified === true, "onMoveInLeaf: leaf must be disqualified");
            var start = startedEqual ? fromIndex + 1 : fromIndex;
            if (start < toIndex)
                pushLeafRange(leaf, start, toIndex);
        };
        var onExitLeaf = function (leaf, payload, startingIndex, startedEqual, cursorThis) {
            highestDisjoint = undefined;
            if (!payload.disqualified) {
                highestDisjoint = { node: leaf, height: 0 };
                if (cursorThis.spine.length === 0) {
                    // if we are exiting a leaf and there are no internal nodes, we will reach the end of the tree.
                    // In this case we need to add the leaf now because step up will not be called.
                    addHighestDisjoint();
                }
            }
            else {
                var start = startedEqual ? startingIndex + 1 : startingIndex;
                var leafSize = leaf.keys.length;
                if (start < leafSize)
                    pushLeafRange(leaf, start, leafSize);
            }
        };
        var onStepUp = function (parent, height, payload, fromIndex, spineIndex, stepDownIndex, cursorThis) {
            var children = parent.children;
            var nextHeight = height - 1;
            if (stepDownIndex !== stepDownIndex /* NaN: still walking up */
                || stepDownIndex === Number.POSITIVE_INFINITY /* target key is beyond edge of tree, done with walk */) {
                if (!payload.disqualified) {
                    highestDisjoint = { node: parent, height: height };
                    if (stepDownIndex === Number.POSITIVE_INFINITY) {
                        // We have finished our walk, and we won't be stepping down, so add the root
                        addHighestDisjoint();
                    }
                }
                else {
                    addHighestDisjoint();
                    var len = children.length;
                    for (var i = fromIndex + 1; i < len; ++i)
                        addSharedNodeToDisjointSet(children[i], nextHeight);
                }
            }
            else {
                // We have a valid step down index, so we need to disqualify the spine if needed.
                // This is identical to the step down logic, but we must also perform it here because
                // in the case of stepping down into a leaf, the step down callback is never called.
                if (stepDownIndex > 0) {
                    disqualifySpine(cursorThis, spineIndex);
                }
                addHighestDisjoint();
                for (var i = fromIndex + 1; i < stepDownIndex; ++i)
                    addSharedNodeToDisjointSet(children[i], nextHeight);
            }
        };
        var onStepDown = function (node, height, spineIndex, stepDownIndex, cursorThis) {
            if (stepDownIndex > 0) {
                // When we step down into a node, we know that we have walked from a key that is less than our target.
                // Because of this, if we are not stepping down into the first child, we know that all children before
                // the stepDownIndex must overlap with the other tree because they must be before our target key. Since
                // the child we are stepping into has a key greater than our target key, this node must overlap.
                // If a child overlaps, the entire spine overlaps because a parent in a btree always encloses the range
                // of its children.
                disqualifySpine(cursorThis, spineIndex);
                var children = node.children;
                var nextHeight = height - 1;
                for (var i = 0; i < stepDownIndex; ++i)
                    addSharedNodeToDisjointSet(children[i], nextHeight);
            }
        };
        var onEnterLeaf = function (leaf, destIndex, cursorThis, cursorOther) {
            if (destIndex > 0
                || areOverlapping(leaf.minKey(), leaf.maxKey(), BTree.getKey(cursorOther), cursorOther.leaf.maxKey(), cmp)) {
                // Similar logic to the step-down case, except in this case we also know the leaf in the other
                // tree overlaps a leaf in this tree (this leaf, specifically). Thus, we can disqualify both spines.
                cursorThis.leafPayload.disqualified = true;
                cursorOther.leafPayload.disqualified = true;
                disqualifySpine(cursorThis, cursorThis.spine.length - 1);
                disqualifySpine(cursorOther, cursorOther.spine.length - 1);
                pushLeafRange(leaf, 0, destIndex);
            }
        };
        // Need the max key of both trees to perform the "finishing" walk of which ever cursor finishes second
        var maxKeyLeft = left._root.maxKey();
        var maxKeyRight = right._root.maxKey();
        var maxKey = cmp(maxKeyLeft, maxKeyRight) >= 0 ? maxKeyLeft : maxKeyRight;
        // Initialize cursors at minimum keys.
        var curA = BTree.createCursor(left, makePayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown);
        var curB = BTree.createCursor(right, makePayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown);
        // The guarantee that no overlapping interior nodes are accidentally reused relies on the careful
        // alternating hopping walk of the cursors: WLOG, cursorA always--with one exception--walks from a key just behind (in key space)
        // the key of cursorB to the first key >= cursorB. Call this transition a "crossover point." All interior nodes that
        // overlap cause a crossover point, and all crossover points are guaranteed to be walked using this method. Thus,
        // all overlapping interior nodes will be found if they are checked for on step-down.
        // The one exception mentioned above is when they start at the same key. In this case, they are both advanced forward and then
        // their new ordering determines how they walk from there.
        // The one issue then is detecting any overlaps that occur based on their very initial position (minimum key of each tree).
        // This is handled by the initial disqualification step below, which essentially emulates the step down disqualification for each spine.
        // Initialize disqualification w.r.t. opposite leaf.
        var initDisqualify = function (cur, other) {
            var minKey = BTree.getKey(cur);
            var otherMin = BTree.getKey(other);
            var otherMax = other.leaf.maxKey();
            if (areOverlapping(minKey, cur.leaf.maxKey(), otherMin, otherMax, cmp))
                cur.leafPayload.disqualified = true;
            for (var i = 0; i < cur.spine.length; ++i) {
                var entry = cur.spine[i];
                // Since we are on the left side of the tree, we can use the leaf min key for every spine node
                if (areOverlapping(minKey, entry.node.maxKey(), otherMin, otherMax, cmp))
                    entry.payload.disqualified = true;
            }
        };
        initDisqualify(curA, curB);
        initDisqualify(curB, curA);
        var leading = curA;
        var trailing = curB;
        var order = cmp(BTree.getKey(leading), BTree.getKey(trailing));
        // Walk both cursors in alternating hops
        while (true) {
            var areEqual = order === 0;
            if (areEqual) {
                var key = BTree.getKey(leading);
                var vA = curA.leaf.values[curA.leafIndex];
                var vB = curB.leaf.values[curB.leafIndex];
                // Perform the actual merge of values here. The cursors will avoid adding a duplicate of this key/value
                // to pending because they respect the areEqual flag during their moves.
                var merged = mergeValues(key, vA, vB);
                if (merged !== undefined)
                    BTree.alternatingPush(pending, key, merged);
                var outTrailing = BTree.moveForwardOne(trailing, leading, key, cmp);
                var outLeading = BTree.moveForwardOne(leading, trailing, key, cmp);
                if (outTrailing || outLeading) {
                    if (!outTrailing || !outLeading) {
                        // In these cases, we pass areEqual=false because a return value of "out of tree" means
                        // the cursor did not move. This must be true because they started equal and one of them had more tree
                        // to walk (one is !out), so they cannot be equal at this point.
                        if (outTrailing) {
                            BTree.moveTo(leading, trailing, maxKey, false, false, cmp);
                        }
                        else {
                            BTree.moveTo(trailing, leading, maxKey, false, false, cmp);
                        }
                    }
                    break;
                }
                order = cmp(BTree.getKey(leading), BTree.getKey(trailing));
            }
            else {
                if (order < 0) {
                    var tmp = trailing;
                    trailing = leading;
                    leading = tmp;
                }
                var _a = BTree.moveTo(trailing, leading, BTree.getKey(leading), true, areEqual, cmp), out = _a[0], nowEqual = _a[1];
                if (out) {
                    BTree.moveTo(leading, trailing, maxKey, false, areEqual, cmp);
                    break;
                }
                else if (nowEqual) {
                    order = 0;
                }
                else {
                    order = -1;
                }
            }
        }
        // Ensure any trailing non-disjoint entries are added
        flushPendingEntries();
        return { disjoint: disjoint, tallestIndex: tallestIndex };
    };
    // ------- Alternating list helpers -------
    // These helpers manage a list that alternates between two types of entries.
    // Storing data this way avoids small tuple allocations and shows major improvements
    // in GC time in benchmarks.
    BTree.alternatingCount = function (list) {
        return list.length >> 1;
    };
    BTree.alternatingGetFirst = function (list, index) {
        return list[index << 1];
    };
    BTree.alternatingGetSecond = function (list, index) {
        return list[(index << 1) + 1];
    };
    BTree.alternatingPush = function (list, first, second) {
        // Micro benchmarks show this is the fastest way to do this
        list.push(first, second);
    };
    /**
     * Walks the cursor forward by one key.
     * Should only be called to advance cursors that started equal.
     * Returns true if end-of-tree was reached (cursor not structurally mutated).
     */
    BTree.moveForwardOne = function (cur, other, currentKey, cmp) {
        var leaf = cur.leaf;
        var nextIndex = cur.leafIndex + 1;
        if (nextIndex < leaf.keys.length) {
            // Still within current leaf
            cur.onMoveInLeaf(leaf, cur.leafPayload, cur.leafIndex, nextIndex, true);
            cur.leafIndex = nextIndex;
            return false;
        }
        // If our optimizaed step within leaf failed, use full moveTo logic
        // Pass isInclusive=false to ensure we walk forward to the key exactly after the current
        return BTree.moveTo(cur, other, currentKey, false, true, cmp)[0];
    };
    /**
     * Move cursor strictly forward to the first key >= (inclusive) or > (exclusive) target.
     * Returns a boolean indicating if end-of-tree was reached (cursor not structurally mutated).
     * Also returns a boolean indicating if the target key was landed on exactly.
     */
    BTree.moveTo = function (cur, other, targetKey, isInclusive, startedEqual, cmp) {
        // Cache callbacks for perf
        var onMoveInLeaf = cur.onMoveInLeaf;
        // Fast path: destination within current leaf
        var leaf = cur.leaf;
        var leafPayload = cur.leafPayload;
        var i = leaf.indexOf(targetKey, -1, cmp);
        var destInLeaf;
        var targetExactlyReached;
        if (i < 0) {
            destInLeaf = ~i;
            targetExactlyReached = false;
        }
        else {
            if (isInclusive) {
                destInLeaf = i;
                targetExactlyReached = true;
            }
            else {
                destInLeaf = i + 1;
                targetExactlyReached = false;
            }
        }
        var leafKeyCount = leaf.keys.length;
        if (destInLeaf < leafKeyCount) {
            onMoveInLeaf(leaf, leafPayload, cur.leafIndex, destInLeaf, startedEqual);
            cur.leafIndex = destInLeaf;
            return [false, targetExactlyReached];
        }
        // Find first ancestor with a viable right step
        var spine = cur.spine;
        var initialSpineLength = spine.length;
        var descentLevel = -1;
        var descentIndex = -1;
        for (var s = initialSpineLength - 1; s >= 0; s--) {
            var parent = spine[s].node;
            var indexOf = parent.indexOf(targetKey, -1, cmp);
            var stepDownIndex = void 0;
            if (indexOf < 0) {
                stepDownIndex = ~indexOf;
            }
            else {
                stepDownIndex = isInclusive ? indexOf : indexOf + 1;
            }
            // Note: when key not found, indexOf with failXor=0 already returns insertion index
            if (stepDownIndex < parent.keys.length) {
                descentLevel = s;
                descentIndex = stepDownIndex;
                break;
            }
        }
        // Exit leaf; even if no spine, we did walk out of it conceptually
        var startIndex = cur.leafIndex;
        cur.onExitLeaf(leaf, leafPayload, startIndex, startedEqual, cur);
        var onStepUp = cur.onStepUp;
        if (descentLevel < 0) {
            // No descent point; step up all the way; last callback gets infinity
            for (var depth = initialSpineLength - 1; depth >= 0; depth--) {
                var entry_1 = spine[depth];
                var sd = depth === 0 ? Number.POSITIVE_INFINITY : Number.NaN;
                onStepUp(entry_1.node, initialSpineLength - depth, entry_1.payload, entry_1.childIndex, depth, sd, cur);
            }
            return [true, false];
        }
        // Step up through ancestors above the descentLevel
        for (var depth = initialSpineLength - 1; depth > descentLevel; depth--) {
            var entry_2 = spine[depth];
            onStepUp(entry_2.node, initialSpineLength - depth, entry_2.payload, entry_2.childIndex, depth, Number.NaN, cur);
        }
        var entry = spine[descentLevel];
        onStepUp(entry.node, initialSpineLength - descentLevel, entry.payload, entry.childIndex, descentLevel, descentIndex, cur);
        entry.childIndex = descentIndex;
        var onStepDown = cur.onStepDown;
        var makePayload = cur.makePayload;
        // Descend, invoking onStepDown and creating payloads
        var height = initialSpineLength - descentLevel - 1; // calculate height before changing length
        spine.length = descentLevel + 1;
        var node = spine[descentLevel].node.children[descentIndex];
        while (!node.isLeaf) {
            var ni = node;
            var keys = ni.keys;
            var stepDownIndex = ni.indexOf(targetKey, 0, cmp);
            if (!isInclusive && stepDownIndex < keys.length && cmp(keys[stepDownIndex], targetKey) === 0)
                stepDownIndex++;
            var payload = makePayload();
            var spineIndex = spine.length;
            spine.push({ node: ni, childIndex: stepDownIndex, payload: payload });
            onStepDown(ni, height, spineIndex, stepDownIndex, cur);
            node = ni.children[stepDownIndex];
            height -= 1;
        }
        // Enter destination leaf
        var idx = node.indexOf(targetKey, -1, cmp);
        var destIndex;
        if (idx < 0) {
            destIndex = ~idx;
            targetExactlyReached = false;
        }
        else {
            if (isInclusive) {
                destIndex = idx;
                targetExactlyReached = true;
            }
            else {
                destIndex = idx + 1;
                targetExactlyReached = false;
            }
        }
        cur.leaf = node;
        cur.leafPayload = makePayload();
        cur.leafIndex = destIndex;
        cur.onEnterLeaf(node, destIndex, cur, other);
        return [false, targetExactlyReached];
    };
    /**
     * Create a cursor pointing to the leftmost key of the supplied tree.
     */
    BTree.createCursor = function (tree, makePayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown) {
        var spine = [];
        var n = tree._root;
        while (!n.isLeaf) {
            var ni = n;
            var payload = makePayload();
            spine.push({ node: ni, childIndex: 0, payload: payload });
            n = ni.children[0];
        }
        var leafPayload = makePayload();
        var cur = {
            tree: tree,
            leaf: n, leafIndex: 0,
            spine: spine,
            leafPayload: leafPayload,
            makePayload: makePayload,
            onEnterLeaf: onEnterLeaf,
            onMoveInLeaf: onMoveInLeaf,
            onExitLeaf: onExitLeaf,
            onStepUp: onStepUp,
            onStepDown: onStepDown
        };
        return cur;
    };
    BTree.getKey = function (c) {
        return c.leaf.keys[c.leafIndex];
    };
    /**
     * Computes the differences between `this` and `other`.
     * For efficiency, the diff is returned via invocations of supplied handlers.
     * The computation is optimized for the case in which the two trees have large amounts
     * of shared data (obtained by calling the `clone` or `with` APIs) and will avoid
     * any iteration of shared state.
     * The handlers can cause computation to early exit by returning {break: R}.
     * Neither of the collections should be changed during the comparison process (in your callbacks), as this method assumes they will not be mutated.
     * @param other The tree to compute a diff against.
     * @param onlyThis Callback invoked for all keys only present in `this`.
     * @param onlyOther Callback invoked for all keys only present in `other`.
     * @param different Callback invoked for all keys with differing values.
     */
    BTree.prototype.diffAgainst = function (other, onlyThis, onlyOther, different) {
        if (other._compare !== this._compare) {
            throw new Error("Tree comparators are not the same.");
        }
        if (this.isEmpty || other.isEmpty) {
            if (this.isEmpty && other.isEmpty)
                return undefined;
            // If one tree is empty, everything will be an onlyThis/onlyOther.
            if (this.isEmpty)
                return onlyOther === undefined ? undefined : BTree.stepToEnd(BTree.makeDiffCursor(other), onlyOther);
            return onlyThis === undefined ? undefined : BTree.stepToEnd(BTree.makeDiffCursor(this), onlyThis);
        }
        // Cursor-based diff algorithm is as follows:
        // - Until neither cursor has navigated to the end of the tree, do the following:
        //  - If the `this` cursor is "behind" the `other` cursor (strictly <, via compare), advance it.
        //  - Otherwise, advance the `other` cursor.
        //  - Any time a cursor is stepped, perform the following:
        //    - If either cursor points to a key/value pair:
        //      - If thisCursor === otherCursor and the values differ, it is a Different.
        //      - If thisCursor > otherCursor and otherCursor is at a key/value pair, it is an OnlyOther.
        //      - If thisCursor < otherCursor and thisCursor is at a key/value pair, it is an OnlyThis as long as the most recent 
        //        cursor step was *not* otherCursor advancing from a tie. The extra condition avoids erroneous OnlyOther calls 
        //        that would occur due to otherCursor being the "leader".
        //    - Otherwise, if both cursors point to nodes, compare them. If they are equal by reference (shared), skip
        //      both cursors to the next node in the walk.
        // - Once one cursor has finished stepping, any remaining steps (if any) are taken and key/value pairs are logged
        //   as OnlyOther (if otherCursor is stepping) or OnlyThis (if thisCursor is stepping).
        // This algorithm gives the critical guarantee that all locations (both nodes and key/value pairs) in both trees that 
        // are identical by value (and possibly by reference) will be visited *at the same time* by the cursors.
        // This removes the possibility of emitting incorrect diffs, as well as allowing for skipping shared nodes.
        var _compare = this._compare;
        var thisCursor = BTree.makeDiffCursor(this);
        var otherCursor = BTree.makeDiffCursor(other);
        // It doesn't matter how thisSteppedLast is initialized.
        // Step order is only used when either cursor is at a leaf, and cursors always start at a node.
        var thisSuccess = true, otherSuccess = true, prevCursorOrder = BTree.compare(thisCursor, otherCursor, _compare);
        while (thisSuccess && otherSuccess) {
            var cursorOrder = BTree.compare(thisCursor, otherCursor, _compare);
            var thisLeaf = thisCursor.leaf, thisInternalSpine = thisCursor.internalSpine, thisLevelIndices = thisCursor.levelIndices;
            var otherLeaf = otherCursor.leaf, otherInternalSpine = otherCursor.internalSpine, otherLevelIndices = otherCursor.levelIndices;
            if (thisLeaf || otherLeaf) {
                // If the cursors were at the same location last step, then there is no work to be done.
                if (prevCursorOrder !== 0) {
                    if (cursorOrder === 0) {
                        if (thisLeaf && otherLeaf && different) {
                            // Equal keys, check for modifications
                            var valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
                            var valOther = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
                            if (!Object.is(valThis, valOther)) {
                                var result = different(thisCursor.currentKey, valThis, valOther);
                                if (result && result.break)
                                    return result.break;
                            }
                        }
                    }
                    else if (cursorOrder > 0) {
                        // If this is the case, we know that either:
                        // 1. otherCursor stepped last from a starting position that trailed thisCursor, and is still behind, or
                        // 2. thisCursor stepped last and leapfrogged otherCursor
                        // Either of these cases is an "only other"
                        if (otherLeaf && onlyOther) {
                            var otherVal = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
                            var result = onlyOther(otherCursor.currentKey, otherVal);
                            if (result && result.break)
                                return result.break;
                        }
                    }
                    else if (onlyThis) {
                        if (thisLeaf && prevCursorOrder !== 0) {
                            var valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
                            var result = onlyThis(thisCursor.currentKey, valThis);
                            if (result && result.break)
                                return result.break;
                        }
                    }
                }
            }
            else if (!thisLeaf && !otherLeaf && cursorOrder === 0) {
                var lastThis = thisInternalSpine.length - 1;
                var lastOther = otherInternalSpine.length - 1;
                var nodeThis = thisInternalSpine[lastThis][thisLevelIndices[lastThis]];
                var nodeOther = otherInternalSpine[lastOther][otherLevelIndices[lastOther]];
                if (nodeOther === nodeThis) {
                    prevCursorOrder = 0;
                    thisSuccess = BTree.step(thisCursor, true);
                    otherSuccess = BTree.step(otherCursor, true);
                    continue;
                }
            }
            prevCursorOrder = cursorOrder;
            if (cursorOrder < 0) {
                thisSuccess = BTree.step(thisCursor);
            }
            else {
                otherSuccess = BTree.step(otherCursor);
            }
        }
        if (thisSuccess && onlyThis)
            return BTree.finishCursorWalk(thisCursor, otherCursor, _compare, onlyThis);
        if (otherSuccess && onlyOther)
            return BTree.finishCursorWalk(otherCursor, thisCursor, _compare, onlyOther);
    };
    ///////////////////////////////////////////////////////////////////////////
    // Helper methods for diffAgainst /////////////////////////////////////////
    BTree.finishCursorWalk = function (cursor, cursorFinished, compareKeys, callback) {
        var compared = BTree.compare(cursor, cursorFinished, compareKeys);
        if (compared === 0) {
            if (!BTree.step(cursor))
                return undefined;
        }
        else if (compared < 0) {
            check(false, "cursor walk terminated early");
        }
        return BTree.stepToEnd(cursor, callback);
    };
    BTree.stepToEnd = function (cursor, callback) {
        var canStep = true;
        while (canStep) {
            var leaf = cursor.leaf, levelIndices = cursor.levelIndices, currentKey = cursor.currentKey;
            if (leaf) {
                var value = leaf.values[levelIndices[levelIndices.length - 1]];
                var result = callback(currentKey, value);
                if (result && result.break)
                    return result.break;
            }
            canStep = BTree.step(cursor);
        }
        return undefined;
    };
    BTree.makeDiffCursor = function (tree) {
        var _root = tree._root, height = tree.height;
        return { height: height, internalSpine: [[_root]], levelIndices: [0], leaf: undefined, currentKey: _root.maxKey() };
    };
    /**
     * Advances the cursor to the next step in the walk of its tree.
     * Cursors are walked backwards in sort order, as this allows them to leverage maxKey() in order to be compared in O(1).
     * @param cursor The cursor to step
     * @param stepToNode If true, the cursor will be advanced to the next node (skipping values)
     * @returns true if the step was completed and false if the step would have caused the cursor to move beyond the end of the tree.
     */
    BTree.step = function (cursor, stepToNode) {
        var internalSpine = cursor.internalSpine, levelIndices = cursor.levelIndices, leaf = cursor.leaf;
        if (stepToNode === true || leaf) {
            var levelsLength = levelIndices.length;
            // Step to the next node only if:
            // - We are explicitly directed to via stepToNode, or
            // - There are no key/value pairs left to step to in this leaf
            if (stepToNode === true || levelIndices[levelsLength - 1] === 0) {
                var spineLength = internalSpine.length;
                // Root is leaf
                if (spineLength === 0)
                    return false;
                // Walk back up the tree until we find a new subtree to descend into
                var nodeLevelIndex = spineLength - 1;
                var levelIndexWalkBack = nodeLevelIndex;
                while (levelIndexWalkBack >= 0) {
                    if (levelIndices[levelIndexWalkBack] > 0) {
                        if (levelIndexWalkBack < levelsLength - 1) {
                            // Remove leaf state from cursor
                            cursor.leaf = undefined;
                            levelIndices.pop();
                        }
                        // If we walked upwards past any internal node, slice them out
                        if (levelIndexWalkBack < nodeLevelIndex)
                            cursor.internalSpine = internalSpine.slice(0, levelIndexWalkBack + 1);
                        // Move to new internal node
                        cursor.currentKey = internalSpine[levelIndexWalkBack][--levelIndices[levelIndexWalkBack]].maxKey();
                        return true;
                    }
                    levelIndexWalkBack--;
                }
                // Cursor is in the far left leaf of the tree, no more nodes to enumerate
                return false;
            }
            else {
                // Move to new leaf value
                var valueIndex = --levelIndices[levelsLength - 1];
                cursor.currentKey = leaf.keys[valueIndex];
                return true;
            }
        }
        else { // Cursor does not point to a value in a leaf, so move downwards
            var nextLevel = internalSpine.length;
            var currentLevel = nextLevel - 1;
            var node = internalSpine[currentLevel][levelIndices[currentLevel]];
            if (node.isLeaf) {
                // Entering into a leaf. Set the cursor to point at the last key/value pair.
                cursor.leaf = node;
                var valueIndex = levelIndices[nextLevel] = node.values.length - 1;
                cursor.currentKey = node.keys[valueIndex];
            }
            else {
                var children = node.children;
                internalSpine[nextLevel] = children;
                var childIndex = children.length - 1;
                levelIndices[nextLevel] = childIndex;
                cursor.currentKey = children[childIndex].maxKey();
            }
            return true;
        }
    };
    /**
     * Compares the two cursors. Returns a value indicating which cursor is ahead in a walk.
     * Note that cursors are advanced in reverse sorting order.
     */
    BTree.compare = function (cursorA, cursorB, compareKeys) {
        var heightA = cursorA.height, currentKeyA = cursorA.currentKey, levelIndicesA = cursorA.levelIndices;
        var heightB = cursorB.height, currentKeyB = cursorB.currentKey, levelIndicesB = cursorB.levelIndices;
        // Reverse the comparison order, as cursors are advanced in reverse sorting order
        var keyComparison = compareKeys(currentKeyB, currentKeyA);
        if (keyComparison !== 0) {
            return keyComparison;
        }
        // Normalize depth values relative to the shortest tree.
        // This ensures that concurrent cursor walks of trees of differing heights can reliably land on shared nodes at the same time.
        // To accomplish this, a cursor that is on an internal node at depth D1 with maxKey X is considered "behind" a cursor on an
        // internal node at depth D2 with maxKey Y, when D1 < D2. Thus, always walking the cursor that is "behind" will allow the cursor
        // at shallower depth (but equal maxKey) to "catch up" and land on shared nodes.
        var heightMin = heightA < heightB ? heightA : heightB;
        var depthANormalized = levelIndicesA.length - (heightA - heightMin);
        var depthBNormalized = levelIndicesB.length - (heightB - heightMin);
        return depthANormalized - depthBNormalized;
    };
    // End of helper methods for diffAgainst //////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
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
            var isShared = void 0;
            while (root.keys.length <= 1 && !root.isLeaf) {
                isShared || (isShared = root.isShared);
                this._root = root = root.keys.length === 0 ? EmptyLeaf :
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
        var size = this._root.checkValid(0, this, 0)[0];
        check(size === this.size, "size mismatch: counted ", size, "but stored", this.size);
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
        enumerable: false,
        configurable: true
    });
    BNode.prototype.size = function () {
        return this.keys.length;
    };
    ///////////////////////////////////////////////////////////////////////////
    // Shared methods /////////////////////////////////////////////////////////
    BNode.prototype.maxKey = function () {
        return this.keys[this.keys.length - 1];
    };
    // If key not found, returns i^failXor where i is the insertion index.
    // Callers that don't care whether there was a match will set failXor=0.
    BNode.prototype.indexOf = function (key, failXor, cmp) {
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
    /////////////////////////////////////////////////////////////////////////////
    // Leaf Node: misc //////////////////////////////////////////////////////////
    BNode.prototype.minKey = function () {
        return this.keys[0];
    };
    BNode.prototype.minPair = function (reusedArray) {
        if (this.keys.length === 0)
            return undefined;
        reusedArray[0] = this.keys[0];
        reusedArray[1] = this.values[0];
        return reusedArray;
    };
    BNode.prototype.maxPair = function (reusedArray) {
        if (this.keys.length === 0)
            return undefined;
        var lastIndex = this.keys.length - 1;
        reusedArray[0] = this.keys[lastIndex];
        reusedArray[1] = this.values[lastIndex];
        return reusedArray;
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
    BNode.prototype.getPairOrNextLower = function (key, compare, inclusive, reusedArray) {
        var i = this.indexOf(key, -1, compare);
        var indexOrLower = i < 0 ? ~i - 1 : (inclusive ? i : i - 1);
        if (indexOrLower >= 0) {
            reusedArray[0] = this.keys[indexOrLower];
            reusedArray[1] = this.values[indexOrLower];
            return reusedArray;
        }
        return undefined;
    };
    BNode.prototype.getPairOrNextHigher = function (key, compare, inclusive, reusedArray) {
        var i = this.indexOf(key, -1, compare);
        var indexOrLower = i < 0 ? ~i : (inclusive ? i : i + 1);
        var keys = this.keys;
        if (indexOrLower < keys.length) {
            reusedArray[0] = keys[indexOrLower];
            reusedArray[1] = this.values[indexOrLower];
            return reusedArray;
        }
        return undefined;
    };
    BNode.prototype.checkValid = function (depth, tree, baseIndex) {
        var kL = this.keys.length, vL = this.values.length;
        check(this.values === undefVals ? kL <= vL : kL === vL, "keys/values length mismatch: depth", depth, "with lengths", kL, vL, "and baseIndex", baseIndex);
        // Note: we don't check for "node too small" because sometimes a node
        // can legitimately have size 1. This occurs if there is a batch 
        // deletion, leaving a node of size 1, and the siblings are full so
        // it can't be merged with adjacent nodes. However, the parent will
        // verify that the average node size is at least half of the maximum.
        check(depth == 0 || kL > 0, "empty leaf at depth", depth, "and baseIndex", baseIndex);
        for (var i = 1; i < kL; i++) {
            var c = tree._compare(this.keys[i - 1], this.keys[i]);
            check(c < 0, "keys out of order at depth", depth, "and baseIndex", baseIndex + i - 1, ": ", this.keys[i - 1], " !< ", this.keys[i]);
        }
        return [kL, this.keys[0], this.keys[kL - 1]];
    };
    /////////////////////////////////////////////////////////////////////////////
    // Leaf Node: set & node splitting //////////////////////////////////////////
    BNode.prototype.set = function (key, value, overwrite, tree) {
        var i = this.indexOf(key, -1, tree._compare);
        if (i < 0) {
            // key does not exist yet
            i = ~i;
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
    /////////////////////////////////////////////////////////////////////////////
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
    /**
     * This does not mark `children` as shared, so it is the responsibility of the caller
     * to ensure children are either marked shared, or aren't included in another tree.
     */
    function BNodeInternal(children, size, keys) {
        var _this = this;
        if (!keys) {
            keys = [];
            for (var i = 0; i < children.length; i++)
                keys[i] = children[i].maxKey();
        }
        _this = _super.call(this, keys) || this;
        _this.children = children;
        _this._size = size;
        return _this;
    }
    BNodeInternal.prototype.clone = function () {
        var children = this.children.slice(0);
        for (var i = 0; i < children.length; i++)
            children[i].isShared = true;
        return new BNodeInternal(children, this._size, this.keys.slice(0));
    };
    BNodeInternal.prototype.size = function () {
        return this._size;
    };
    BNodeInternal.prototype.greedyClone = function (force) {
        if (this.isShared && !force)
            return this;
        var nu = new BNodeInternal(this.children.slice(0), this._size, this.keys.slice(0));
        for (var i = 0; i < nu.children.length; i++)
            nu.children[i] = nu.children[i].greedyClone(force);
        return nu;
    };
    BNodeInternal.prototype.minKey = function () {
        return this.children[0].minKey();
    };
    BNodeInternal.prototype.minPair = function (reusedArray) {
        return this.children[0].minPair(reusedArray);
    };
    BNodeInternal.prototype.maxPair = function (reusedArray) {
        return this.children[this.children.length - 1].maxPair(reusedArray);
    };
    BNodeInternal.prototype.get = function (key, defaultValue, tree) {
        var i = this.indexOf(key, 0, tree._compare), children = this.children;
        return i < children.length ? children[i].get(key, defaultValue, tree) : undefined;
    };
    BNodeInternal.prototype.getPairOrNextLower = function (key, compare, inclusive, reusedArray) {
        var i = this.indexOf(key, 0, compare), children = this.children;
        if (i >= children.length)
            return this.maxPair(reusedArray);
        var result = children[i].getPairOrNextLower(key, compare, inclusive, reusedArray);
        if (result === undefined && i > 0) {
            return children[i - 1].maxPair(reusedArray);
        }
        return result;
    };
    BNodeInternal.prototype.getPairOrNextHigher = function (key, compare, inclusive, reusedArray) {
        var i = this.indexOf(key, 0, compare), children = this.children, length = children.length;
        if (i >= length)
            return undefined;
        var result = children[i].getPairOrNextHigher(key, compare, inclusive, reusedArray);
        if (result === undefined && i < length - 1) {
            return children[i + 1].minPair(reusedArray);
        }
        return result;
    };
    BNodeInternal.prototype.checkValid = function (depth, tree, baseIndex) {
        var kL = this.keys.length, cL = this.children.length;
        check(kL === cL, "keys/children length mismatch: depth", depth, "lengths", kL, cL, "baseIndex", baseIndex);
        check(kL > 1 || depth > 0, "internal node has length", kL, "at depth", depth, "baseIndex", baseIndex);
        var size = 0, c = this.children, k = this.keys, childSize = 0;
        var prevMinKey = undefined;
        var prevMaxKey = undefined;
        for (var i = 0; i < cL; i++) {
            var child = c[i];
            var _a = child.checkValid(depth + 1, tree, baseIndex + size), subtreeSize = _a[0], minKey = _a[1], maxKey = _a[2];
            check(subtreeSize === child.size(), "cached size mismatch at depth", depth, "index", i, "baseIndex", baseIndex);
            check(subtreeSize === 1 || tree._compare(minKey, maxKey) < 0, "child node keys not sorted at depth", depth, "index", i, "baseIndex", baseIndex);
            if (prevMinKey !== undefined && prevMaxKey !== undefined) {
                check(!areOverlapping(prevMinKey, prevMaxKey, minKey, maxKey, tree._compare), "children keys not sorted at depth", depth, "index", i, "baseIndex", baseIndex, ": ", prevMaxKey, " !< ", minKey);
                check(tree._compare(prevMaxKey, minKey) < 0, "children keys not sorted at depth", depth, "index", i, "baseIndex", baseIndex, ": ", prevMaxKey, " !< ", minKey);
            }
            prevMinKey = minKey;
            prevMaxKey = maxKey;
            size += subtreeSize;
            childSize += child.keys.length;
            check(size >= childSize, "wtf", baseIndex); // no way this will ever fail
            check(i === 0 || c[i - 1].constructor === child.constructor, "type mismatch, baseIndex:", baseIndex);
            if (child.maxKey() != k[i])
                check(false, "keys[", i, "] =", k[i], "is wrong, should be ", child.maxKey(), "at depth", depth, "baseIndex", baseIndex);
            if (!(i === 0 || tree._compare(k[i - 1], k[i]) < 0))
                check(false, "sort violation at depth", depth, "index", i, "keys", k[i - 1], k[i]);
        }
        check(this._size === size, "internal node cached size mismatch at depth", depth, "baseIndex", baseIndex, "cached", this._size, "actual", size);
        // 2020/08: BTree doesn't always avoid grossly undersized nodes,
        // but AFAIK such nodes are pretty harmless, so accept them.
        var toofew = childSize === 0; // childSize < (tree.maxNodeSize >> 1)*cL;
        if (toofew || childSize > tree.maxNodeSize * cL)
            check(false, toofew ? "too few" : "too many", "children (", childSize, size, ") at depth", depth, "maxNodeSize:", tree.maxNodeSize, "children.length:", cL, "baseIndex:", baseIndex);
        return [size, this.minKey(), this.maxKey()];
    };
    /////////////////////////////////////////////////////////////////////////////
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
        var oldSize = child.size();
        var result = child.set(key, value, overwrite, tree);
        this._size += child.size() - oldSize;
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
    /**
     * Inserts `child` at index `i`.
     * This does not mark `child` as shared, so it is the responsibility of the caller
     * to ensure that either child is marked shared, or it is not included in another tree.
     */
    BNodeInternal.prototype.insert = function (i, child) {
        this.children.splice(i, 0, child);
        this.keys.splice(i, 0, child.maxKey());
        this._size += child.size();
    };
    /**
     * Split this node.
     * Modifies this to remove the second half of the items, returning a separate node containing them.
     */
    BNodeInternal.prototype.splitOffRightSide = function () {
        // assert !this.isShared;
        var half = this.children.length >> 1;
        var newChildren = this.children.splice(half);
        var newKeys = this.keys.splice(half);
        var sizePrev = this._size;
        this._size = sumChildSizes(this.children);
        var newNode = new BNodeInternal(newChildren, sizePrev - this._size, newKeys);
        return newNode;
    };
    /**
     * Split this node.
     * Modifies this to remove the first half of the items, returning a separate node containing them.
     */
    BNodeInternal.prototype.splitOffLeftSide = function () {
        // assert !this.isShared;
        var half = this.children.length >> 1;
        var newChildren = this.children.splice(0, half);
        var newKeys = this.keys.splice(0, half);
        var sizePrev = this._size;
        this._size = sumChildSizes(this.children);
        var newNode = new BNodeInternal(newChildren, sizePrev - this._size, newKeys);
        return newNode;
    };
    BNodeInternal.prototype.takeFromRight = function (rhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
        var rhsInternal = rhs;
        this.keys.push(rhs.keys.shift());
        var child = rhsInternal.children.shift();
        this.children.push(child);
        var size = child.size();
        rhsInternal._size -= size;
        this._size += size;
    };
    BNodeInternal.prototype.takeFromLeft = function (lhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
        var lhsInternal = lhs;
        var child = lhsInternal.children.pop();
        this.keys.unshift(lhs.keys.pop());
        this.children.unshift(child);
        var size = child.size();
        lhsInternal._size -= size;
        this._size += size;
    };
    /////////////////////////////////////////////////////////////////////////////
    // Internal Node: scanning & deletions //////////////////////////////////////
    // Note: `count` is the next value of the third argument to `onFound`. 
    //       A leaf node's `forRange` function returns a new value for this counter,
    //       unless the operation is to stop early.
    BNodeInternal.prototype.forRange = function (low, high, includeHigh, editMode, tree, count, onFound) {
        var cmp = tree._compare;
        var keys = this.keys, children = this.children;
        var iLow = this.indexOf(low, 0, cmp), i = iLow;
        var iHigh = Math.min(high === low ? iLow : this.indexOf(high, 0, cmp), keys.length - 1);
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
                    var child = children[i];
                    if (child.isShared)
                        children[i] = child = child.clone();
                    var beforeSize = child.size();
                    var result_1 = child.forRange(low, high, includeHigh, editMode, tree, count, onFound);
                    // Note: if children[i] is empty then keys[i]=undefined.
                    //       This is an invalid state, but it is fixed below.
                    keys[i] = child.maxKey();
                    this._size += child.size() - beforeSize;
                    if (typeof result_1 !== 'number')
                        return result_1;
                    count = result_1;
                }
            }
            finally {
                // Deletions may have occurred, so look for opportunities to merge nodes.
                var half = tree._maxNodeSize >> 1;
                if (iLow > 0)
                    iLow--;
                for (i = iHigh; i >= iLow; i--) {
                    if (children[i].keys.length <= half) {
                        if (children[i].keys.length !== 0) {
                            this.tryMerge(i, tree._maxNodeSize);
                        }
                        else { // child is empty! delete it!
                            keys.splice(i, 1);
                            var removed = children.splice(i, 1);
                            check(removed[0].size() === 0, "emptiness cleanup");
                        }
                    }
                }
                if (children.length !== 0 && children[0].keys.length === 0)
                    check(false, "emptiness bug");
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
    /**
     * Move children from `rhs` into this.
     * `rhs` must be part of this tree, and be removed from it after this call
     * (otherwise isShared for its children could be incorrect).
     */
    BNodeInternal.prototype.mergeSibling = function (rhs, maxNodeSize) {
        // assert !this.isShared;
        var oldLength = this.keys.length;
        this.keys.push.apply(this.keys, rhs.keys);
        var rhsChildren = rhs.children;
        this.children.push.apply(this.children, rhsChildren);
        this._size += rhs.size();
        if (rhs.isShared && !this.isShared) {
            // All children of a shared node are implicitly shared, and since their new
            // parent is not shared, they must now be explicitly marked as shared.
            for (var i = 0; i < rhsChildren.length; i++)
                rhsChildren[i].isShared = true;
        }
        // If our children are themselves almost empty due to a mass-delete,
        // they may need to be merged too (but only the oldLength-1 and its
        // right sibling should need this).
        this.tryMerge(oldLength - 1, maxNodeSize);
    };
    return BNodeInternal;
}(BNode));
/**
 * Determines whether two nodes are overlapping in key range.
 * Takes the leftmost known key of each node to avoid a log(n) min calculation.
 * This will still catch overlapping nodes because of the alternate hopping walk of the cursors.
 */
function areOverlapping(aMin, aMax, bMin, bMax, cmp) {
    // There are 4 possibilities:
    // 1. aMin.........aMax
    //            bMin.........bMax
    // (aMax between bMin and bMax)
    // 2.            aMin.........aMax
    //      bMin.........bMax
    // (aMin between bMin and bMax)
    // 3. aMin.............aMax
    //         bMin....bMax
    // (aMin and aMax enclose bMin and bMax; note this includes equality cases)
    // 4.      aMin....aMax
    //     bMin.............bMax
    // (bMin and bMax enclose aMin and aMax; note equality cases are identical to case 3)
    var aMinBMin = cmp(aMin, bMin);
    var aMinBMax = cmp(aMin, bMax);
    if (aMinBMin >= 0 && aMinBMax <= 0) {
        // case 2 or 4
        return true;
    }
    var aMaxBMin = cmp(aMax, bMin);
    var aMaxBMax = cmp(aMax, bMax);
    if (aMaxBMin >= 0 && aMaxBMax <= 0) {
        // case 1
        return true;
    }
    // case 3 or no overlap
    return aMinBMin <= 0 && aMaxBMax >= 0;
}
// Optimization: this array of `undefined`s is used instead of a normal
// array of values in nodes where `undefined` is the only value.
// Its length is extended to max node size on first use; since it can
// be shared between trees with different maximums, its length can only
// increase, never decrease. Its type should be undefined[] but strangely
// TypeScript won't allow the comparison V[] === undefined[]. To prevent
// users from making this array too large, BTree has a maximum node size.
//
// FAQ: undefVals[i] is already undefined, so why increase the array size?
// Reading outside the bounds of an array is relatively slow because it
// has the side effect of scanning the prototype chain.
var undefVals = [];
function sumChildSizes(children) {
    var total = 0;
    for (var i = 0; i < children.length; i++)
        total += children[i].size();
    return total;
}
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
        args.unshift('B+ tree'); // at beginning of message
        throw new Error(args.join(' '));
    }
}
/** A BTree frozen in the empty state. */
exports.EmptyBTree = (function () { var t = new BTree(); t.freeze(); return t; })();
