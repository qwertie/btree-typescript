"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.omitUnboundedErrorMsg = void 0;
var b_tree_1 = require("../b+tree");
var decompose_1 = require("./decompose");
var parallelWalk_1 = require("./parallelWalk");
/**
 * Error message used when `omit` is called without either bound.
 * @internal
 */
exports.omitUnboundedErrorMsg = "omit requires at least one of `start` or `end` to be defined.";
function omit(tree, start, end, includeEnd) {
    if (includeEnd === void 0) { includeEnd = false; }
    if (start === undefined && end === undefined)
        throw new Error(exports.omitUnboundedErrorMsg);
    var _tree = tree;
    var root = _tree._root;
    var cmp = _tree._compare;
    if (root.size() === 0)
        return tree.clone();
    // Find the first key that would be omitted. If there is none, nothing changes.
    var firstOmitted;
    if (start === undefined) {
        firstOmitted = root.minKey();
    }
    else {
        var pair = tree.getPairOrNextHigher(start);
        if (pair === undefined)
            return tree.clone();
        firstOmitted = pair[0];
    }
    if (end !== undefined) {
        var order = cmp(firstOmitted, end);
        if (order > 0 || (order === 0 && !includeEnd))
            return tree.clone();
    }
    var decomposed = decomposeOmittingRange(_tree, start, end, includeEnd);
    var constructor = tree.constructor;
    return (0, decompose_1.buildFromDecomposition)(constructor, _tree._maxNodeSize, decomposed, cmp, _tree._maxNodeSize);
}
exports.default = omit;
/**
 * Decomposes a tree into the maximal disjoint subtrees (and loose leaf entries) that lie outside of a key range.
 * A single cursor walks the tree in three phases:
 *   1. keep: from the minimum key to the first key >= `start`
 *   2. omit: from there to the first key after the range
 *   3. keep: from there off the end of the tree
 * The keep phases use the standard decomposition callbacks, which reuse every subtree the cursor skips over.
 * The omit phase swaps in callbacks that collect nothing and only disqualify the nodes containing omitted keys,
 * so that those nodes are not reused whole.
 * The caller must guarantee the range contains at least one key of the (non-empty) tree.
 */
function decomposeOmittingRange(tree, start, end, includeEnd) {
    var decomposer = (0, decompose_1.createDecomposer)(tree._maxNodeSize);
    var keep = {
        // A leaf is only entered while walking to `start` (phase 3 walks off the end), so its keys before the destination are kept.
        onEnterLeaf: function (leaf, destIndex) { return decomposer.pushLeafRange(leaf, 0, destIndex); },
        onMoveInLeaf: decomposer.onMoveInLeaf,
        onExitLeaf: decomposer.onExitLeaf,
        onStepUp: decomposer.onStepUp,
        onStepDown: decomposer.onStepDown,
    };
    var omit = {
        onEnterLeaf: function (_, destIndex, cursor) {
            // Keys before the destination are omitted, so the leaf cannot be reused whole.
            if (destIndex > 0) {
                cursor.leafPayload.disqualified = true;
                (0, decompose_1.disqualifySpine)(cursor, cursor.spine.length - 1);
            }
        },
        onMoveInLeaf: parallelWalk_1.noop,
        onExitLeaf: parallelWalk_1.noop,
        onStepUp: decompose_1.disqualifyOnStepUp,
        onStepDown: decompose_1.disqualifyOnStepDown,
    };
    var cursor = (0, parallelWalk_1.createCursor)(tree, decompose_1.makeDecomposePayload, keep.onEnterLeaf, keep.onMoveInLeaf, keep.onExitLeaf, keep.onStepUp, keep.onStepDown);
    // Phase 1 (keep): walk to the first omitted key.
    if (start !== undefined) {
        var out = (0, parallelWalk_1.moveTo)(cursor, cursor, start, true, false)[0];
        (0, b_tree_1.check)(!out, "omit: range unexpectedly beyond end of tree");
    }
    if (end !== undefined) {
        // The cursor now sits on an omitted key, so its leaf and every ancestor cannot be reused whole.
        cursor.leafPayload.disqualified = true;
        (0, decompose_1.disqualifySpine)(cursor, cursor.spine.length - 1);
        // Phase 2 (omit): walk to the first key after the range.
        Object.assign(cursor, omit);
        var out = (0, parallelWalk_1.moveTo)(cursor, cursor, end, !includeEnd, false)[0];
        if (!out) {
            // Phase 3 (keep): walk off the end of the tree, collecting everything passed.
            Object.assign(cursor, keep);
            (0, parallelWalk_1.moveTo)(cursor, cursor, tree._root.maxKey(), false, false);
        }
    }
    // When `end` is undefined, everything from the cursor onward is omitted, so the walk simply stops.
    return decomposer.finish();
}
