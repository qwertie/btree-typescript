"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var shared_1 = require("./shared");
var decompose_1 = require("./decompose");
/**
 * Returns a new tree containing only keys that are present in treeA but notTreeB (set subtraction).
 * Neither tree is modified.
 * @param targetTree The tree to subtract from.
 * @param subtractTree The tree to subtract.
 * @description Complexity is bounded O(N + M) for time and O(N) for allocations.
 * However, it is additionally bounded by O(log(N + M) * D1) for time and O(log(N) * D2) for space where D1/D2 are the
 * number of disjoint ranges of keys between the two trees and in targetTree, respectively. In practice, that means for
 * keys of random distribution the performance is O(N + M) and for keys with significant numbers of non-overlapping key
 * ranges it is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than calling `toArray`
 * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
 */
function subtract(targetTree, subtractTree) {
    var _targetTree = targetTree;
    var _subtractTree = subtractTree;
    var branchingFactor = (0, shared_1.checkCanDoSetOperation)(_targetTree, _subtractTree, false);
    if (_targetTree._root.size() === 0 || _subtractTree._root.size() === 0)
        return targetTree.clone();
    // Decompose target tree into disjoint subtrees leaves.
    // As many of these as possible will be reused from the original trees, and the remaining
    // will be leaves that are exploded (and filtered) due to intersecting leaves in subtractTree.
    var decomposed = (0, decompose_1.decompose)(_targetTree, _subtractTree, function () { return undefined; }, true);
    var constructor = targetTree.constructor;
    if ((0, shared_1.alternatingCount)(decomposed.disjoint) === 0) {
        return new constructor(undefined, targetTree._compare, targetTree._maxNodeSize);
    }
    return (0, decompose_1.buildFromDecomposition)(constructor, branchingFactor, decomposed, targetTree._compare, targetTree._maxNodeSize);
}
exports.default = subtract;
