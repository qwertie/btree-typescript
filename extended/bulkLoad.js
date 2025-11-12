"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flushToLeaves = exports.bulkLoad = void 0;
var b_tree_1 = require("../b+tree");
var decompose_1 = require("./decompose");
function bulkLoad(entries, maxNodeSize) {
    var leaves = [];
    flushToLeaves(entries, maxNodeSize, leaves);
    var leafCount = (0, decompose_1.alternatingCount)(leaves);
    if (leafCount === 0)
        return undefined;
    if (leafCount === 1)
        return (0, decompose_1.alternatingGetFirst)(leaves, 0);
    throw new Error("bulkLoad: multiple leaves not yet supported");
}
exports.bulkLoad = bulkLoad;
function flushToLeaves(alternatingList, maxNodeSize, toFlushTo) {
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
        (0, decompose_1.alternatingPush)(toFlushTo, 0, leaf);
    }
    alternatingList.length = 0;
    return leafCount;
}
exports.flushToLeaves = flushToLeaves;
;
