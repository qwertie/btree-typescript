"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkLoadRoot = exports.bulkLoad = void 0;
var b_tree_1 = __importStar(require("../b+tree"));
var shared_1 = require("./shared");
/**
 * Loads a B-Tree from a sorted list of entries in bulk. This is faster than inserting
 * entries one at a time, and produces a more optimally balanced tree.
 * Time and space complexity: O(n).
 * @param entries The list of key/value pairs to load. Must be sorted by key in strictly ascending order.
 * @param maxNodeSize The branching factor (maximum node size) for the resulting tree.
 * @param compare Function to compare keys.
 * @returns A new BTree containing the given entries.
 */
function bulkLoad(entries, maxNodeSize, compare) {
    var root = bulkLoadRoot(entries, maxNodeSize, compare);
    var tree = new b_tree_1.default(undefined, compare, maxNodeSize);
    var target = tree;
    target._root = root;
    target._size = root.size();
    return tree;
}
exports.bulkLoad = bulkLoad;
/**
 * Bulk loads, returns the root node of the resulting tree.
 * @internal
 */
function bulkLoadRoot(entries, maxNodeSize, compare) {
    var totalPairs = (0, shared_1.alternatingCount)(entries);
    if (totalPairs > 1) {
        var previousKey = (0, shared_1.alternatingGetFirst)(entries, 0);
        for (var i = 1; i < totalPairs; i++) {
            var key = (0, shared_1.alternatingGetFirst)(entries, i);
            if (compare(previousKey, key) >= 0)
                throw new Error("bulkLoad: entries must be sorted by key in strictly ascending order");
            previousKey = key;
        }
    }
    var leaves = [];
    (0, shared_1.flushToLeaves)(entries, maxNodeSize, function (leaf) { return leaves.push(leaf); });
    if (leaves.length === 0)
        return new b_tree_1.BNode();
    var currentLevel = leaves;
    while (currentLevel.length > 1) {
        var nodeCount = currentLevel.length;
        if (nodeCount <= maxNodeSize) {
            currentLevel = [new b_tree_1.BNodeInternal(currentLevel, (0, b_tree_1.sumChildSizes)(currentLevel))];
            break;
        }
        var nextLevelCount = Math.ceil(nodeCount / maxNodeSize);
        (0, b_tree_1.check)(nextLevelCount > 1);
        var nextLevel = new Array(nextLevelCount);
        var remainingNodes = nodeCount;
        var remainingParents = nextLevelCount;
        var childIndex = 0;
        for (var i = 0; i < nextLevelCount; i++) {
            var chunkSize = Math.ceil(remainingNodes / remainingParents);
            var children = new Array(chunkSize);
            var size = 0;
            for (var j = 0; j < chunkSize; j++) {
                var child = currentLevel[childIndex++];
                children[j] = child;
                size += child.size();
            }
            remainingNodes -= chunkSize;
            remainingParents--;
            nextLevel[i] = new b_tree_1.BNodeInternal(children, size);
        }
        var minSize = Math.floor(maxNodeSize / 2);
        var secondLastNode = nextLevel[nextLevelCount - 2];
        var lastNode = nextLevel[nextLevelCount - 1];
        while (lastNode.children.length < minSize)
            lastNode.takeFromLeft(secondLastNode);
        currentLevel = nextLevel;
    }
    return currentLevel[0];
}
exports.bulkLoadRoot = bulkLoadRoot;
