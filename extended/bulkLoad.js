"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flushToLeaves = exports.bulkLoad = void 0;
var b_tree_1 = require("../b+tree");
var decompose_1 = require("./decompose");
function bulkLoad(entries, maxNodeSize, compare) {
    var totalPairs = (0, decompose_1.alternatingCount)(entries);
    if (totalPairs > 1) {
        var cmp = compare !== null && compare !== void 0 ? compare : b_tree_1.defaultComparator;
        var previousKey = (0, decompose_1.alternatingGetFirst)(entries, 0);
        for (var i = 1; i < totalPairs; i++) {
            var key = (0, decompose_1.alternatingGetFirst)(entries, i);
            if (cmp(previousKey, key) >= 0)
                throw new Error("bulkLoad: entries must be sorted by key in strictly ascending order");
            previousKey = key;
        }
    }
    var leaves = [];
    flushToLeaves(entries, maxNodeSize, function (leaf) { return leaves.push(leaf); });
    var leafCount = leaves.length;
    if (leafCount === 0)
        return undefined;
    var currentLevel = leaves;
    while (true) {
        var nodeCount = currentLevel.length;
        if (nodeCount === 1)
            return currentLevel[0];
        if (nodeCount <= maxNodeSize) {
            return new b_tree_1.BNodeInternal(currentLevel, (0, b_tree_1.sumChildSizes)(currentLevel));
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
        while (lastNode.children.length < minSize) {
            lastNode.takeFromLeft(secondLastNode);
        }
        currentLevel = nextLevel;
    }
}
exports.bulkLoad = bulkLoad;
function flushToLeaves(alternatingList, maxNodeSize, onLeafCreation) {
    var totalPairs = (0, decompose_1.alternatingCount)(alternatingList);
    if (totalPairs === 0)
        return 0;
    // This method creates as many evenly filled leaves as possible from
    // the pending entries. All will be > 50% full if we are creating more than one leaf.
    var leafCount = Math.ceil(totalPairs / maxNodeSize);
    var remainingLeaves = leafCount;
    var remaining = totalPairs;
    var pairIndex = 0;
    while (remainingLeaves > 0) {
        var chunkSize = Math.ceil(remaining / remainingLeaves);
        var keys = new Array(chunkSize);
        var vals = new Array(chunkSize);
        for (var i = 0; i < chunkSize; i++) {
            keys[i] = (0, decompose_1.alternatingGetFirst)(alternatingList, pairIndex);
            vals[i] = (0, decompose_1.alternatingGetSecond)(alternatingList, pairIndex);
            pairIndex++;
        }
        remaining -= chunkSize;
        remainingLeaves--;
        var leaf = new b_tree_1.BNode(keys, vals);
        onLeafCreation(leaf);
    }
    alternatingList.length = 0;
    return leafCount;
}
exports.flushToLeaves = flushToLeaves;
;
