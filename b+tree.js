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
     * @description Complexity: O(N + M), but often much faster in practice due to skipping any non-intersecting subtrees.
     */
    BTree.prototype.intersect = function (other, intersection) {
        var cmp = this._compare;
        // Ensure both trees share the same comparator reference
        if (cmp !== other._compare)
            throw new Error("Cannot merge BTrees with different comparators.");
        if (this._maxNodeSize !== other._maxNodeSize)
            throw new Error("Cannot merge BTrees with different max node sizes.");
        if (other.size === 0 || this.size === 0)
            return;
        // Cursor payload factory
        var mkPayload = function (_) { return undefined; };
        // Callbacks
        var empty = function () { };
        // Initialize cursors at minimum keys.
        var curA = BTree.createCursor(this, mkPayload, empty, empty, empty, empty, empty);
        var curB = BTree.createCursor(other, mkPayload, empty, empty, empty, empty, empty);
        // Walk both cursors
        while (true) {
            var order = cmp(BTree.getKey(curA), BTree.getKey(curB));
            var trailing = curA, leading = curB;
            if (order > 0) {
                trailing = curB;
                leading = curA;
            }
            var areEqual = order === 0;
            if (areEqual) {
                var key = BTree.getKey(leading);
                var vA = curA.leaf.values[curA.leafIndex];
                var vB = curB.leaf.values[curB.leafIndex];
                intersection(key, vA, vB);
                var outT = BTree.moveTo(trailing, leading, key, false, cmp);
                var outL = BTree.moveTo(leading, trailing, key, false, cmp);
                if (outT && outL)
                    break;
            }
            else {
                var out = BTree.moveTo(trailing, leading, BTree.getKey(leading), true, cmp);
                if (out) {
                    // We've reached the end of one tree, so intersections are guaranteed to be done.
                    break;
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
     * @description Complexity: O(N + M), but often much faster in practice due to skipping any non-intersecting subtrees.
     */
    BTree.prototype.merge = function (other, merge) {
        // Fast paths for empty trees
        var sizeThis = this._root.size();
        var sizeOther = other._root.size();
        if (sizeThis === 0)
            return other.clone();
        if (sizeOther === 0)
            return this.clone();
        // Ensure both trees share the same comparator reference
        if (this._compare !== other._compare)
            throw new Error("Cannot merge BTrees with different comparators.");
        if (this._maxNodeSize !== other._maxNodeSize)
            throw new Error("Cannot merge BTrees with different max node sizes.");
        var _a = BTree.decompose(this, other, merge), disjoint = _a.disjoint, tallestHeight = _a.tallestHeight, tallestIndex = _a.tallestIndex;
        throw new Error("Not yet implemented: BTree.merge");
    };
    /**
     * Decomposes two BTrees into disjoint nodes. Reuses interior nodes when they do not overlap/intersect with any leaf nodes
     * in the other tree. Overlapping leaf nodes are broken down into new leaf nodes containing merged entries.
     */
    BTree.decompose = function (left, right, mergeValues) {
        var cmp = left._compare;
        check(left._compare === right._compare, "merge: trees must share comparator");
        check(left._maxNodeSize === right._maxNodeSize, "merge: trees must share max node size");
        check(left._root.size() > 0 && right._root.size() > 0, "decompose requires non-empty inputs");
        var disjoint = [];
        var pending = [];
        var tallestIndex = -1, tallestHeight = -1;
        var flushPendingEntries = function () {
            // Flush pending overlapped entries into new leaves
            if (pending.length > 0) {
                var max = left._maxNodeSize;
                var total = pending.length;
                var remaining = total;
                var leafCount = Math.ceil(total / max);
                var offset = 0;
                while (leafCount > 0) {
                    var newLeafSize = Math.ceil(remaining / leafCount);
                    var slice = pending.slice(offset, offset + newLeafSize);
                    offset += newLeafSize;
                    remaining -= newLeafSize;
                    var keys = slice.map(function (p) { return p[0]; });
                    var vals = slice.map(function (p) { return p[1]; });
                    var leaf = new BNode(keys, vals);
                    disjoint.push([0, leaf]);
                    if (0 > tallestHeight) {
                        tallestIndex = disjoint.length - 1;
                        tallestHeight = 0;
                    }
                    leafCount--;
                }
                pending.length = 0;
            }
        };
        var addSharedNodeToDisjointSet = function (node, height) {
            flushPendingEntries();
            node.isShared = true;
            disjoint.push([height, node]);
            if (height > tallestHeight) {
                tallestIndex = disjoint.length - 1;
                tallestHeight = height;
            }
        };
        // Have to do this as cast to convince TS it's ever assigned
        var highestDisjoint = undefined;
        // Cursor payload factory
        var mkPayload = function (_) { return ({ disqualified: false }); };
        var pushLeafRange = function (leaf, from, toExclusive) {
            if (from < toExclusive) {
                for (var i = from; i < toExclusive; ++i)
                    pending.push([leaf.keys[i], leaf.values[i]]);
            }
        };
        // Callbacks
        var onEnterLeaf = function (leaf, payload, destIndex, other) {
            var otherLeaf = BTree.getLeaf(other);
            if (BTree.areOverlapping(leaf, otherLeaf, cmp)) {
                payload.disqualified = true;
                other.leafPayload.disqualified = true;
                pushLeafRange(leaf, 0, Math.min(destIndex, leaf.keys.length));
            }
            else {
                check(destIndex === 0, "onEnterLeaf: destIndex must be 0 if not overlapping");
            }
        };
        var onMoveInLeaf = function (leaf, payload, fromIndex, toIndex, isInclusive, _other) {
            check(payload.disqualified === true, "onMoveInLeaf: leaf must be disqualified");
            var start = isInclusive ? fromIndex : fromIndex + 1;
            pushLeafRange(leaf, start, Math.min(toIndex, leaf.keys.length));
        };
        var onExitLeaf = function (leaf, startingIndex, isInclusive, payload, _other) {
            highestDisjoint = undefined;
            if (!payload.disqualified) {
                highestDisjoint = { node: leaf, height: 0 };
            }
            else {
                var start = isInclusive ? startingIndex : startingIndex + 1;
                pushLeafRange(leaf, start, leaf.keys.length);
            }
        };
        var onStepUp = function (parent, height, payload, fromIndex, stepDownIndex, _other) {
            if (Number.isNaN(stepDownIndex)) {
                if (!payload.disqualified) {
                    highestDisjoint = { node: parent, height: height };
                }
                else {
                    for (var i = fromIndex + 1; i < parent.children.length; ++i)
                        addSharedNodeToDisjointSet(parent.children[i], height - 1);
                }
            }
            else if (stepDownIndex === Infinity) {
                if (!payload.disqualified) {
                    check(fromIndex === 0, "onStepUp: Infinity case requires fromIndex==0");
                    highestDisjoint = { node: parent, height: height };
                }
                else {
                    for (var i = fromIndex + 1; i < parent.children.length; ++i)
                        addSharedNodeToDisjointSet(parent.children[i], height - 1);
                }
            }
            else {
                for (var i = fromIndex + 1; i < stepDownIndex; ++i)
                    addSharedNodeToDisjointSet(parent.children[i], height - 1);
            }
        };
        var onStepDown = function (node, height, payload, stepDownIndex, other) {
            var otherLeaf = BTree.getLeaf(other);
            if (BTree.areOverlapping(node, otherLeaf, cmp)) {
                payload.disqualified = true;
                // leaf disqualification is handled in onEnterLeaf
            }
            for (var i = 0; i < stepDownIndex; ++i)
                addSharedNodeToDisjointSet(node.children[i], height - 1);
        };
        var curA = BTree.createCursor(left, mkPayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown);
        var curB = BTree.createCursor(right, mkPayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown);
        // Initialize disqualification w.r.t. opposite leaf.
        var initDisqualify = function (cur, otherLeaf) {
            if (BTree.areOverlapping(cur.leaf, otherLeaf, cmp))
                cur.leafPayload.disqualified = true;
            for (var i = 0; i < cur.spine.length; ++i) {
                var entry = cur.spine[i];
                if (BTree.areOverlapping(entry.node, otherLeaf, cmp))
                    entry.payload.disqualified = true;
            }
        };
        initDisqualify(curA, BTree.getLeaf(curB));
        initDisqualify(curB, BTree.getLeaf(curA));
        // Walk both cursors
        while (true) {
            var order = cmp(BTree.getKey(curA), BTree.getKey(curB));
            var trailing = curA, leading = curB;
            if (order > 0) {
                trailing = curB;
                leading = curA;
            }
            var areEqual = order === 0;
            if (areEqual) {
                var key = BTree.getKey(leading);
                var vA = curA.leaf.values[curA.leafIndex];
                var vB = curB.leaf.values[curB.leafIndex];
                var merged = mergeValues(key, vA, vB);
                if (merged !== undefined)
                    pending.push([key, merged]);
                var outT = BTree.moveTo(trailing, leading, key, false, cmp);
                var outL = BTree.moveTo(leading, trailing, key, false, cmp);
                if (outT && outL)
                    break;
            }
            else {
                var out = BTree.moveTo(trailing, leading, BTree.getKey(leading), true, cmp);
                if (highestDisjoint !== undefined) {
                    addSharedNodeToDisjointSet(highestDisjoint.node, highestDisjoint.height);
                    highestDisjoint = undefined;
                }
                if (out) {
                    var maxKeyLeft = left._root.maxKey();
                    var maxKeyRight = right._root.maxKey();
                    var maxKey = cmp(maxKeyLeft, maxKeyRight) >= 0 ? maxKeyLeft : maxKeyRight;
                    BTree.moveTo(leading, trailing, maxKey, false, cmp);
                    break;
                }
            }
        }
        flushPendingEntries();
        return { disjoint: disjoint, tallestIndex: tallestIndex, tallestHeight: tallestHeight };
    };
    /**
     * Move cursor strictly forward to the first key >= (inclusive) or > (exclusive) target.
     * Returns true if end-of-tree was reached (cursor not structurally mutated).
     */
    BTree.moveTo = function (cur, other, targetKey, isInclusive, cmp) {
        // We should start before the target (or at it if inclusive)
        var keyPos = cmp(BTree.getKey(cur), targetKey);
        check(isInclusive && keyPos < 0 || !isInclusive && keyPos <= 0, "moveTo precondition violated");
        // Fast path: destination within current leaf
        var leaf = cur.leaf;
        {
            var i = leaf.indexOf(targetKey, -1, cmp);
            var destInLeaf = i < 0 ? ~i : (isInclusive ? i : i + 1);
            if (destInLeaf < leaf.keys.length) {
                cur.onMoveInLeaf(leaf, cur.leafPayload, cur.leafIndex, destInLeaf, isInclusive, other);
                cur.leafIndex = destInLeaf;
                return false;
            }
        }
        // Find first ancestor with a viable right step
        var spine = cur.spine;
        var descentLevel = -1;
        var descentIndex = -1;
        for (var s = spine.length - 1; s >= 0; --s) {
            var parent = spine[s].node;
            var fromIndex = spine[s].childIndex;
            var j = parent.indexOf(targetKey, 0, cmp); // insertion index or exact
            var stepDownIndex = j + (isInclusive ? 0 : (j < parent.keys.length && cmp(parent.keys[j], targetKey) === 0 ? 1 : 0));
            // Note: when key not found, indexOf with failXor=0 already returns insertion index
            if (stepDownIndex > fromIndex && stepDownIndex <= parent.keys.length - 1) {
                descentLevel = s;
                descentIndex = stepDownIndex;
                break;
            }
        }
        // Heights for callbacks: height = distance to leaf. Parent-of-leaf height = 1.
        var heightOf = function (sIndex) { return spine.length - sIndex; };
        // Exit leaf; we did walk out of it conceptually
        var startIndex = cur.leafIndex;
        cur.onExitLeaf(leaf, startIndex, isInclusive, cur.leafPayload, other);
        // Clear leaf payload after exit as specified
        // @ts-ignore
        cur.leafPayload = undefined;
        if (descentLevel < 0) {
            // No descent point; step up all the way; last callback gets Infinity
            for (var s = spine.length - 1; s >= 0; --s) {
                var entry = spine[s];
                var sd = s === 0 ? Infinity : NaN;
                cur.onStepUp(entry.node, heightOf(s), entry.payload, entry.childIndex, sd, other);
            }
            return true;
        }
        // Step up through ancestors above the descentLevel
        for (var s = spine.length - 1; s > descentLevel; --s) {
            var entry = spine[s];
            cur.onStepUp(entry.node, heightOf(s), entry.payload, entry.childIndex, NaN, other);
        }
        {
            var entry = spine[descentLevel];
            cur.onStepUp(entry.node, heightOf(descentLevel), entry.payload, entry.childIndex, descentIndex, other);
            entry.childIndex = descentIndex;
        }
        // Descend, invoking onStepDown and creating payloads
        spine.length = descentLevel + 1;
        var node = spine[descentLevel].node.children[descentIndex];
        var height = heightOf(descentLevel) - 1;
        while (!node.isLeaf) {
            var ni = node;
            var j = ni.indexOf(targetKey, 0, cmp);
            var stepDownIndex = j + (isInclusive ? 0 : (j < ni.keys.length && cmp(ni.keys[j], targetKey) === 0 ? 1 : 0));
            var payload = cur.mkPayload(ni);
            spine.push({ node: ni, childIndex: stepDownIndex, payload: payload });
            cur.onStepDown(ni, height, payload, stepDownIndex, other);
            node = ni.children[stepDownIndex];
            height -= 1;
        }
        // Enter destination leaf
        var newLeaf = node;
        var leafPayload = cur.mkPayload(newLeaf);
        var idx = newLeaf.indexOf(targetKey, -1, cmp);
        var destIndex = idx < 0 ? ~idx : (isInclusive ? idx : idx + 1);
        check(destIndex >= 0 && destIndex < newLeaf.keys.length, "moveTo: destination out of bounds");
        cur.onEnterLeaf(newLeaf, leafPayload, destIndex, other);
        cur.leaf = newLeaf;
        cur.leafPayload = leafPayload;
        cur.leafIndex = destIndex;
        return false;
    };
    /** Create a cursor at the leftmost key. */
    BTree.createCursor = function (tree, mkPayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown) {
        check(tree._root.size() > 0, "createCursor: cannot create a cursor for an empty tree");
        var spine = [];
        var n = tree._root;
        while (!n.isLeaf) {
            var ni = n;
            var payload = mkPayload(ni);
            spine.push({ node: ni, childIndex: 0, payload: payload });
            n = ni.children[0];
        }
        var leaf = n;
        var leafPayload = mkPayload(leaf);
        var cur = {
            tree: tree,
            leaf: leaf,
            leafIndex: 0,
            spine: spine,
            leafPayload: leafPayload,
            mkPayload: mkPayload,
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
    BTree.getLeaf = function (c) {
        return c.leaf;
    };
    BTree.areOverlapping = function (a, b, cmp) {
        var amin = a.minKey(), amax = a.maxKey();
        var bmin = b.minKey(), bmax = b.maxKey();
        // Overlap iff !(amax < bmin || bmax < amin) on inclusive ranges.
        return !(cmp(amax, bmin) < 0 || cmp(bmax, amin) < 0);
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
        var size = this._root.checkValid(0, this, 0);
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
        return kL;
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
        for (var i = 0; i < cL; i++) {
            var child = c[i];
            var subtreeSize = child.checkValid(depth + 1, tree, baseIndex + size);
            check(subtreeSize === child.size(), "cached size mismatch at depth", depth, "index", i, "baseIndex", baseIndex);
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
        return size;
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
        var movedSize = sumChildSizes(newChildren);
        var newNode = new BNodeInternal(newChildren, movedSize, newKeys);
        this._size -= movedSize;
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
