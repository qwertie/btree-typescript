"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var shared_1 = require("./shared");
var parallelWalk_1 = require("./parallelWalk");
/**
 * Calls the supplied `callback` for each key/value pair that is in `includeTree` but not in `excludeTree`
 * (set subtraction). The callback runs in sorted key order and neither tree is modified.
 *
 * Complexity is O(N + M) when the key ranges overlap heavily, and additionally bounded by O(log(N + M) * D)
 * where `D` is the number of disjoint ranges between the trees, because non-overlapping subtrees are skipped.
 * In practice, that means for keys of random distribution the performance is linear and for keys with significant
 * numbers of non-overlapping key ranges it is much faster.
 * @param includeTree The tree to iterate keys from.
 * @param excludeTree Keys present in this tree are omitted from the callback.
 * @param callback Invoked for keys that are in `includeTree` but not `excludeTree`. It can cause iteration to early exit by returning `{ break: R }`.
 * @returns The first `break` payload returned by the callback, or `undefined` if all qualifying keys are visited.
 * @throws Error if the trees were built with different comparators.
 */
function forEachKeyNotIn(includeTree, excludeTree, callback) {
    var _includeTree = includeTree;
    var _excludeTree = excludeTree;
    (0, shared_1.checkCanDoSetOperation)(_includeTree, _excludeTree, true);
    if (includeTree.size === 0) {
        return;
    }
    var finishWalk = function () {
        var out = false;
        do {
            var key = (0, parallelWalk_1.getKey)(cursorInclude);
            var value = cursorInclude.leaf.values[cursorInclude.leafIndex];
            var result = callback(key, value);
            if (result && result.break) {
                return result.break;
            }
            out = (0, parallelWalk_1.moveForwardOne)(cursorInclude, cursorExclude);
        } while (!out);
        return undefined;
    };
    var cmp = includeTree._compare;
    var makePayload = function () { return undefined; };
    var cursorInclude = (0, parallelWalk_1.createCursor)(_includeTree, makePayload, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop);
    if (excludeTree.size === 0) {
        return finishWalk();
    }
    var cursorExclude = (0, parallelWalk_1.createCursor)(_excludeTree, makePayload, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop);
    var order = cmp((0, parallelWalk_1.getKey)(cursorInclude), (0, parallelWalk_1.getKey)(cursorExclude));
    while (true) {
        var areEqual = order === 0;
        if (areEqual) {
            // Keys are equal, so this key is in both trees and should be skipped.
            var outInclude = (0, parallelWalk_1.moveForwardOne)(cursorInclude, cursorExclude);
            if (outInclude)
                break;
            order = 1; // include is now ahead of exclude
        }
        else {
            if (order < 0) {
                var key = (0, parallelWalk_1.getKey)(cursorInclude);
                var value = cursorInclude.leaf.values[cursorInclude.leafIndex];
                var result = callback(key, value);
                if (result && result.break) {
                    return result.break;
                }
                var outInclude = (0, parallelWalk_1.moveForwardOne)(cursorInclude, cursorExclude);
                if (outInclude) {
                    break;
                }
                order = cmp((0, parallelWalk_1.getKey)(cursorInclude), (0, parallelWalk_1.getKey)(cursorExclude));
            }
            else {
                // At this point, include is guaranteed to be ahead of exclude.
                var _a = (0, parallelWalk_1.moveTo)(cursorExclude, cursorInclude, (0, parallelWalk_1.getKey)(cursorInclude), true, areEqual), out = _a[0], nowEqual = _a[1];
                if (out) {
                    // We've reached the end of exclude, so call for all remaining keys in include
                    return finishWalk();
                }
                else if (nowEqual) {
                    order = 0;
                }
                else {
                    order = -1;
                }
            }
        }
    }
}
exports.default = forEachKeyNotIn;
