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
var b_tree_1 = __importDefault(require("../b+tree"));
var diffAgainst_1 = require("./diffAgainst");
var BTreeEx = /** @class */ (function (_super) {
    __extends(BTreeEx, _super);
    function BTreeEx() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
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
    BTreeEx.prototype.with = function (key, value, overwrite) {
        return _super.prototype.with.call(this, key, value, overwrite);
    };
    BTreeEx.prototype.withPairs = function (pairs, overwrite) {
        return _super.prototype.withPairs.call(this, pairs, overwrite);
    };
    BTreeEx.prototype.withKeys = function (keys, returnThisIfUnchanged) {
        return _super.prototype.withKeys.call(this, keys, returnThisIfUnchanged);
    };
    BTreeEx.prototype.mapValues = function (callback) {
        return _super.prototype.mapValues.call(this, callback);
    };
    BTreeEx.prototype.diffAgainst = function (other, onlyThis, onlyOther, different) {
        return (0, diffAgainst_1.diffAgainst)(this, other, onlyThis, onlyOther, different);
    };
    return BTreeEx;
}(b_tree_1.default));
exports.BTreeEx = BTreeEx;
exports.default = BTreeEx;
