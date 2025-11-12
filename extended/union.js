"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var decompose_1 = require("./decompose");
var parallelWalk_1 = require("./parallelWalk");
/**
 * Efficiently unions two trees, reusing subtrees wherever possible.
 * Neither input tree is modified.
 * @param treeA First tree to union.
 * @param treeB Second tree to union.
 * @param combineFn Called for keys that appear in both trees. Return the desired value, or
 *        `undefined` to omit the key from the result.
 * @returns A new BTree that contains the unioned key/value pairs.
 * @description Complexity is bounded O(N + M) for both time and allocations.
 * However, it is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
 * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
 * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than cloning `this`
 * and inserting the contents of `other` into the clone.
 */
function union(treeA, treeB, combineFn) {
    var _treeA = treeA;
    var _treeB = treeB;
    var branchingFactor = (0, parallelWalk_1.checkCanDoSetOperation)(_treeA, _treeB);
    if (_treeA._root.size() === 0)
        return treeB.clone();
    if (_treeB._root.size() === 0)
        return treeA.clone();
    // Decompose both trees into disjoint subtrees leaves.
    // As many of these as possible will be reused from the original trees, and the remaining
    // will be leaves that are the result of merging intersecting leaves.
    var decomposed = (0, decompose_1.decompose)(_treeA, _treeB, combineFn);
    var constructor = treeA.constructor;
    return (0, decompose_1.buildFromDecomposition)(constructor, branchingFactor, decomposed, _treeA._compare, _treeA._maxNodeSize);
}
exports.default = union;
