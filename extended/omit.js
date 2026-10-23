"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.omitUnboundedErrorMsg = void 0;
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
    // O(1) checks for cases in which nothing can be omitted
    if (root.size() === 0)
        return tree.clone();
    if (start !== undefined) {
        if (cmp(start, root.maxKey()) > 0)
            return tree.clone();
        if (end !== undefined) {
            var order = cmp(start, end);
            if (order > 0 || (order === 0 && !includeEnd))
                return tree.clone();
        }
    }
    var decomposed = decomposeOmittingRange(_tree, start, end, includeEnd);
    if (decomposed === undefined)
        return tree.clone();
    var constructor = tree.constructor;
    return (0, decompose_1.buildFromDecomposition)(constructor, _tree._maxNodeSize, decomposed, cmp, _tree._maxNodeSize);
}
exports.default = omit;
/**
 * Decomposes a tree into the maximal disjoint subtrees (and loose leaf entries) that lie outside of a key range.
 * A cursor is first placed directly on the first key >= `start` with a single descent. Every node on its spine
 * contains that (omitted) key, so none can be reused whole; everything to the left of the spine is kept and is
 * collected straight from the spine. The cursor then walks:
 *   1. omit: to the first key after the range, collecting nothing
 *   2. keep: off the end of the tree, reusing every subtree it skips over
 * Returns undefined if the range contains no keys.
 * `start`, if supplied, must not be greater than the tree's max key.
 */
function decomposeOmittingRange(tree, start, end, includeEnd) {
    // The cursor starts out omitting: it collects nothing and only disqualifies nodes containing omitted keys.
    var onEnterLeafOmitting = function (_, destIndex, cursor) {
        // Keys before the destination are omitted, so the leaf cannot be reused whole.
        if (destIndex > 0) {
            cursor.leafPayload.disqualified = true;
            (0, decompose_1.disqualifySpine)(cursor, cursor.spine.length - 1);
        }
    };
    var cursor = (0, parallelWalk_1.createCursor)(tree, decompose_1.makeDecomposePayload, onEnterLeafOmitting, parallelWalk_1.noop, parallelWalk_1.noop, decompose_1.disqualifyOnStepUp, decompose_1.disqualifyOnStepDown, start);
    if (end !== undefined) {
        var order = tree._compare((0, parallelWalk_1.getKey)(cursor), end);
        if (order > 0 || (order === 0 && !includeEnd))
            return undefined;
    }
    // The cursor sits on an omitted key, so its leaf and every ancestor cannot be reused whole.
    cursor.leafPayload.disqualified = true;
    (0, decompose_1.disqualifySpine)(cursor, cursor.spine.length - 1);
    var decomposer = (0, decompose_1.createDecomposer)(tree._maxNodeSize);
    // Keep everything left of the spine. Visiting the spine top-down yields these in key order.
    var spine = cursor.spine;
    for (var depth = 0; depth < spine.length; ++depth) {
        var _a = spine[depth], node = _a.node, childIndex = _a.childIndex;
        var childHeight = spine.length - depth - 1;
        for (var i = 0; i < childIndex; ++i)
            decomposer.addSharedNodeToDisjointSet(node.children[i], childHeight);
    }
    decomposer.pushLeafRange(cursor.leaf, 0, cursor.leafIndex);
    // When `end` is undefined, everything from the cursor onward is omitted.
    if (end !== undefined) {
        // Phase 1 (omit): walk to the first key after the range.
        var out = (0, parallelWalk_1.moveTo)(cursor, cursor, end, !includeEnd, false)[0];
        if (!out) {
            // Phase 2 (keep): walk off the end of the tree, collecting everything passed.
            // This walk never enters a new leaf, so onEnterLeaf is not needed.
            cursor.onMoveInLeaf = decomposer.onMoveInLeaf;
            cursor.onExitLeaf = decomposer.onExitLeaf;
            cursor.onStepUp = decomposer.onStepUp;
            cursor.onStepDown = decomposer.onStepDown;
            (0, parallelWalk_1.moveTo)(cursor, cursor, tree._root.maxKey(), false, false);
        }
    }
    return decomposer.finish();
}
