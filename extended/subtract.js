"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var shared_1 = require("./shared");
var decompose_1 = require("./decompose");
/**
 * Returns a new tree containing only the keys that are present in `targetTree` but not `subtractTree` (set subtraction).
 * Neither tree is modified.
 *
 * Let `A` and `B` be the input sizes, `H` the larger tree height (counting a leaf as height 1),
 * and `S` the number of maximal contiguous runs of keys from one tree in the totally ordered
 * list of keys from both trees.
 * The runtime of this method is `O(min(A + B, S * H))`.
 * Allocations are O(A) in the worst case, but disjoint subtrees from `targetTree` are reused.
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
