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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BTreeEx = void 0;
var b_tree_1 = __importDefault(require("./b+tree"));
var diffAgainst_1 = require("./diffAgainst");
var getInternals = function (tree) {
    return tree;
};
var wrapBaseTree = function (tree) {
    var source = getInternals(tree);
    var wrapped = new BTreeEx(undefined, source._compare, source._maxNodeSize);
    var target = getInternals(wrapped);
    target._root = source._root;
    target._size = source._size;
    return wrapped;
};
var ensureExtendedTree = function (tree) {
    return tree instanceof BTreeEx ? tree : wrapBaseTree(tree);
};
var BTreeEx = /** @class */ (function (_super) {
    __extends(BTreeEx, _super);
    function BTreeEx() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BTreeEx.prototype.clone = function () {
        return wrapBaseTree(_super.prototype.clone.call(this));
    };
    BTreeEx.prototype.greedyClone = function (force) {
        return wrapBaseTree(_super.prototype.greedyClone.call(this, force));
    };
    BTreeEx.prototype.with = function (key, value, overwrite) {
        var result = _super.prototype.with.call(this, key, value, overwrite);
        return result === this
            ? this
            : ensureExtendedTree(result);
    };
    BTreeEx.prototype.withPairs = function (pairs, overwrite) {
        var result = _super.prototype.withPairs.call(this, pairs, overwrite);
        return result === this ? this : ensureExtendedTree(result);
    };
    BTreeEx.prototype.withKeys = function (keys, returnThisIfUnchanged) {
        var result = _super.prototype.withKeys.call(this, keys, returnThisIfUnchanged);
        return result === this ? this : ensureExtendedTree(result);
    };
    BTreeEx.prototype.without = function (key, returnThisIfUnchanged) {
        var result = _super.prototype.without.call(this, key, returnThisIfUnchanged);
        return result === this ? this : ensureExtendedTree(result);
    };
    BTreeEx.prototype.withoutKeys = function (keys, returnThisIfUnchanged) {
        var result = _super.prototype.withoutKeys.call(this, keys, returnThisIfUnchanged);
        return result === this ? this : ensureExtendedTree(result);
    };
    BTreeEx.prototype.withoutRange = function (low, high, includeHigh, returnThisIfUnchanged) {
        var result = _super.prototype.withoutRange.call(this, low, high, includeHigh, returnThisIfUnchanged);
        return result === this ? this : ensureExtendedTree(result);
    };
    BTreeEx.prototype.filter = function (callback, returnThisIfUnchanged) {
        var result = _super.prototype.filter.call(this, callback, returnThisIfUnchanged);
        return result === this ? this : ensureExtendedTree(result);
    };
    BTreeEx.prototype.mapValues = function (callback) {
        var result = _super.prototype.mapValues.call(this, callback);
        return ensureExtendedTree(result);
    };
    BTreeEx.prototype.diffAgainst = function (other, onlyThis, onlyOther, different) {
        return (0, diffAgainst_1.diffAgainst)(this, other, onlyThis, onlyOther, different);
    };
    return BTreeEx;
}(b_tree_1.default));
exports.BTreeEx = BTreeEx;
exports.default = BTreeEx;
