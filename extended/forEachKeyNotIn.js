"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var shared_1 = require("./shared");
var parallelWalk_1 = require("./parallelWalk");
/**
 * Calls the supplied `callback` for each key/value pair that is in includeTree but not in excludeTree.
 * This is also known as set subtraction.
 * The callback will be called in sorted key order.
 * Neither tree is modified.
 * @param includeTree The first tree. This is the tree from which keys will be taken.
 * @param excludeTree The second tree. Keys present in this tree will be excluded.
 * @param callback Invoked for keys that are in includeTree but not in excludeTree. It can cause iteration to early exit by returning `{ break: R }`.
 * @description Complexity is bounded by O(N + M) for time.
 * However, time is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
 * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
 * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully interleaved keys, none intersecting) performance is faster than calling `toArray`
 * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
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
    };
    var cmp = includeTree._compare;
    var makePayload = function () { return undefined; };
    var cursorInclude = (0, parallelWalk_1.createCursor)(_includeTree, makePayload, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop);
    if (excludeTree.size === 0) {
        finishWalk();
        return;
    }
    var cursorExclude = (0, parallelWalk_1.createCursor)(_excludeTree, makePayload, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop);
    var order = cmp((0, parallelWalk_1.getKey)(cursorInclude), (0, parallelWalk_1.getKey)(cursorExclude));
    while (true) {
        var areEqual = order === 0;
        if (areEqual) {
            // Keys are equal, so this key is in both trees and should be skipped.
            var outInclude = (0, parallelWalk_1.moveForwardOne)(cursorExclude, cursorInclude);
            if (outInclude)
                break;
            var _a = (0, parallelWalk_1.moveTo)(cursorInclude, cursorExclude, (0, parallelWalk_1.getKey)(cursorInclude), true, areEqual), outExclude = _a[0], nowEqual = _a[1];
            if (outExclude) {
                finishWalk();
                break;
            }
            order = nowEqual ? 0 : -1;
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
                var _b = (0, parallelWalk_1.moveTo)(cursorExclude, cursorInclude, (0, parallelWalk_1.getKey)(cursorInclude), true, areEqual), out = _b[0], nowEqual = _b[1];
                if (out) {
                    // We've reached the end of exclude, so call for all remaining keys in include
                    finishWalk();
                    break;
                }
                else if (nowEqual) {
                    order = 0;
                }
                else {
                    order = -1; // trailing is ahead of leading
                }
            }
        }
    }
}
exports.default = forEachKeyNotIn;
