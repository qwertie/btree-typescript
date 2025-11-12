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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BTreeEx = void 0;
var b_tree_1 = __importStar(require("../b+tree"));
var diffAgainst_1 = __importDefault(require("./diffAgainst"));
var forEachKeyInBoth_1 = __importDefault(require("./forEachKeyInBoth"));
var union_1 = __importDefault(require("./union"));
var bulkLoad_1 = require("./bulkLoad");
/**
 * An extended version of the `BTree` class that includes additional functionality
 * such as bulk loading, set operations, and diffing.
 * It is separated to keep the core BTree class small from a bundle size perspective.
 * Note: each additional functionality piece is available as a standalone function from the extended folder.
 * @extends BTree
 */
var BTreeEx = /** @class */ (function (_super) {
    __extends(BTreeEx, _super);
    function BTreeEx() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BTreeEx.bulkLoad = function (entries, maxNodeSize, compare) {
        var cmp = compare !== null && compare !== void 0 ? compare : b_tree_1.defaultComparator;
        var root = (0, bulkLoad_1.bulkLoadRoot)(entries, maxNodeSize, cmp);
        var tree = new BTreeEx(undefined, cmp, maxNodeSize);
        var target = tree;
        target._root = root;
        target._size = root.size();
        return tree;
    };
    BTreeEx.prototype.clone = function () {
        var source = this;
        source._root.isShared = true;
        var result = new BTreeEx(undefined, this._compare, this._maxNodeSize);
        var target = result;
        target._root = source._root;
        target._size = source._size;
        return result;
    };
    BTreeEx.prototype.greedyClone = function (force) {
        var source = this;
        var result = new BTreeEx(undefined, this._compare, this._maxNodeSize);
        var target = result;
        target._root = source._root.greedyClone(force);
        target._size = source._size;
        return result;
    };
    /**
     * Computes the differences between `this` and `other`.
     * For efficiency, the diff is returned via invocations of supplied handlers.
     * The computation is optimized for the case in which the two trees have large amounts of shared data
     * (obtained by calling the `clone` or `with` APIs) and will avoid any iteration of shared state.
     * The handlers can cause computation to early exit by returning `{ break: R }`.
     * Neither collection should be mutated during the comparison (inside your callbacks), as this method assumes they remain stable.
     * @param other The tree to compute a diff against.
     * @param onlyThis Callback invoked for all keys only present in `this`.
     * @param onlyOther Callback invoked for all keys only present in `other`.
     * @param different Callback invoked for all keys with differing values.
     */
    BTreeEx.prototype.diffAgainst = function (other, onlyThis, onlyOther, different) {
        return (0, diffAgainst_1.default)(this, other, onlyThis, onlyOther, different);
    };
    /**
     * Calls the supplied `callback` for each key/value pair shared by this tree and `other`.
     * The callback will be called in sorted key order.
     * Neither tree is modified.
     * @param other The other tree to compare with this one.
     * @param callback Called for keys that appear in both trees. It can cause iteration to early exit by returning `{ break: R }`.
     * @description Complexity is bounded by O(N + M) time.
     * However, time is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
     * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
     * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
     * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
     * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than calling `toArray`
     * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
     */
    BTreeEx.prototype.forEachKeyInBoth = function (other, callback) {
        return (0, forEachKeyInBoth_1.default)(this, other, callback);
    };
    /**
     * Efficiently unions this tree with `other`, reusing subtrees wherever possible.
     * Neither input tree is modified.
     * @param other The other tree to union with this one.
     * @param combineFn Called for keys that appear in both trees. Return the desired value, or
     *        `undefined` to omit the key from the result.
     * @returns A new BTree that contains the unioned key/value pairs.
     * @description Complexity is bounded by O(N + M) for both time and allocations.
     * However, it is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
     * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
     * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
     * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
     * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than cloning `this`
     * and inserting the contents of `other` into the clone.
     */
    BTreeEx.prototype.union = function (other, combineFn) {
        return (0, union_1.default)(this, other, combineFn);
    };
    return BTreeEx;
}(b_tree_1.default));
exports.BTreeEx = BTreeEx;
exports.default = BTreeEx;
