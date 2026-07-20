"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var shared_1 = require("./shared");
var decompose_1 = require("./decompose");
/**
 * Returns a new tree containing only the keys that are present in `targetTree` but not `subtractTree` (set subtraction).
 * Neither tree is modified.
 *
 * Let `N` and `M` be the input sizes, `I` the number of keys present in both trees, `U = N + M - 2I`
 * the number of keys present in exactly one tree, `H` the larger tree height, and `G` the number of maximal
 * runs of keys belonging exclusively to one particular tree in merged key order. With a fixed max node size
 * and normally occupied nodes, the time complexity is `O(min(I + U, I + G * H^2))`.
 * Allocations are O(N) in the worst case, but disjoint subtrees from `targetTree` are reused.
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
    if (decomposed.heights.length === 0) {
        return new constructor(undefined, targetTree._compare, targetTree._maxNodeSize);
    }
    return (0, decompose_1.buildFromDecomposition)(constructor, branchingFactor, decomposed, targetTree._compare, targetTree._maxNodeSize);
}
exports.default = subtract;
