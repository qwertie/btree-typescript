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
    /**
     * Bulk loads a new `BTreeEx` from a sorted alternating list of entries.
     * This reuses the same algorithm as `extended/bulkLoad`, but produces a `BTreeEx`.
     * Time and space complexity are O(n).
     * @param entries Alternating array of keys and values: `[key0, value0, key1, value1, ...]`. Must be sorted by key in strictly ascending order.
     * @param maxNodeSize The branching factor (maximum number of children per node).
     * @param compare Comparator to use. Defaults to the standard comparator if omitted.
     * @returns A fully built tree containing the supplied entries.
     * @throws Error if the entries are not strictly sorted or contain duplicate keys.
     */
    BTreeEx.bulkLoad = function (entries, maxNodeSize, compare) {
        var cmp = compare !== null && compare !== void 0 ? compare : b_tree_1.defaultComparator;
        var root = (0, bulkLoad_1.bulkLoadRoot)(entries, maxNodeSize, cmp);
        var tree = new BTreeEx(undefined, cmp, maxNodeSize);
        var target = tree;
        target._root = root;
        target._size = root.size();
        return tree;
    };
    /**
     * Quickly clones the tree while preserving the `BTreeEx` prototype.
     * The clone shares structure (copy-on-write) until either instance is mutated.
     */
    BTreeEx.prototype.clone = function () {
        var source = this;
        source._root.isShared = true;
        var result = new BTreeEx(undefined, this._compare, this._maxNodeSize);
        var target = result;
        target._root = source._root;
        target._size = source._size;
        return result;
    };
    /**
     * Performs a greedy clone that eagerly duplicates non-shared nodes to avoid marking the original tree as shared.
     * @param force When true, clones even the nodes that are already marked as shared.
     */
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
     * @returns The first `break` payload returned by a handler, or `undefined` if no handler breaks.
     * @throws Error if the supplied trees were created with different comparators.
     */
    BTreeEx.prototype.diffAgainst = function (other, onlyThis, onlyOther, different) {
        return (0, diffAgainst_1.default)(this, other, onlyThis, onlyOther, different);
    };
    /**
     * Calls the supplied `callback` for each key/value pair shared by this tree and `other`, in sorted key order.
     * Neither tree is modified.
     *
     * Complexity is O(N + M) when the trees overlap heavily, and additionally bounded by O(log(N + M) * D)
     * where `D` is the number of disjoint key ranges between the trees, because disjoint subtrees are skipped.
     * In practice, that means for keys of random distribution the performance is linear and for keys with significant
     * numbers of non-overlapping key ranges it is much faster.
     * @param other The other tree to compare with this one.
     * @param callback Called for keys that appear in both trees. It can cause iteration to early exit by returning `{ break: R }`.
     * @returns The first `break` payload returned by the callback, or `undefined` if the walk finishes.
     * @throws Error if the two trees were created with different comparators.
     */
    BTreeEx.prototype.forEachKeyInBoth = function (other, callback) {
        return (0, forEachKeyInBoth_1.default)(this, other, callback);
    };
    /**
     * Efficiently unions this tree with `other`, reusing subtrees wherever possible without modifying either input.
     *
     * Complexity is O(N + M) in the fully overlapping case, and additionally bounded by O(log(N + M) * D)
     * where `D` is the number of disjoint key ranges, because disjoint subtrees are skipped entirely.
     * In practice, that means for keys of random distribution the performance is linear and for keys with significant
     * numbers of non-overlapping key ranges it is much faster.
     * @param other The other tree to union with this one.
     * @param combineFn Called for keys that appear in both trees. Return the desired value, or `undefined` to omit the key.
     * @returns A new `BTreeEx` that contains the unioned key/value pairs.
     * @throws Error if the trees were created with different comparators or max node sizes.
     */
    BTreeEx.prototype.union = function (other, combineFn) {
        return (0, union_1.default)(this, other, combineFn);
    };
    return BTreeEx;
}(b_tree_1.default));
exports.BTreeEx = BTreeEx;
exports.default = BTreeEx;
