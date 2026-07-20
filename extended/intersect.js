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
 * Let `N` and `M` be the input sizes, `I` the number of keys present in both trees, `U = N + M - 2I`
 * the number of keys present in exactly one tree, `H` the larger tree height, and `G` the number of maximal
 * runs of keys belonging exclusively to one particular tree in merged key order. With a fixed max node size
 * and normally occupied nodes, the complexity is `O(min(I + U, I + G * H))`.
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
