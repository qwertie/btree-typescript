"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noop = exports.moveTo = exports.getKey = exports.createCursor = exports.moveForwardOne = void 0;
/**
 * Walks the cursor forward by one key.
 * Returns true if end-of-tree was reached (cursor not structurally mutated).
 * Optimized for this case over the more general `moveTo` function.
 * @internal
 */
function moveForwardOne(cur, other) {
    var leaf = cur.leaf;
    var nextIndex = cur.leafIndex + 1;
    if (nextIndex < leaf.keys.length) {
        // Still within current leaf
        cur.onMoveInLeaf(leaf, cur.leafPayload, cur.leafIndex, nextIndex, true);
        cur.leafIndex = nextIndex;
        return false;
    }
    // If our optimized step within leaf failed, use full moveTo logic
    // Pass isInclusive=false to ensure we walk forward to the key exactly after the current
    return moveTo(cur, other, getKey(cur), false, true)[0];
}
exports.moveForwardOne = moveForwardOne;
/**
 * Create a cursor pointing to the leftmost key of the supplied tree.
 * @internal
 */
function createCursor(tree, makePayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown) {
    var spine = [];
    var n = tree._root;
    while (!n.isLeaf) {
        var ni = n;
        var payload = makePayload();
        spine.push({ node: ni, childIndex: 0, payload: payload });
        n = ni.children[0];
    }
    var leafPayload = makePayload();
    var cur = {
        tree: tree,
        leaf: n, leafIndex: 0,
        spine: spine,
        leafPayload: leafPayload,
        makePayload: makePayload,
        onEnterLeaf: onEnterLeaf,
        onMoveInLeaf: onMoveInLeaf,
        onExitLeaf: onExitLeaf,
        onStepUp: onStepUp,
        onStepDown: onStepDown
    };
    return cur;
}
exports.createCursor = createCursor;
/**
 * Gets the key at the current cursor position.
 * @internal
 */
function getKey(c) {
    return c.leaf.keys[c.leafIndex];
}
exports.getKey = getKey;
/**
 * Move cursor strictly forward to the first key >= (inclusive) or > (exclusive) target.
 * Returns a boolean indicating if end-of-tree was reached (cursor not structurally mutated).
 * Also returns a boolean indicating if the target key was landed on exactly.
 * @internal
 */
function moveTo(cur, other, targetKey, isInclusive, startedEqual) {
    // Cache for perf
    var cmp = cur.tree._compare;
    var onMoveInLeaf = cur.onMoveInLeaf;
    // Fast path: destination within current leaf
    var leaf = cur.leaf;
    var leafPayload = cur.leafPayload;
    var i = leaf.indexOf(targetKey, -1, cmp);
    var destInLeaf;
    var targetExactlyReached;
    if (i < 0) {
        destInLeaf = ~i;
        targetExactlyReached = false;
    }
    else {
        if (isInclusive) {
            destInLeaf = i;
            targetExactlyReached = true;
        }
        else {
            destInLeaf = i + 1;
            targetExactlyReached = false;
        }
    }
    var leafKeyCount = leaf.keys.length;
    if (destInLeaf < leafKeyCount) {
        onMoveInLeaf(leaf, leafPayload, cur.leafIndex, destInLeaf, startedEqual);
        cur.leafIndex = destInLeaf;
        return [false, targetExactlyReached];
    }
    // Find first ancestor with a viable right step
    var spine = cur.spine;
    var initialSpineLength = spine.length;
    var descentLevel = -1;
    var descentIndex = -1;
    for (var s = initialSpineLength - 1; s >= 0; s--) {
        var parent = spine[s].node;
        var indexOf = parent.indexOf(targetKey, -1, cmp);
        var stepDownIndex = void 0;
        if (indexOf < 0) {
            stepDownIndex = ~indexOf;
        }
        else {
            stepDownIndex = isInclusive ? indexOf : indexOf + 1;
        }
        // Note: when key not found, indexOf with failXor=0 already returns insertion index
        if (stepDownIndex < parent.keys.length) {
            descentLevel = s;
            descentIndex = stepDownIndex;
            break;
        }
    }
    // Exit leaf; even if no spine, we did walk out of it conceptually
    var startIndex = cur.leafIndex;
    cur.onExitLeaf(leaf, leafPayload, startIndex, startedEqual, cur);
    var onStepUp = cur.onStepUp;
    if (descentLevel < 0) {
        // No descent point; step up all the way; last callback gets infinity
        for (var depth = initialSpineLength - 1; depth >= 0; depth--) {
            var entry_1 = spine[depth];
            var sd = depth === 0 ? Number.POSITIVE_INFINITY : Number.NaN;
            onStepUp(entry_1.node, initialSpineLength - depth, entry_1.payload, entry_1.childIndex, depth, sd, cur, other);
        }
        return [true, false];
    }
    // Step up through ancestors above the descentLevel
    for (var depth = initialSpineLength - 1; depth > descentLevel; depth--) {
        var entry_2 = spine[depth];
        onStepUp(entry_2.node, initialSpineLength - depth, entry_2.payload, entry_2.childIndex, depth, Number.NaN, cur, other);
    }
    var entry = spine[descentLevel];
    onStepUp(entry.node, initialSpineLength - descentLevel, entry.payload, entry.childIndex, descentLevel, descentIndex, cur, other);
    entry.childIndex = descentIndex;
    var onStepDown = cur.onStepDown;
    var makePayload = cur.makePayload;
    // Descend, invoking onStepDown and creating payloads
    var height = initialSpineLength - descentLevel - 1; // calculate height before changing length
    spine.length = descentLevel + 1;
    var node = spine[descentLevel].node.children[descentIndex];
    while (!node.isLeaf) {
        var ni = node;
        var keys = ni.keys;
        var stepDownIndex = ni.indexOf(targetKey, 0, cmp);
        if (!isInclusive && stepDownIndex < keys.length && cmp(keys[stepDownIndex], targetKey) === 0)
            stepDownIndex++;
        var payload = makePayload();
        var spineIndex = spine.length;
        spine.push({ node: ni, childIndex: stepDownIndex, payload: payload });
        onStepDown(ni, height, spineIndex, stepDownIndex, cur, other);
        node = ni.children[stepDownIndex];
        height -= 1;
    }
    // Enter destination leaf
    var idx = node.indexOf(targetKey, -1, cmp);
    var destIndex;
    if (idx < 0) {
        destIndex = ~idx;
        targetExactlyReached = false;
    }
    else {
        if (isInclusive) {
            destIndex = idx;
            targetExactlyReached = true;
        }
        else {
            destIndex = idx + 1;
            targetExactlyReached = false;
        }
    }
    cur.leaf = node;
    cur.leafPayload = makePayload();
    cur.leafIndex = destIndex;
    cur.onEnterLeaf(node, destIndex, cur, other);
    return [false, targetExactlyReached];
}
exports.moveTo = moveTo;
/**
 * A no-operation function.
 * @internal
 */
function noop() { }
exports.noop = noop;
