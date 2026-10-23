"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decomposeOmittingRange = exports.omitUnboundedErrorMsg = void 0;
var b_tree_1 = require("../b+tree");
var shared_1 = require("./shared");
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
 *   2. omit: from there to the first key at/after `end`
 *   3. keep: from there off the end of the tree
 * During the keep phases, every subtree the cursor skips over is wholly kept and is reused as-is. Nodes that contain
 * any omitted key are "disqualified": they cannot be reused, so only their kept children/entries are collected.
 * The caller must guarantee the range contains at least one key of the (non-empty) tree.
 * @internal
 */
function decomposeOmittingRange(tree, start, end, includeEnd) {
    var maxNodeSize = tree._maxNodeSize;
    var minSize = Math.floor(maxNodeSize / 2);
    var heights = [];
    var nodes = [];
    // Kept entries from partially-kept leaves accumulate here until a reused subtree is added after them.
    var pendingKeys = [];
    var pendingValues = [];
    // While stepping up through wholly-kept nodes, we defer adding them because an ancestor may also be wholly kept.
    var highestDisjoint = undefined;
    var highestDisjointHeight = 0;
    var keeping = true;
    var onLeafCreation = function (leaf) {
        heights.push(leaf.keys.length < minSize ? -1 : 0);
        nodes.push(leaf);
    };
    var flushPending = function () {
        (0, shared_1.makeLeavesFrom)(pendingKeys, pendingValues, maxNodeSize, decompose_1.decomposeLoadFactor, onLeafCreation);
        pendingKeys.length = 0;
        pendingValues.length = 0;
    };
    var addSharedNode = function (node, height) {
        flushPending();
        // Don't share underfilled leaves; instead mark them as needing merging
        if (node.isLeaf && node.keys.length < minSize) {
            heights.push(-1);
            nodes.push(node.clone());
        }
        else {
            node.isShared = true;
            heights.push(height);
            nodes.push(node);
        }
    };
    var addHighestDisjoint = function () {
        if (highestDisjoint !== undefined) {
            addSharedNode(highestDisjoint, highestDisjointHeight);
            highestDisjoint = undefined;
        }
    };
    var addChildren = function (parent, from, toExclusive, height) {
        var children = parent.children;
        for (var i = from; i < toExclusive; ++i)
            addSharedNode(children[i], height);
    };
    var pushLeafRange = function (leaf, from, toExclusive) {
        var keys = leaf.keys;
        var values = leaf.values;
        for (var i = from; i < toExclusive; ++i) {
            pendingKeys.push(keys[i]);
            pendingValues.push(values[i]);
        }
    };
    // Every ancestor of a node containing an omitted key also contains it, so disqualify upward.
    var disqualifySpine = function (cursor, depthFrom) {
        var spine = cursor.spine;
        for (var i = depthFrom; i >= 0; --i) {
            var payload = spine[i].payload;
            if (payload.disqualified)
                break;
            payload.disqualified = true;
        }
    };
    var onEnterLeaf = function (leaf, destIndex, cursor) {
        if (keeping) {
            pushLeafRange(leaf, 0, destIndex);
        }
        else if (destIndex > 0) {
            cursor.leafPayload.disqualified = true;
            disqualifySpine(cursor, cursor.spine.length - 1);
        }
    };
    var onMoveInLeaf = function (leaf, _, fromIndex, toIndex, startedEqual) {
        if (keeping)
            pushLeafRange(leaf, startedEqual ? fromIndex + 1 : fromIndex, toIndex);
    };
    var onExitLeaf = function (leaf, payload, startIndex, startedEqual, cursor) {
        if (!keeping)
            return;
        if (payload.disqualified) {
            pushLeafRange(leaf, startedEqual ? startIndex + 1 : startIndex, leaf.keys.length);
        }
        else {
            highestDisjoint = leaf;
            highestDisjointHeight = 0;
            if (cursor.spine.length === 0)
                addHighestDisjoint();
        }
    };
    var onStepUp = function (parent, height, payload, fromIndex, spineIndex, stepDownIndex, cursor) {
        var isDescending = stepDownIndex === stepDownIndex /* not NaN */ && stepDownIndex !== Number.POSITIVE_INFINITY;
        if (!keeping) {
            if (isDescending && stepDownIndex > 0)
                disqualifySpine(cursor, spineIndex);
            return;
        }
        if (isDescending) {
            addHighestDisjoint();
            addChildren(parent, fromIndex + 1, stepDownIndex, height - 1);
        }
        else if (payload.disqualified) {
            addHighestDisjoint();
            addChildren(parent, fromIndex + 1, parent.children.length, height - 1);
        }
        else {
            // The root always contains an omitted key, so a wholly-kept node is never the last one stepped out of.
            (0, b_tree_1.check)(stepDownIndex !== Number.POSITIVE_INFINITY, "omit: root unexpectedly kept whole");
            highestDisjoint = parent;
            highestDisjointHeight = height;
        }
    };
    var onStepDown = function (node, height, spineIndex, stepDownIndex, cursor) {
        if (stepDownIndex <= 0)
            return;
        if (keeping)
            addChildren(node, 0, stepDownIndex, height - 1);
        else
            disqualifySpine(cursor, spineIndex);
    };
    var cursor = (0, parallelWalk_1.createCursor)(tree, function () { return ({ disqualified: false }); }, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown);
    // Phase 1 (keep): walk to the first omitted key.
    if (start !== undefined) {
        var out = (0, parallelWalk_1.moveTo)(cursor, cursor, start, true, false)[0];
        (0, b_tree_1.check)(!out, "omit: range unexpectedly beyond end of tree");
    }
    if (end !== undefined) {
        // The cursor now sits on an omitted key, so its leaf and every ancestor cannot be reused whole.
        cursor.leafPayload.disqualified = true;
        disqualifySpine(cursor, cursor.spine.length - 1);
        // Phase 2 (omit): walk to the first key after the range.
        keeping = false;
        var out = (0, parallelWalk_1.moveTo)(cursor, cursor, end, !includeEnd, false)[0];
        if (!out) {
            // Phase 3 (keep): walk off the end of the tree, collecting everything passed.
            keeping = true;
            (0, parallelWalk_1.moveTo)(cursor, cursor, tree._root.maxKey(), false, false);
        }
    }
    // When `end` is undefined, everything from the cursor onward is omitted, so the walk simply stops.
    flushPending();
    (0, b_tree_1.check)(highestDisjoint === undefined, "omit: unflushed disjoint subtree");
    var tallestIndex = 0;
    for (var i = 1; i < heights.length; ++i) {
        if (heights[i] > heights[tallestIndex])
            tallestIndex = i;
    }
    return { heights: heights, nodes: nodes, tallestIndex: tallestIndex };
}
exports.decomposeOmittingRange = decomposeOmittingRange;
