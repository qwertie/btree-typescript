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
 * @param treeA First tree to intersect.
 * @param treeB Second tree to intersect.
 * @param combineFn Called for keys that appear in both trees. Return the desired value.
 * @description Complexity is bounded O(N + M) for both time and allocations.
 * However, it is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
 * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
 * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully intersecting keys) performance is faster than calling `toArray`
 * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
 */
function intersect(treeA, treeB, combineFn) {
    var _treeA = treeA;
    var _treeB = treeB;
    var branchingFactor = (0, shared_1.checkCanDoSetOperation)(_treeA, _treeB, true);
    if (_treeA._root.size() === 0)
        return treeB.clone();
    if (_treeB._root.size() === 0)
        return treeA.clone();
    var intersected = (0, shared_1.createAlternatingList)();
    (0, forEachKeyInBoth_1.default)(treeA, treeB, function (key, leftValue, rightValue) {
        var mergedValue = combineFn(key, leftValue, rightValue);
        (0, shared_1.alternatingPush)(intersected, key, mergedValue);
    });
    // Intersected keys are guaranteed to be in order, so we can bulk load
    var constructor = treeA.constructor;
    var resultTree = new constructor(undefined, treeA._compare, branchingFactor);
    resultTree._root = (0, bulkLoad_1.bulkLoadRoot)(intersected, branchingFactor, treeA._compare);
    return resultTree;
}
exports.default = intersect;
