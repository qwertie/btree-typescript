"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var shared_1 = require("./shared");
var decompose_1 = require("./decompose");
/**
 * Returns a new tree containing only the keys that are present in `targetTree` but not `subtractTree` (set subtraction).
 * Neither tree is modified.
 *
 * Complexity is O(N + M) for time and O(N) for allocations in the worst case. Additionally, time is bounded by
 * O(log(N + M) * D1) and space by O(log N * D2), where `D1` is the number of disjoint key ranges between the trees
 * and `D2` is the number of disjoint ranges inside `targetTree`, because disjoint subtrees are skipped entirely.
 * In practice, that means for keys of random distribution the performance is linear and for keys with significant
 * numbers of non-overlapping key ranges it is much faster.
 * @param targetTree The tree to subtract from.
 * @param subtractTree The tree whose keys will be removed from the result.
 * @returns A new tree that contains the subtraction result.
 * @throws Error if the trees were created with different comparators or max node sizes.
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
