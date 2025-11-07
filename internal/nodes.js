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
exports.EmptyLeaf = exports.BNodeInternal = exports.BNode = void 0;
var assert_1 = require("./assert");
var undefVals = [];
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
        (0, assert_1.check)(this.values === undefVals ? kL <= vL : kL === vL, "keys/values length mismatch: depth", depth, "with lengths", kL, vL, "and baseIndex", baseIndex);
        // Note: we don't check for "node too small" because sometimes a node
        // can legitimately have size 1. This occurs if there is a batch 
        // deletion, leaving a node of size 1, and the siblings are full so
        // it can't be merged with adjacent nodes. However, the parent will
        // verify that the average node size is at least half of the maximum.
        (0, assert_1.check)(depth == 0 || kL > 0, "empty leaf at depth", depth, "and baseIndex", baseIndex);
        return kL;
    };
    /////////////////////////////////////////////////////////////////////////////
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
exports.BNode = BNode;
/** Internal node (non-leaf node) ********************************************/
var BNodeInternal = /** @class */ (function (_super) {
    __extends(BNodeInternal, _super);
    /**
     * This does not mark `children` as shared, so it is the responsibility of the caller
     * to ensure children are either marked shared, or aren't included in another tree.
     */
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
        (0, assert_1.check)(kL === cL, "keys/children length mismatch: depth", depth, "lengths", kL, cL, "baseIndex", baseIndex);
        (0, assert_1.check)(kL > 1 || depth > 0, "internal node has length", kL, "at depth", depth, "baseIndex", baseIndex);
        var size = 0, c = this.children, k = this.keys, childSize = 0;
        for (var i = 0; i < cL; i++) {
            size += c[i].checkValid(depth + 1, tree, baseIndex + size);
            childSize += c[i].keys.length;
            (0, assert_1.check)(size >= childSize, "wtf", baseIndex); // no way this will ever fail
            (0, assert_1.check)(i === 0 || c[i - 1].constructor === c[i].constructor, "type mismatch, baseIndex:", baseIndex);
            if (c[i].maxKey() != k[i])
                (0, assert_1.check)(false, "keys[", i, "] =", k[i], "is wrong, should be ", c[i].maxKey(), "at depth", depth, "baseIndex", baseIndex);
            if (!(i === 0 || tree._compare(k[i - 1], k[i]) < 0))
                (0, assert_1.check)(false, "sort violation at depth", depth, "index", i, "keys", k[i - 1], k[i]);
        }
        // 2020/08: BTree doesn't always avoid grossly undersized nodes,
        // but AFAIK such nodes are pretty harmless, so accept them.
        var toofew = childSize === 0; // childSize < (tree.maxNodeSize >> 1)*cL;
        if (toofew || childSize > tree.maxNodeSize * cL)
            (0, assert_1.check)(false, toofew ? "too few" : "too many", "children (", childSize, size, ") at depth", depth, "maxNodeSize:", tree.maxNodeSize, "children.length:", cL, "baseIndex:", baseIndex);
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
    /**
     * Inserts `child` at index `i`.
     * This does not mark `child` as shared, so it is the responsibility of the caller
     * to ensure that either child is marked shared, or it is not included in another tree.
     */
    BNodeInternal.prototype.insert = function (i, child) {
        this.children.splice(i, 0, child);
        this.keys.splice(i, 0, child.maxKey());
    };
    /**
     * Split this node.
     * Modifies this to remove the second half of the items, returning a separate node containing them.
     */
    BNodeInternal.prototype.splitOffRightSide = function () {
        // assert !this.isShared;
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
                    if (children[i].isShared)
                        children[i] = children[i].clone();
                    var result = children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound);
                    // Note: if children[i] is empty then keys[i]=undefined.
                    //       This is an invalid state, but it is fixed below.
                    keys[i] = children[i].maxKey();
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
                    if (children[i].keys.length <= half) {
                        if (children[i].keys.length !== 0) {
                            this.tryMerge(i, tree._maxNodeSize);
                        }
                        else { // child is empty! delete it!
                            keys.splice(i, 1);
                            children.splice(i, 1);
                        }
                    }
                }
                if (children.length !== 0 && children[0].keys.length === 0)
                    (0, assert_1.check)(false, "emptiness bug");
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
exports.BNodeInternal = BNodeInternal;
exports.EmptyLeaf = (function () {
    var n = new BNode();
    n.isShared = true;
    return n;
})();
