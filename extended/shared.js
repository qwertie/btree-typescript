"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alternatingPush = exports.alternatingGetSecond = exports.alternatingGetFirst = exports.alternatingCount = exports.flushToLeaves = void 0;
var b_tree_1 = require("../b+tree");
/**
 * Flushes entries from an alternating list into leaf nodes.
 * The leaf nodes are packed as tightly as possible while ensuring all
 * nodes are at least 50% full (if more than one leaf is created).
 * @internal
 */
function flushToLeaves(alternatingList, maxNodeSize, onLeafCreation) {
    var totalPairs = alternatingCount(alternatingList);
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
            keys[i] = alternatingGetFirst(alternatingList, pairIndex);
            vals[i] = alternatingGetSecond(alternatingList, pairIndex);
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
// ------- Alternating list helpers -------
// These helpers manage a list that alternates between two types of entries.
// Storing data this way avoids small tuple allocations and shows major improvements
// in GC time in benchmarks.
function alternatingCount(list) {
    return list.length >> 1;
}
exports.alternatingCount = alternatingCount;
function alternatingGetFirst(list, index) {
    return list[index << 1];
}
exports.alternatingGetFirst = alternatingGetFirst;
function alternatingGetSecond(list, index) {
    return list[(index << 1) + 1];
}
exports.alternatingGetSecond = alternatingGetSecond;
function alternatingPush(list, first, second) {
    // Micro benchmarks show this is the fastest way to do this
    list.push(first, second);
}
exports.alternatingPush = alternatingPush;
