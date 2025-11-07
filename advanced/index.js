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
exports.AdvancedBTree = void 0;
var index_1 = __importDefault(require("../core/index"));
var algorithms_1 = require("../algorithms");
var getInternals = function (tree) {
    return tree;
};
var wrapBaseTree = function (tree) {
    var source = getInternals(tree);
    var wrapped = new AdvancedBTree(undefined, source._compare, source._maxNodeSize);
    var target = getInternals(wrapped);
    target._root = source._root;
    target._size = source._size;
    return wrapped;
};
var AdvancedBTree = /** @class */ (function (_super) {
    __extends(AdvancedBTree, _super);
    function AdvancedBTree() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AdvancedBTree.prototype.clone = function () {
        return wrapBaseTree(_super.prototype.clone.call(this));
    };
    AdvancedBTree.prototype.greedyClone = function (force) {
        return wrapBaseTree(_super.prototype.greedyClone.call(this, force));
    };
    AdvancedBTree.prototype.diffAgainst = function (other, onlyThis, onlyOther, different) {
        return (0, algorithms_1.diffAgainst)(this, other, onlyThis, onlyOther, different);
    };
    return AdvancedBTree;
}(index_1.default));
exports.AdvancedBTree = AdvancedBTree;
exports.default = AdvancedBTree;
