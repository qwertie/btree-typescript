"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var shared_1 = require("./shared");
var decompose_1 = require("./decompose");
/**
 * Efficiently unions two trees, reusing subtrees wherever possible without mutating either input.
 *
 * Let `A` and `B` be the input sizes, `H` the larger tree height (counting a leaf as height 1),
 * and `S` the number of maximal contiguous runs of keys from one tree in the totally ordered
 * list of keys from both trees, in which a key present in both trees is listed once per tree
 * (so every shared key starts a new run, and `S` is at least the number of shared keys).
 * The runtime of this method is `O(min(A + B, S * H))`.
 * @param treeA First tree to union.
 * @param treeB Second tree to union.
 * @param combineFn Called for keys that appear in both trees. Return the desired value, or
 *        `undefined` to omit the key from the result. Note: symmetric difference can be achieved by always returning `undefined`.
 * @returns A new BTree that contains the unioned key/value pairs.
 * @throws Error if the trees were created with different comparators or max node sizes.
 */
function union(treeA, treeB, combineFn) {
    if (treeA === treeB)
        return treeA.clone();
    var _treeA = treeA;
    var _treeB = treeB;
    var branchingFactor = (0, shared_1.checkCanDoSetOperation)(_treeA, _treeB, false);
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
