"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFromDecomposition = exports.decompose = void 0;
var b_tree_1 = require("../b+tree");
var shared_1 = require("./shared");
var parallelWalk_1 = require("./parallelWalk");
/**
 * Decomposes two trees into disjoint nodes. Reuses interior nodes when they do not overlap/intersect with any leaf nodes
 * in the other tree. Overlapping leaf nodes are broken down into new leaf nodes containing merged entries.
 * The algorithm is a parallel tree walk using two cursors. The trailing cursor (behind in key space) is walked forward
 * until it is at or after the leading cursor. As it does this, any whole nodes or subtrees it passes are guaranteed to
 * be disjoint. This is true because the leading cursor was also previously walked in this way, and is thus pointing to
 * the first key at or after the trailing cursor's previous position.
 * The cursor walk is efficient, meaning it skips over disjoint subtrees entirely rather than visiting every leaf.
 * @internal
 */
function decompose(left, right, combineFn, ignoreRight) {
    if (ignoreRight === void 0) { ignoreRight = false; }
    var cmp = left._compare;
    (0, b_tree_1.check)(left._root.size() > 0 && right._root.size() > 0, "decompose requires non-empty inputs");
    // Holds the disjoint nodes that result from decomposition.
    // Alternating entries of (height, node) to avoid creating small tuples
    var disjoint = (0, shared_1.createAlternatingList)();
    // During the decomposition, leaves that are not disjoint are decomposed into individual entries
    // that accumulate in this array in sorted order. They are flushed into leaf nodes whenever a reused
    // disjoint subtree is added to the disjoint set.
    // Note that there are unavoidable cases in which this will generate underfilled leaves.
    // An example of this would be a leaf in one tree that contained keys [0, 100, 101, 102].
    // In the other tree, there is a leaf that contains [2, 3, 4, 5]. This leaf can be reused entirely,
    // but the first tree's leaf must be decomposed into [0] and [100, 101, 102]
    var pending = (0, shared_1.createAlternatingList)();
    var tallestIndex = -1, tallestHeight = -1;
    // During the upward part of the cursor walk, this holds the highest disjoint node seen so far.
    // This is done because we cannot know immediately whether we can add the node to the disjoint set
    // because its ancestor may also be disjoint and should be reused instead.
    var highestDisjoint = undefined;
    var onLeafCreation = function (leaf) {
        (0, shared_1.alternatingPush)(disjoint, 0, leaf);
    };
    var flushPendingEntries = function () {
        var createdLeaves = (0, shared_1.flushToLeaves)(pending, left._maxNodeSize, onLeafCreation);
        if (createdLeaves > 0) {
            tallestIndex = (0, shared_1.alternatingCount)(disjoint) - 1;
            tallestHeight = 0;
        }
    };
    var addSharedNodeToDisjointSet = function (node, height) {
        flushPendingEntries();
        node.isShared = true;
        (0, shared_1.alternatingPush)(disjoint, height, node);
        if (height > tallestHeight) {
            tallestIndex = (0, shared_1.alternatingCount)(disjoint) - 1;
            tallestHeight = height;
        }
    };
    var addHighestDisjoint = function () {
        if (highestDisjoint !== undefined) {
            addSharedNodeToDisjointSet(highestDisjoint.node, highestDisjoint.height);
            highestDisjoint = undefined;
        }
    };
    // Mark all nodes at or above depthFrom in the cursor spine as disqualified (non-disjoint)
    var disqualifySpine = function (cursor, depthFrom) {
        var spine = cursor.spine;
        for (var i = depthFrom; i >= 0; --i) {
            var payload = spine[i].payload;
            // Safe to early out because we always disqualify all ancestors of a disqualified node
            // That is correct because every ancestor of a non-disjoint node is also non-disjoint
            // because it must enclose the non-disjoint range.
            if (payload.disqualified)
                break;
            payload.disqualified = true;
        }
    };
    // Cursor payload factory
    var makePayload = function () { return ({ disqualified: false }); };
    var pushLeafRange = function (leaf, from, toExclusive) {
        var keys = leaf.keys;
        var values = leaf.values;
        for (var i = from; i < toExclusive; ++i)
            (0, shared_1.alternatingPush)(pending, keys[i], values[i]);
    };
    var onMoveInLeaf = function (leaf, payload, fromIndex, toIndex, startedEqual) {
        (0, b_tree_1.check)(payload.disqualified === true, "onMoveInLeaf: leaf must be disqualified");
        var start = startedEqual ? fromIndex + 1 : fromIndex;
        if (start < toIndex)
            pushLeafRange(leaf, start, toIndex);
    };
    var onExitLeaf = function (leaf, payload, startingIndex, startedEqual, cursorThis) {
        highestDisjoint = undefined;
        if (!payload.disqualified) {
            highestDisjoint = { node: leaf, height: 0 };
            if (cursorThis.spine.length === 0) {
                // if we are exiting a leaf and there are no internal nodes, we will reach the end of the tree.
                // In this case we need to add the leaf now because step up will not be called.
                addHighestDisjoint();
            }
        }
        else {
            var start = startedEqual ? startingIndex + 1 : startingIndex;
            var leafSize = leaf.keys.length;
            if (start < leafSize)
                pushLeafRange(leaf, start, leafSize);
        }
    };
    var onStepUp = function (parent, height, payload, fromIndex, spineIndex, stepDownIndex, cursorThis) {
        var children = parent.children;
        var nextHeight = height - 1;
        if (stepDownIndex !== stepDownIndex /* NaN: still walking up */
            || stepDownIndex === Number.POSITIVE_INFINITY /* target key is beyond edge of tree, done with walk */) {
            if (!payload.disqualified) {
                highestDisjoint = { node: parent, height: height };
                if (stepDownIndex === Number.POSITIVE_INFINITY) {
                    // We have finished our walk, and we won't be stepping down, so add the root
                    addHighestDisjoint();
                }
            }
            else {
                addHighestDisjoint();
                var len = children.length;
                for (var i = fromIndex + 1; i < len; ++i)
                    addSharedNodeToDisjointSet(children[i], nextHeight);
            }
        }
        else {
            // We have a valid step down index, so we need to disqualify the spine if needed.
            // This is identical to the step down logic, but we must also perform it here because
            // in the case of stepping down into a leaf, the step down callback is never called.
            if (stepDownIndex > 0) {
                disqualifySpine(cursorThis, spineIndex);
            }
            addHighestDisjoint();
            for (var i = fromIndex + 1; i < stepDownIndex; ++i)
                addSharedNodeToDisjointSet(children[i], nextHeight);
        }
    };
    var onStepDown = function (node, height, spineIndex, stepDownIndex, cursorThis) {
        if (stepDownIndex > 0) {
            // When we step down into a node, we know that we have walked from a key that is less than our target.
            // Because of this, if we are not stepping down into the first child, we know that all children before
            // the stepDownIndex must overlap with the other tree because they must be before our target key. Since
            // the child we are stepping into has a key greater than our target key, this node must overlap.
            // If a child overlaps, the entire spine overlaps because a parent in a btree always encloses the range
            // of its children.
            disqualifySpine(cursorThis, spineIndex);
            var children = node.children;
            var nextHeight = height - 1;
            for (var i = 0; i < stepDownIndex; ++i)
                addSharedNodeToDisjointSet(children[i], nextHeight);
        }
    };
    var onEnterLeaf = function (leaf, destIndex, cursorThis, cursorOther) {
        if (destIndex > 0
            || (0, b_tree_1.areOverlapping)(leaf.minKey(), leaf.maxKey(), (0, parallelWalk_1.getKey)(cursorOther), cursorOther.leaf.maxKey(), cmp)) {
            // Similar logic to the step-down case, except in this case we also know the leaf in the other
            // tree overlaps a leaf in this tree (this leaf, specifically). Thus, we can disqualify both spines.
            cursorThis.leafPayload.disqualified = true;
            cursorOther.leafPayload.disqualified = true;
            disqualifySpine(cursorThis, cursorThis.spine.length - 1);
            disqualifySpine(cursorOther, cursorOther.spine.length - 1);
            pushLeafRange(leaf, 0, destIndex);
        }
    };
    // Need the max key of both trees to perform the "finishing" walk of which ever cursor finishes second
    var maxKeyLeft = left._root.maxKey();
    var maxKeyRight = right._root.maxKey();
    var maxKey = cmp(maxKeyLeft, maxKeyRight) >= 0 ? maxKeyLeft : maxKeyRight;
    // Initialize cursors at minimum keys.
    var curA = (0, parallelWalk_1.createCursor)(left, makePayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown);
    var curB;
    if (ignoreRight) {
        var dummyPayload_1 = { disqualified: true };
        var onStepUpIgnore = function (_1, _2, _3, _4, spineIndex, stepDownIndex, cursorThis) {
            if (stepDownIndex > 0) {
                disqualifySpine(cursorThis, spineIndex);
            }
        };
        var onStepDownIgnore = function (_, __, spineIndex, stepDownIndex, cursorThis) {
            if (stepDownIndex > 0) {
                disqualifySpine(cursorThis, spineIndex);
            }
        };
        var onEnterLeafIgnore = function (leaf, destIndex, _, cursorOther) {
            if (destIndex > 0
                || (0, b_tree_1.areOverlapping)(leaf.minKey(), leaf.maxKey(), (0, parallelWalk_1.getKey)(cursorOther), cursorOther.leaf.maxKey(), cmp)) {
                cursorOther.leafPayload.disqualified = true;
                disqualifySpine(cursorOther, cursorOther.spine.length - 1);
            }
        };
        curB = (0, parallelWalk_1.createCursor)(right, function () { return dummyPayload_1; }, onEnterLeafIgnore, parallelWalk_1.noop, parallelWalk_1.noop, onStepUpIgnore, onStepDownIgnore);
    }
    else {
        curB = (0, parallelWalk_1.createCursor)(right, makePayload, onEnterLeaf, onMoveInLeaf, onExitLeaf, onStepUp, onStepDown);
    }
    // The guarantee that no overlapping interior nodes are accidentally reused relies on the careful
    // alternating hopping walk of the cursors: WLOG, cursorA always--with one exception--walks from a key just behind (in key space)
    // the key of cursorB to the first key >= cursorB. Call this transition a "crossover point." All interior nodes that
    // overlap cause a crossover point, and all crossover points are guaranteed to be walked using this method. Thus,
    // all overlapping interior nodes will be found if they are checked for on step-down.
    // The one exception mentioned above is when they start at the same key. In this case, they are both advanced forward and then
    // their new ordering determines how they walk from there.
    // The one issue then is detecting any overlaps that occur based on their very initial position (minimum key of each tree).
    // This is handled by the initial disqualification step below, which essentially emulates the step down disqualification for each spine.
    // Initialize disqualification w.r.t. opposite leaf.
    var initDisqualify = function (cur, other) {
        var minKey = (0, parallelWalk_1.getKey)(cur);
        var otherMin = (0, parallelWalk_1.getKey)(other);
        var otherMax = other.leaf.maxKey();
        if ((0, b_tree_1.areOverlapping)(minKey, cur.leaf.maxKey(), otherMin, otherMax, cmp))
            cur.leafPayload.disqualified = true;
        for (var i = 0; i < cur.spine.length; ++i) {
            var entry = cur.spine[i];
            // Since we are on the left side of the tree, we can use the leaf min key for every spine node
            if ((0, b_tree_1.areOverlapping)(minKey, entry.node.maxKey(), otherMin, otherMax, cmp))
                entry.payload.disqualified = true;
        }
    };
    initDisqualify(curA, curB);
    initDisqualify(curB, curA);
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
            // Perform the actual merge of values here. The cursors will avoid adding a duplicate of this key/value
            // to pending because they respect the areEqual flag during their moves.
            var combined = combineFn(key, vA, vB);
            if (combined !== undefined)
                (0, shared_1.alternatingPush)(pending, key, combined);
            var outTrailing = (0, parallelWalk_1.moveForwardOne)(trailing, leading);
            var outLeading = (0, parallelWalk_1.moveForwardOne)(leading, trailing);
            if (outTrailing || outLeading) {
                if (!outTrailing || !outLeading) {
                    // In these cases, we pass areEqual=false because a return value of "out of tree" means
                    // the cursor did not move. This must be true because they started equal and one of them had more tree
                    // to walk (one is !out), so they cannot be equal at this point.
                    if (outTrailing) {
                        (0, parallelWalk_1.moveTo)(leading, trailing, maxKey, false, false);
                    }
                    else {
                        (0, parallelWalk_1.moveTo)(trailing, leading, maxKey, false, false);
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
            var _a = (0, parallelWalk_1.moveTo)(trailing, leading, (0, parallelWalk_1.getKey)(leading), true, areEqual), out = _a[0], nowEqual = _a[1];
            if (out) {
                (0, parallelWalk_1.moveTo)(leading, trailing, maxKey, false, areEqual);
                break;
            }
            else if (nowEqual) {
                order = 0;
            }
            else {
                order = -1;
            }
        }
    }
    // Ensure any trailing non-disjoint entries are added
    flushPendingEntries();
    return { disjoint: disjoint, tallestIndex: tallestIndex };
}
exports.decompose = decompose;
/**
 * Constructs a B-Tree from the result of a decomposition (set of disjoint nodes).
 * @internal
 */
function buildFromDecomposition(constructor, branchingFactor, decomposed, cmp, maxNodeSize) {
    var disjoint = decomposed.disjoint, tallestIndex = decomposed.tallestIndex;
    var disjointEntryCount = (0, shared_1.alternatingCount)(disjoint);
    // Now we have a set of disjoint subtrees and we need to merge them into a single tree.
    // To do this, we start with the tallest subtree from the disjoint set and, for all subtrees
    // to the "right" and "left" of it in sorted order, we append them onto the appropriate side
    // of the current tree, splitting nodes as necessary to maintain balance.
    // A "side" is referred to as a frontier, as it is a linked list of nodes from the root down to
    // the leaf level on that side of the tree. Each appended subtree is appended to the node at the
    // same height as itself on the frontier. Each tree is guaranteed to be at most as tall as the
    // current frontier because we start from the tallest subtree and work outward.
    var initialRoot = (0, shared_1.alternatingGetSecond)(disjoint, tallestIndex);
    var frontier = [initialRoot];
    // Process all subtrees to the right of the tallest subtree
    if (tallestIndex + 1 <= disjointEntryCount - 1) {
        updateFrontier(frontier, 0, getRightmostIndex);
        processSide(branchingFactor, disjoint, frontier, tallestIndex + 1, disjointEntryCount, 1, getRightmostIndex, getRightInsertionIndex, splitOffRightSide, updateRightMax);
    }
    // Process all subtrees to the left of the current tree
    if (tallestIndex - 1 >= 0) {
        // Note we need to update the frontier here because the right-side processing may have grown the tree taller.
        updateFrontier(frontier, 0, getLeftmostIndex);
        processSide(branchingFactor, disjoint, frontier, tallestIndex - 1, -1, -1, getLeftmostIndex, getLeftmostIndex, splitOffLeftSide, parallelWalk_1.noop // left side appending doesn't update max keys
        );
    }
    var reconstructed = new constructor(undefined, cmp, maxNodeSize);
    reconstructed._root = frontier[0];
    // Return the resulting tree
    return reconstructed;
}
exports.buildFromDecomposition = buildFromDecomposition;
/**
 * Processes one side (left or right) of the disjoint subtree set during a reconstruction operation.
 * Merges each subtree in the disjoint set from start to end (exclusive) into the given spine.
 * @internal
 */
function processSide(branchingFactor, disjoint, spine, start, end, step, sideIndex, sideInsertionIndex, splitOffSide, updateMax) {
    // Determine the depth of the first shared node on the frontier.
    // Appending subtrees to the frontier must respect the copy-on-write semantics by cloning
    // any shared nodes down to the insertion point. We track it by depth to avoid a log(n) walk of the
    // frontier for each insertion as that would fundamentally change our asymptotics.
    var isSharedFrontierDepth = 0;
    var cur = spine[0];
    // Find the first shared node on the frontier
    while (!cur.isShared && isSharedFrontierDepth < spine.length - 1) {
        isSharedFrontierDepth++;
        cur = cur.children[sideIndex(cur)];
    }
    // This array holds the sum of sizes of nodes that have been inserted but not yet propagated upward.
    // For example, if a subtree of size 5 is inserted at depth 2, then unflushedSizes[1] += 5.
    // These sizes are added to the depth above the insertion point because the insertion updates the direct parent of the insertion.
    // These sizes are flushed upward any time we need to insert at level higher than pending unflushed sizes.
    // E.g. in our example, if we later insert at depth 0, we will add 5 to the node at depth 1 and the root at depth 0 before inserting.
    // This scheme enables us to avoid a log(n) propagation of sizes for each insertion.
    var unflushedSizes = new Array(spine.length).fill(0); // pre-fill to avoid "holey" array
    for (var i = start; i != end; i += step) {
        var currentHeight = spine.length - 1; // height is number of internal levels; 0 means leaf
        var subtree = (0, shared_1.alternatingGetSecond)(disjoint, i);
        var subtreeHeight = (0, shared_1.alternatingGetFirst)(disjoint, i);
        var insertionDepth = currentHeight - (subtreeHeight + 1); // node at this depth has children of height 'subtreeHeight'
        // Ensure path is unshared before mutation
        ensureNotShared(spine, isSharedFrontierDepth, insertionDepth, sideIndex);
        // Calculate expansion depth (first ancestor with capacity)
        var expansionDepth = Math.max(0, findCascadeEndDepth(spine, insertionDepth, branchingFactor));
        // Update sizes on spine above the shared ancestor before we expand
        updateSizeAndMax(spine, unflushedSizes, isSharedFrontierDepth, expansionDepth, updateMax);
        // Append and cascade splits upward
        var newRoot = appendAndCascade(spine, insertionDepth, branchingFactor, subtree, sideIndex, sideInsertionIndex, splitOffSide);
        if (newRoot) {
            // Set the spine root to the highest up new node; the rest of the spine is updated below
            spine[0] = newRoot;
            unflushedSizes.forEach(function (count) { return (0, b_tree_1.check)(count === 0, "Unexpected unflushed size after root split."); });
            unflushedSizes.push(0); // new root level
            isSharedFrontierDepth = insertionDepth + 2;
            unflushedSizes[insertionDepth + 1] += subtree.size();
        }
        else {
            isSharedFrontierDepth = insertionDepth + 1;
            unflushedSizes[insertionDepth] += subtree.size();
        }
        // Finally, update the frontier from the highest new node downward
        // Note that this is often the point where the new subtree is attached,
        // but in the case of cascaded splits it may be higher up.
        updateFrontier(spine, expansionDepth, sideIndex);
        (0, b_tree_1.check)(isSharedFrontierDepth === spine.length - 1 || spine[isSharedFrontierDepth].isShared === true, "Non-leaf subtrees must be shared.");
        (0, b_tree_1.check)(unflushedSizes.length === spine.length, "Unflushed sizes length mismatch after root split.");
    }
    // Finally, propagate any remaining unflushed sizes upward and update max keys
    updateSizeAndMax(spine, unflushedSizes, isSharedFrontierDepth, 0, updateMax);
}
;
/**
 * Append a subtree at a given depth on the chosen side; cascade splits upward if needed.
 * All un-propagated sizes must have already been applied to the spine up to the end of any cascading expansions.
 * This method guarantees that the size of the inserted subtree will not propagate upward beyond the insertion point.
 * Returns a new root if the root was split, otherwise undefined.
 */
function appendAndCascade(spine, insertionDepth, branchingFactor, subtree, sideIndex, sideInsertionIndex, splitOffSide) {
    // We must take care to avoid accidental propagation upward of the size of the inserted su
    // To do this, we first split nodes upward from the insertion point until we find a node with capacity
    // or create a new root. Since all un-propagated sizes have already been applied to the spine up to this point,
    // inserting at the end ensures no accidental propagation.
    // Depth is -1 if the subtree is the same height as the current tree
    if (insertionDepth >= 0) {
        var carry = undefined;
        // Determine initially where to insert after any splits
        var insertTarget = spine[insertionDepth];
        if (insertTarget.keys.length >= branchingFactor) {
            insertTarget = carry = splitOffSide(insertTarget);
        }
        var d = insertionDepth - 1;
        while (carry && d >= 0) {
            var parent = spine[d];
            var idx = sideIndex(parent);
            // Refresh last key since child was split
            parent.keys[idx] = parent.children[idx].maxKey();
            if (parent.keys.length < branchingFactor) {
                // We have reached the end of the cascade
                insertNoCount(parent, sideInsertionIndex(parent), carry);
                carry = undefined;
            }
            else {
                // Splitting the parent here requires care to avoid incorrectly double counting sizes
                // Example: a node is at max capacity 4, with children each of size 4 for 16 total.
                // We split the node into two nodes of 2 children each, but this does *not* modify the size
                // of its parent. Therefore when we insert the carry into the torn-off node, we must not
                // increase its size or we will double-count the size of the carry su
                var tornOff = splitOffSide(parent);
                insertNoCount(tornOff, sideInsertionIndex(tornOff), carry);
                carry = tornOff;
            }
            d--;
        }
        var newRoot = undefined;
        if (carry !== undefined) {
            // Expansion reached the root, need a new root to hold carry
            var oldRoot = spine[0];
            newRoot = new b_tree_1.BNodeInternal([oldRoot], oldRoot.size() + carry.size());
            insertNoCount(newRoot, sideInsertionIndex(newRoot), carry);
        }
        // Finally, insert the subtree at the insertion point
        insertNoCount(insertTarget, sideInsertionIndex(insertTarget), subtree);
        return newRoot;
    }
    else {
        // Insertion of subtree with equal height to current tree
        var oldRoot = spine[0];
        var newRoot = new b_tree_1.BNodeInternal([oldRoot], oldRoot.size());
        insertNoCount(newRoot, sideInsertionIndex(newRoot), subtree);
        return newRoot;
    }
}
;
/**
 * Clone along the spine from [isSharedFrontierDepth to depthTo] inclusive so path is safe to mutate.
 * Short-circuits if first shared node is deeper than depthTo (the insertion depth).
 */
function ensureNotShared(spine, isSharedFrontierDepth, depthToInclusive, sideIndex) {
    if (spine.length === 1 /* only a leaf */ || depthToInclusive < 0 /* new root case */)
        return; // nothing to clone when root is a leaf; equal-height case will handle this
    // Clone root if needed first (depth 0)
    if (isSharedFrontierDepth === 0) {
        var root = spine[0];
        spine[0] = root.clone();
    }
    // Clone downward along the frontier to 'depthToInclusive'
    for (var depth = Math.max(isSharedFrontierDepth, 1); depth <= depthToInclusive; depth++) {
        var parent = spine[depth - 1];
        var childIndex = sideIndex(parent);
        var clone = parent.children[childIndex].clone();
        parent.children[childIndex] = clone;
        spine[depth] = clone;
    }
}
;
/**
 * Propagates size updates and updates max keys for nodes in (isSharedFrontierDepth, depthTo)
 */
function updateSizeAndMax(spine, unflushedSizes, isSharedFrontierDepth, depthUpToInclusive, updateMax) {
    // If isSharedFrontierDepth is <= depthUpToInclusive there is nothing to update because
    // the insertion point is inside a shared node which will always have correct sizes
    var maxKey = spine[isSharedFrontierDepth].maxKey();
    var startDepth = isSharedFrontierDepth - 1;
    for (var depth = startDepth; depth >= depthUpToInclusive; depth--) {
        var sizeAtLevel = unflushedSizes[depth];
        unflushedSizes[depth] = 0; // we are propagating it now
        if (depth > 0) {
            // propagate size upward, will be added lazily, either when a subtree is appended at or above that level or
            // at the end of processing the entire side
            unflushedSizes[depth - 1] += sizeAtLevel;
        }
        var node = spine[depth];
        node._size += sizeAtLevel;
        // No-op if left side, as max keys in parents are unchanged by appending to the beginning of a node
        updateMax(node, maxKey);
    }
}
;
/**
 * Update a spine (frontier) from a specific depth down, inclusive.
 * Extends the frontier array if it is not already as long as the frontier.
 */
function updateFrontier(frontier, depthLastValid, sideIndex) {
    (0, b_tree_1.check)(frontier.length > depthLastValid, "updateFrontier: depthLastValid exceeds frontier height");
    var startingAncestor = frontier[depthLastValid];
    if (startingAncestor.isLeaf)
        return;
    var internal = startingAncestor;
    var cur = internal.children[sideIndex(internal)];
    var depth = depthLastValid + 1;
    while (!cur.isLeaf) {
        var ni = cur;
        frontier[depth] = ni;
        cur = ni.children[sideIndex(ni)];
        depth++;
    }
    frontier[depth] = cur;
}
;
/**
 * Find the first ancestor (starting at insertionDepth) with capacity.
 */
function findCascadeEndDepth(spine, insertionDepth, branchingFactor) {
    for (var depth = insertionDepth; depth >= 0; depth--) {
        if (spine[depth].keys.length < branchingFactor)
            return depth;
    }
    return -1; // no capacity, will need a new root
}
;
/**
 * Inserts the child without updating cached size counts.
 */
function insertNoCount(parent, index, child) {
    parent.children.splice(index, 0, child);
    parent.keys.splice(index, 0, child.maxKey());
}
// ---- Side-specific delegates for merging subtrees into a frontier ----
function getLeftmostIndex() {
    return 0;
}
function getRightmostIndex(node) {
    return node.children.length - 1;
}
function getRightInsertionIndex(node) {
    return node.children.length;
}
function splitOffRightSide(node) {
    return node.splitOffRightSide();
}
function splitOffLeftSide(node) {
    return node.splitOffLeftSide();
}
function updateRightMax(node, maxBelow) {
    node.keys[node.keys.length - 1] = maxBelow;
}
