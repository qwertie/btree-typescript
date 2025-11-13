"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffAgainst2 = void 0;
var b_tree_1 = require("../b+tree");
var parallelWalk_1 = require("./parallelWalk");
var shared_1 = require("./shared");
/**
 * Computes the differences between `treeA` and `treeB`.
 * For efficiency, the diff is returned via invocations of supplied handlers.
 * The computation is optimized for the case in which the two trees have large amounts of shared data
 * (obtained by calling the `clone` or `with` APIs) and will avoid any iteration of shared state.
 * The handlers can cause computation to early exit by returning `{ break: R }`.
 * Neither collection should be mutated during the comparison (inside your callbacks), as this method assumes they remain stable.
 * Time complexity is O(N + M), but shared nodes are skipped entirely.
 * @param treeA The tree whose differences will be reported via the callbacks.
 * @param treeB The tree to compute a diff against.
 * @param onlyA Callback invoked for all keys only present in `treeA`.
 * @param onlyB Callback invoked for all keys only present in `treeB`.
 * @param different Callback invoked for all keys with differing values.
 */
function diffAgainst(_treeA, _treeB, onlyA, onlyB, different) {
    var treeA = _treeA;
    var treeB = _treeB;
    (0, shared_1.checkCanDoSetOperation)(treeA, treeB, true);
    // During the downward walk of the cursors, this will be assigned the index of the highest node that is shared between the two trees
    // along the paths of the two cursors.
    var highestSharedIndex = -1;
    var onExitLeaf = function () {
        highestSharedIndex = -1;
    };
    var maybeSetHighest = function (node, height, spineIndex, cursorOther) {
        if (highestSharedIndex < 0) {
            var heightOther = cursorOther.spine.length;
            if (height <= heightOther) {
                var depthOther = heightOther - height;
                if (depthOther >= 0) {
                    var otherNode = cursorOther.spine[depthOther].node;
                    if (otherNode === node) {
                        highestSharedIndex = spineIndex;
                    }
                }
            }
        }
    };
    var onStepUp = function (parent, height, _, __, spineIndex, stepDownIndex, ___, cursorOther) {
        (0, b_tree_1.check)(highestSharedIndex < 0, "Shared nodes should have been skipped");
        if (stepDownIndex > 0) {
            maybeSetHighest(parent, height, spineIndex, cursorOther);
        }
    };
    var onStepDown = function (node, height, spineIndex, _, __, cursorOther) {
        maybeSetHighest(node, height, spineIndex, cursorOther);
    };
    var onEnterLeaf = function (leaf, _, cursorThis, cursorOther) {
        if (highestSharedIndex < 0) {
            if (cursorOther.leaf === leaf) {
                highestSharedIndex = cursorThis.spine.length - 1;
            }
        }
    };
    var cmp = treeA._compare;
    // Need the max key of both trees to perform the "finishing" walk of which ever cursor finishes second
    var maxKeyLeft = treeA.maxKey();
    var maxKeyRight = treeB.maxKey();
    var maxKey = cmp(maxKeyLeft, maxKeyRight) >= 0 ? maxKeyLeft : maxKeyRight;
    var payloadA = { only: onlyA ? onlyA : function () { } };
    var payloadB = { only: onlyB ? onlyB : function () { } };
    var curA = (0, parallelWalk_1.createCursor)(treeA, function () { return payloadA; }, onEnterLeaf, parallelWalk_1.noop, onExitLeaf, onStepUp, onStepDown);
    var curB = (0, parallelWalk_1.createCursor)(treeB, function () { return payloadB; }, onEnterLeaf, parallelWalk_1.noop, onExitLeaf, onStepUp, onStepDown);
    for (var depth = 0; depth < curA.spine.length - 1; depth++) {
        onStepDown(curA.spine[depth].node, curA.spine.length - depth, depth, curA.spine[depth].childIndex, curA, curB);
    }
    onEnterLeaf(curA.leaf, curA.leafIndex, curA, curB);
    var leading = curA;
    var trailing = curB;
    var order = cmp((0, parallelWalk_1.getKey)(leading), (0, parallelWalk_1.getKey)(trailing));
    // Walk both cursors in alternating hops
    while (true) {
        var areEqual = order === 0;
        if (areEqual) {
            var key = (0, parallelWalk_1.getKey)(leading);
            var vA = curA.leaf.values[curA.leafIndex];
            var vB = curB.leaf.values[curB.leafIndex];
            var combined = different ? different(key, vA, vB) : undefined;
            if (combined && combined.break) {
                return combined.break;
            }
            var outTrailing = (0, parallelWalk_1.moveForwardOne)(trailing, leading, key, cmp);
            var outLeading = (0, parallelWalk_1.moveForwardOne)(leading, trailing, key, cmp);
            if (outTrailing || outLeading) {
                if (!outTrailing || !outLeading) {
                    // In these cases, we pass areEqual=false because a return value of "out of tree" means
                    // the cursor did not move. This must be true because they started equal and one of them had more tree
                    // to walk (one is !out), so they cannot be equal at this point.
                    if (outTrailing) {
                        finishWalk(leading, trailing);
                    }
                    else {
                        finishWalk(trailing, leading);
                    }
                }
                break;
            }
            order = cmp((0, parallelWalk_1.getKey)(leading), (0, parallelWalk_1.getKey)(trailing));
        }
        else {
            if (order < 0) {
                var tmp = trailing;
                trailing = leading;
                leading = tmp;
            }
            var _a = (0, parallelWalk_1.moveTo)(trailing, leading, (0, parallelWalk_1.getKey)(leading), true, areEqual, cmp), out = _a[0], nowEqual = _a[1];
            if (out) {
                return finishWalk(leading, trailing);
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
exports.default = diffAgainst;
function finishWalk(toFinish, done) {
    var outOfTree;
    do {
        outOfTree = (0, parallelWalk_1.moveForwardOne)(toFinish, done, (0, parallelWalk_1.getKey)(done), toFinish.tree._compare);
        if (!outOfTree) {
            var key = (0, parallelWalk_1.getKey)(toFinish);
            var value = toFinish.leaf.values[toFinish.leafIndex];
            var result = toFinish.leafPayload.only(key, value);
            if (result && result.break) {
                return result.break;
            }
        }
    } while (!outOfTree);
    return undefined;
}
/**
 * Computes the differences between `treeA` and `treeB`.
 * For efficiency, the diff is returned via invocations of supplied handlers.
 * The computation is optimized for the case in which the two trees have large amounts of shared data
 * (obtained by calling the `clone` or `with` APIs) and will avoid any iteration of shared state.
 * The handlers can cause computation to early exit by returning `{ break: R }`.
 * Neither collection should be mutated during the comparison (inside your callbacks), as this method assumes they remain stable.
 * @param treeA The tree whose differences will be reported via the callbacks.
 * @param treeB The tree to compute a diff against.
 * @param onlyA Callback invoked for all keys only present in `treeA`.
 * @param onlyB Callback invoked for all keys only present in `treeB`.
 * @param different Callback invoked for all keys with differing values.
 */
function diffAgainst2(_treeA, _treeB, onlyA, onlyB, different) {
    var treeA = _treeA;
    var treeB = _treeB;
    if (treeB._compare !== treeA._compare) {
        throw new Error('Tree comparators are not the same.');
    }
    if (treeA.isEmpty || treeB.isEmpty) {
        if (_treeA.isEmpty && treeB.isEmpty)
            return undefined;
        if (treeA.isEmpty) {
            return onlyB === undefined
                ? undefined
                : stepToEnd(makeDiffCursor(treeB), onlyB);
        }
        return onlyA === undefined
            ? undefined
            : stepToEnd(makeDiffCursor(treeA), onlyA);
    }
    // Cursor-based diff algorithm is as follows:
    // - Until neither cursor has navigated to the end of the tree, do the following:
    //   - If the `treeThis` cursor is "behind" the `treeOther` cursor (strictly <, via compare), advance it.
    //   - Otherwise, advance the `treeOther` cursor.
    //   - Any time a cursor is stepped, perform the following:
    //     - If either cursor points to a key/value pair:
    //       - If thisCursor === otherCursor and the values differ, it is a Different.
    //       - If thisCursor > otherCursor and otherCursor is at a key/value pair, it is an OnlyB.
    //       - If thisCursor < otherCursor and thisCursor is at a key/value pair, it is an OnlyA as long as the most recent
    //         cursor step was *not* otherCursor advancing from a tie. The extra condition avoids erroneous OnlyB calls
    //         that would occur due to otherCursor being the "leader".
    //     - Otherwise, if both cursors point to nodes, compare them. If they are equal by reference (shared), skip
    //       both cursors to the next node in the walk.
    // - Once one cursor has finished stepping, any remaining steps (if any) are taken and key/value pairs are logged
    //   as OnlyB (if otherCursor is stepping) or OnlyA (if thisCursor is stepping).
    // This algorithm gives the critical guarantee that all locations (both nodes and key/value pairs) in both trees that
    // are identical by value (and possibly by reference) will be visited *at the same time* by the cursors.
    // This removes the possibility of emitting incorrect diffs, as well as allowing for skipping shared nodes.
    var compareKeys = treeA._compare;
    var thisCursor = makeDiffCursor(treeA);
    var otherCursor = makeDiffCursor(treeB);
    var thisSuccess = true;
    var otherSuccess = true;
    // It doesn't matter how thisSteppedLast is initialized.
    // Step order is only used when either cursor is at a leaf, and cursors always start at a node.
    var prevCursorOrder = compareDiffCursors(thisCursor, otherCursor, compareKeys);
    while (thisSuccess && otherSuccess) {
        var cursorOrder = compareDiffCursors(thisCursor, otherCursor, compareKeys);
        var thisLeaf = thisCursor.leaf, thisInternalSpine = thisCursor.internalSpine, thisLevelIndices = thisCursor.levelIndices;
        var otherLeaf = otherCursor.leaf, otherInternalSpine = otherCursor.internalSpine, otherLevelIndices = otherCursor.levelIndices;
        if (thisLeaf || otherLeaf) {
            // If the cursors were at the same location last step, then there is no work to be done.
            if (prevCursorOrder !== 0) {
                if (cursorOrder === 0) {
                    if (thisLeaf && otherLeaf && different) {
                        // Equal keys, check for modifications
                        var valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
                        var valOther = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
                        if (!Object.is(valThis, valOther)) {
                            var result = different(thisCursor.currentKey, valThis, valOther);
                            if (result && result.break)
                                return result.break;
                        }
                    }
                }
                else if (cursorOrder > 0) {
                    // If this is the case, we know that either:
                    // 1. otherCursor stepped last from a starting position that trailed thisCursor, and is still behind, or
                    // 2. thisCursor stepped last and leapfrogged otherCursor
                    // Either of these cases is an "only other"
                    if (otherLeaf && onlyB) {
                        var otherVal = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
                        var result = onlyB(otherCursor.currentKey, otherVal);
                        if (result && result.break)
                            return result.break;
                    }
                }
                else if (onlyA) {
                    if (thisLeaf && prevCursorOrder !== 0) {
                        var valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
                        var result = onlyA(thisCursor.currentKey, valThis);
                        if (result && result.break)
                            return result.break;
                    }
                }
            }
        }
        else if (!thisLeaf && !otherLeaf && cursorOrder === 0) {
            var lastThis = thisInternalSpine.length - 1;
            var lastOther = otherInternalSpine.length - 1;
            var nodeThis = thisInternalSpine[lastThis][thisLevelIndices[lastThis]];
            var nodeOther = otherInternalSpine[lastOther][otherLevelIndices[lastOther]];
            if (nodeOther === nodeThis) {
                prevCursorOrder = 0;
                thisSuccess = stepDiffCursor(thisCursor, true);
                otherSuccess = stepDiffCursor(otherCursor, true);
                continue;
            }
        }
        prevCursorOrder = cursorOrder;
        if (cursorOrder < 0) {
            thisSuccess = stepDiffCursor(thisCursor);
        }
        else {
            otherSuccess = stepDiffCursor(otherCursor);
        }
    }
    if (thisSuccess && onlyA)
        return finishCursorWalk(thisCursor, otherCursor, compareKeys, onlyA);
    if (otherSuccess && onlyB)
        return finishCursorWalk(otherCursor, thisCursor, compareKeys, onlyB);
    return undefined;
}
exports.diffAgainst2 = diffAgainst2;
/**
 * Finishes walking `cursor` once the other cursor has already completed its walk.
 */
function finishCursorWalk(cursor, cursorFinished, compareKeys, callback) {
    var compared = compareDiffCursors(cursor, cursorFinished, compareKeys);
    if (compared === 0) {
        if (!stepDiffCursor(cursor))
            return undefined;
    }
    else if (compared < 0) {
        (0, b_tree_1.check)(false, 'cursor walk terminated early');
    }
    return stepToEnd(cursor, callback);
}
/**
 * Walks the cursor to the end of the tree, invoking the callback for each key/value pair.
 */
function stepToEnd(cursor, callback) {
    var canStep = true;
    while (canStep) {
        var leaf = cursor.leaf, levelIndices = cursor.levelIndices, currentKey = cursor.currentKey;
        if (leaf) {
            var value = leaf.values[levelIndices[levelIndices.length - 1]];
            var result = callback(currentKey, value);
            if (result && result.break)
                return result.break;
        }
        canStep = stepDiffCursor(cursor);
    }
    return undefined;
}
function makeDiffCursor(internal) {
    var root = internal._root;
    return {
        height: internal.height,
        internalSpine: [[root]],
        levelIndices: [0],
        leaf: undefined,
        currentKey: root.maxKey()
    };
}
/**
 * Advances the cursor to the next step in the walk of its tree.
 * Cursors are walked backwards in sort order, as this allows them to leverage maxKey() in order to be compared in O(1).
 */
function stepDiffCursor(cursor, stepToNode) {
    var internalSpine = cursor.internalSpine, levelIndices = cursor.levelIndices, leaf = cursor.leaf;
    if (stepToNode === true || leaf) {
        var levelsLength = levelIndices.length;
        // Step to the next node only if:
        // - We are explicitly directed to via stepToNode, or
        // - There are no key/value pairs left to step to in this leaf
        if (stepToNode === true || levelIndices[levelsLength - 1] === 0) {
            var spineLength = internalSpine.length;
            if (spineLength === 0)
                return false;
            // Walk back up the tree until we find a new subtree to descend into
            var nodeLevelIndex = spineLength - 1;
            var levelIndexWalkBack = nodeLevelIndex;
            while (levelIndexWalkBack >= 0) {
                if (levelIndices[levelIndexWalkBack] > 0) {
                    if (levelIndexWalkBack < levelsLength - 1) {
                        // Remove leaf state from cursor
                        cursor.leaf = undefined;
                        levelIndices.pop();
                    }
                    // If we walked upwards past any internal node, slice them out
                    if (levelIndexWalkBack < nodeLevelIndex)
                        cursor.internalSpine = internalSpine.slice(0, levelIndexWalkBack + 1);
                    cursor.currentKey = internalSpine[levelIndexWalkBack][--levelIndices[levelIndexWalkBack]].maxKey();
                    return true;
                }
                levelIndexWalkBack--;
            }
            // Cursor is in the far left leaf of the tree, no more nodes to enumerate
            return false;
        }
        else {
            // Move to new leaf value
            var valueIndex = --levelIndices[levelsLength - 1];
            cursor.currentKey = leaf.keys[valueIndex];
            return true;
        }
    }
    else { // Cursor does not point to a value in a leaf, so move downwards
        var nextLevel = internalSpine.length;
        var currentLevel = nextLevel - 1;
        var node = internalSpine[currentLevel][levelIndices[currentLevel]];
        if (node.isLeaf) {
            cursor.leaf = node;
            var valueIndex = (levelIndices[nextLevel] = node.values.length - 1);
            cursor.currentKey = node.keys[valueIndex];
        }
        else {
            var children = node.children;
            internalSpine[nextLevel] = children;
            var childIndex = children.length - 1;
            levelIndices[nextLevel] = childIndex;
            cursor.currentKey = children[childIndex].maxKey();
        }
        return true;
    }
}
/**
 * Compares two cursors and returns which cursor is ahead in the traversal.
 * Note that cursors advance in reverse sort order.
 */
function compareDiffCursors(cursorA, cursorB, compareKeys) {
    var heightA = cursorA.height, currentKeyA = cursorA.currentKey, levelIndicesA = cursorA.levelIndices;
    var heightB = cursorB.height, currentKeyB = cursorB.currentKey, levelIndicesB = cursorB.levelIndices;
    // Reverse the comparison order, as cursors are advanced in reverse sorting order
    var keyComparison = compareKeys(currentKeyB, currentKeyA);
    if (keyComparison !== 0)
        return keyComparison;
    // Normalize depth values relative to the shortest tree.
    // This ensures that concurrent cursor walks of trees of differing heights can reliably land on shared nodes at the same time.
    // To accomplish this, a cursor that is on an internal node at depth D1 with maxKey X is considered "behind" a cursor on an
    // internal node at depth D2 with maxKey Y, when D1 < D2. Thus, always walking the cursor that is "behind" will allow the cursor
    // at shallower depth (but equal maxKey) to "catch up" and land on shared nodes.
    var heightMin = heightA < heightB ? heightA : heightB;
    var depthANormalized = levelIndicesA.length - (heightA - heightMin);
    var depthBNormalized = levelIndicesB.length - (heightB - heightMin);
    return depthANormalized - depthBNormalized;
}
