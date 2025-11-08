"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffAgainst = void 0;
var b_tree_1 = require("./b+tree");
var getInternals = function (tree) {
    return tree;
};
function diffAgainst(treeThis, treeOther, onlyThis, onlyOther, different) {
    var thisInternals = getInternals(treeThis);
    var otherInternals = getInternals(treeOther);
    if (otherInternals._compare !== thisInternals._compare) {
        throw new Error('Tree comparators are not the same.');
    }
    if (treeThis.isEmpty || treeOther.isEmpty) {
        if (treeThis.isEmpty && treeOther.isEmpty)
            return undefined;
        if (treeThis.isEmpty) {
            return onlyOther === undefined
                ? undefined
                : stepToEnd(makeDiffCursor(treeOther, otherInternals), onlyOther);
        }
        return onlyThis === undefined
            ? undefined
            : stepToEnd(makeDiffCursor(treeThis, thisInternals), onlyThis);
    }
    var compareKeys = thisInternals._compare;
    var thisCursor = makeDiffCursor(treeThis, thisInternals);
    var otherCursor = makeDiffCursor(treeOther, otherInternals);
    var thisSuccess = true;
    var otherSuccess = true;
    var prevCursorOrder = compareDiffCursors(thisCursor, otherCursor, compareKeys);
    while (thisSuccess && otherSuccess) {
        var cursorOrder = compareDiffCursors(thisCursor, otherCursor, compareKeys);
        var thisLeaf = thisCursor.leaf, thisInternalSpine = thisCursor.internalSpine, thisLevelIndices = thisCursor.levelIndices;
        var otherLeaf = otherCursor.leaf, otherInternalSpine = otherCursor.internalSpine, otherLevelIndices = otherCursor.levelIndices;
        if (thisLeaf || otherLeaf) {
            if (prevCursorOrder !== 0) {
                if (cursorOrder === 0) {
                    if (thisLeaf && otherLeaf && different) {
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
                    if (otherLeaf && onlyOther) {
                        var otherVal = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
                        var result = onlyOther(otherCursor.currentKey, otherVal);
                        if (result && result.break)
                            return result.break;
                    }
                }
                else if (onlyThis) {
                    if (thisLeaf && prevCursorOrder !== 0) {
                        var valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
                        var result = onlyThis(thisCursor.currentKey, valThis);
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
    if (thisSuccess && onlyThis)
        return finishCursorWalk(thisCursor, otherCursor, compareKeys, onlyThis);
    if (otherSuccess && onlyOther)
        return finishCursorWalk(otherCursor, thisCursor, compareKeys, onlyOther);
    return undefined;
}
exports.diffAgainst = diffAgainst;
var finishCursorWalk = function (cursor, cursorFinished, compareKeys, callback) {
    var compared = compareDiffCursors(cursor, cursorFinished, compareKeys);
    if (compared === 0) {
        if (!stepDiffCursor(cursor))
            return undefined;
    }
    else if (compared < 0) {
        (0, b_tree_1.check)(false, 'cursor walk terminated early');
    }
    return stepToEnd(cursor, callback);
};
var stepToEnd = function (cursor, callback) {
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
};
var makeDiffCursor = function (tree, internals) {
    var root = internals._root;
    return {
        height: tree.height,
        internalSpine: [[root]],
        levelIndices: [0],
        leaf: undefined,
        currentKey: root.maxKey()
    };
};
var stepDiffCursor = function (cursor, stepToNode) {
    var internalSpine = cursor.internalSpine, levelIndices = cursor.levelIndices, leaf = cursor.leaf;
    if (stepToNode === true || leaf) {
        var levelsLength = levelIndices.length;
        if (stepToNode === true || levelIndices[levelsLength - 1] === 0) {
            var spineLength = internalSpine.length;
            if (spineLength === 0)
                return false;
            var nodeLevelIndex = spineLength - 1;
            var levelIndexWalkBack = nodeLevelIndex;
            while (levelIndexWalkBack >= 0) {
                if (levelIndices[levelIndexWalkBack] > 0) {
                    if (levelIndexWalkBack < levelsLength - 1) {
                        cursor.leaf = undefined;
                        levelIndices.pop();
                    }
                    if (levelIndexWalkBack < nodeLevelIndex)
                        cursor.internalSpine = internalSpine.slice(0, levelIndexWalkBack + 1);
                    cursor.currentKey = internalSpine[levelIndexWalkBack][--levelIndices[levelIndexWalkBack]].maxKey();
                    return true;
                }
                levelIndexWalkBack--;
            }
            return false;
        }
        else {
            var valueIndex = --levelIndices[levelsLength - 1];
            cursor.currentKey = leaf.keys[valueIndex];
            return true;
        }
    }
    else {
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
};
var compareDiffCursors = function (cursorA, cursorB, compareKeys) {
    var heightA = cursorA.height, currentKeyA = cursorA.currentKey, levelIndicesA = cursorA.levelIndices;
    var heightB = cursorB.height, currentKeyB = cursorB.currentKey, levelIndicesB = cursorB.levelIndices;
    var keyComparison = compareKeys(currentKeyB, currentKeyA);
    if (keyComparison !== 0)
        return keyComparison;
    var heightMin = heightA < heightB ? heightA : heightB;
    var depthANormalized = levelIndicesA.length - (heightA - heightMin);
    var depthBNormalized = levelIndicesB.length - (heightB - heightMin);
    return depthANormalized - depthBNormalized;
};
exports.default = diffAgainst;
