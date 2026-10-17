"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var shared_1 = require("./shared");
var forEachKeyInBoth_1 = __importDefault(require("./forEachKeyInBoth"));
var bulkLoad_1 = require("./bulkLoad");
/**
 * Returns a new tree containing only keys present in both input trees.
 * Neither tree is modified.
 *
 * Let `A` and `B` be the input sizes, `H` the larger tree height (counting a leaf as height 1),
 * and `S` the number of maximal contiguous runs of keys from one tree in the totally ordered
 * list of keys from both trees, in which a key present in both trees is listed once per tree
 * (so every shared key starts a new run, and `S` is at least the number of shared keys).
 * The runtime of this method is `O(min(A + B, S * H))`.
 * @param treeA First tree to intersect.
 * @param treeB Second tree to intersect.
 * @param combineFn Called for keys that appear in both trees. Return the desired value.
 * @returns A new tree populated with the intersection.
 * @throws Error if the trees were created with different comparators.
 */
function intersect(treeA, treeB, combineFn) {
    var _treeA = treeA;
    var _treeB = treeB;
    var branchingFactor = (0, shared_1.checkCanDoSetOperation)(_treeA, _treeB, true);
    if (_treeA._root.size() === 0)
        return treeA.clone();
    if (_treeB._root.size() === 0)
        return treeB.clone();
    var intersectedKeys = [];
    var intersectedValues = [];
    (0, forEachKeyInBoth_1.default)(treeA, treeB, function (key, leftValue, rightValue) {
        var mergedValue = combineFn(key, leftValue, rightValue);
        intersectedKeys.push(key);
        intersectedValues.push(mergedValue);
    });
    // Intersected keys are guaranteed to be in order, so we can bulk load
    var constructor = treeA.constructor;
    var resultTree = new constructor(undefined, treeA._compare, branchingFactor);
    resultTree._root = (0, bulkLoad_1.bulkLoadRoot)(intersectedKeys, intersectedValues, branchingFactor, treeA._compare);
    return resultTree;
}
exports.default = intersect;
