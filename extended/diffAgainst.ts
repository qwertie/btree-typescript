import BTree from '../b+tree';
import { BNode, BNodeInternal, check } from '../b+tree';
import { createCursor, Cursor, getKey, moveForwardOne, moveTo, noop } from './parallelWalk';
import { checkCanDoSetOperation, type BTreeWithInternals } from './shared';

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
export default function diffAgainst<K, V, R>(
  _treeA: BTree<K, V>,
  _treeB: BTree<K, V>,
  onlyA?: (k: K, v: V) => { break?: R } | void,
  onlyB?: (k: K, v: V) => { break?: R } | void,
  different?: (k: K, vA: V, vB: V) => { break?: R } | void
): R | undefined {
  const treeA = _treeA as unknown as BTreeWithInternals<K, V>;
  const treeB = _treeB as unknown as BTreeWithInternals<K, V>;
  checkCanDoSetOperation(treeA, treeB, true);

  // During the downward walk of the cursors, this will be assigned the index of the highest node that is shared between the two trees
  // along the paths of the two cursors.
  let highestSharedIndex: number = -1;

  const onExitLeaf = () => {
    highestSharedIndex = -1;
  }

  const maybeSetHighest = (
    node: BNodeInternal<K, V>,
    height: number,
    spineIndex: number,
    cursorOther: Cursor<K, V, DiffPayload<K, V, R>>
  ) => {
    if (highestSharedIndex < 0) {
      const heightOther = cursorOther.spine.length;
      if (height <= heightOther) {
        const depthOther = heightOther - height;
        if (depthOther >= 0) {
          const otherNode = cursorOther.spine[depthOther].node;
          if (otherNode === node) {
            highestSharedIndex = spineIndex;
          }
        }
      }
    }
  }

  const onStepUp = (
    parent: BNodeInternal<K, V>,
    height: number,
    _: DiffPayload<K, V, R>,
    __: number,
    spineIndex: number,
    stepDownIndex: number,
    ___: Cursor<K, V, DiffPayload<K, V, R>>,
    cursorOther: Cursor<K, V, DiffPayload<K, V, R>>
  ) => {
    check(highestSharedIndex < 0, "Shared nodes should have been skipped");
    if (stepDownIndex > 0) {
      maybeSetHighest(parent, height, spineIndex, cursorOther);
    }
  };

  const onStepDown = (
    node: BNodeInternal<K, V>,
    height: number,
    spineIndex: number,
    _: number,
    __: Cursor<K, V, DiffPayload<K, V, R>>,
    cursorOther: Cursor<K, V, DiffPayload<K, V, R>>
  ) => {
    maybeSetHighest(node, height, spineIndex, cursorOther);
  };

  const onEnterLeaf = (
    leaf: BNode<K, V>,
    _: number,
    cursorThis: Cursor<K, V, DiffPayload<K, V, R>>,
    cursorOther: Cursor<K, V, DiffPayload<K, V, R>>
  ) => {
    if (highestSharedIndex < 0) {
      if (cursorOther.leaf === leaf) {
        highestSharedIndex = cursorThis.spine.length - 1;
      }
    }
  };

  const cmp = treeA._compare;
  // Need the max key of both trees to perform the "finishing" walk of which ever cursor finishes second
  const maxKeyLeft = treeA.maxKey() as K;
  const maxKeyRight = treeB.maxKey() as K;
  const maxKey = cmp(maxKeyLeft, maxKeyRight) >= 0 ? maxKeyLeft : maxKeyRight;

  const payloadA = { only: onlyA ? onlyA : () => {} };
  const payloadB = { only: onlyB ? onlyB : () => {} };
  const curA = createCursor<K, V, DiffPayload<K, V, R>>(treeA, () => payloadA, onEnterLeaf, noop, onExitLeaf, onStepUp, onStepDown);
  const curB = createCursor<K, V, DiffPayload<K, V, R>>(treeB, () => payloadB, onEnterLeaf, noop, onExitLeaf, onStepUp, onStepDown);

  for (let depth = 0; depth < curA.spine.length - 1; depth++) {
    onStepDown(
      curA.spine[depth].node,
      curA.spine.length - depth,
      depth,
      curA.spine[depth].childIndex,
      curA,
      curB
    );
  }
  onEnterLeaf(curA.leaf, curA.leafIndex, curA, curB);

  let leading = curA;
  let trailing = curB;
  let order = cmp(getKey(leading), getKey(trailing));

  // Walk both cursors in alternating hops
  while (true) {
    const areEqual = order === 0;

    if (areEqual) {
      const key = getKey(leading);
      const vA = curA.leaf.values[curA.leafIndex];
      const vB = curB.leaf.values[curB.leafIndex];
      const combined = different ? different(key, vA, vB) : undefined;
      if (combined && combined.break) {
        return combined.break;
      }
      const outTrailing = moveForwardOne(trailing, leading, key, cmp);
      const outLeading = moveForwardOne(leading, trailing, key, cmp);
      if (outTrailing || outLeading) {
        if (!outTrailing || !outLeading) {
          // In these cases, we pass areEqual=false because a return value of "out of tree" means
          // the cursor did not move. This must be true because they started equal and one of them had more tree
          // to walk (one is !out), so they cannot be equal at this point.
          if (outTrailing) {
            finishWalk(leading, trailing);
          } else {
            finishWalk(trailing, leading);
          }
        }
        break;
      }
      order = cmp(getKey(leading), getKey(trailing));
    } else {
      if (order < 0) {
        const tmp = trailing;
        trailing = leading;
        leading = tmp;
      }
      const [out, nowEqual] = moveTo(trailing, leading, getKey(leading), true, areEqual, cmp);
      if (out) {
        return finishWalk(leading, trailing);
      } else if (nowEqual) {
        order = 0;
      } else {
        order = -1;
      }
    }
  }
}

function finishWalk<K, V, R>(
  toFinish: Cursor<K, V, DiffPayload<K, V, R>>,
  done: Cursor<K, V, DiffPayload<K, V, R>>
): R | undefined {
  let outOfTree: boolean;
  do {
    outOfTree = moveForwardOne(toFinish, done, getKey(done), toFinish.tree._compare);
    if (!outOfTree) {
      const key = getKey(toFinish);
      const value = toFinish.leaf.values[toFinish.leafIndex];
      const result = toFinish.leafPayload.only(key, value);
      if (result && result.break) {
        return result.break;
      }
    }
  } while (!outOfTree);
  return undefined;
}

type DiffPayload<K, V, R> = { only: (k: K, v: V) => { break?: R } | void};

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
export function diffAgainst2<K, V, R>(
  _treeA: BTree<K, V>,
  _treeB: BTree<K, V>,
  onlyA?: (k: K, v: V) => { break?: R } | void,
  onlyB?: (k: K, v: V) => { break?: R } | void,
  different?: (k: K, vThis: V, vOther: V) => { break?: R } | void
): R | undefined {
  const treeA = _treeA as unknown as BTreeWithInternals<K, V>;
  const treeB = _treeB as unknown as BTreeWithInternals<K, V>;
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
  const compareKeys = treeA._compare;
  const thisCursor = makeDiffCursor(treeA);
  const otherCursor = makeDiffCursor(treeB);
  let thisSuccess = true;
  let otherSuccess = true;
  // It doesn't matter how thisSteppedLast is initialized.
  // Step order is only used when either cursor is at a leaf, and cursors always start at a node.
  let prevCursorOrder = compareDiffCursors(thisCursor, otherCursor, compareKeys);
  while (thisSuccess && otherSuccess) {
    const cursorOrder = compareDiffCursors(thisCursor, otherCursor, compareKeys);
    const { leaf: thisLeaf, internalSpine: thisInternalSpine, levelIndices: thisLevelIndices } = thisCursor;
    const { leaf: otherLeaf, internalSpine: otherInternalSpine, levelIndices: otherLevelIndices } = otherCursor;
    if (thisLeaf || otherLeaf) {
      // If the cursors were at the same location last step, then there is no work to be done.
      if (prevCursorOrder !== 0) {
        if (cursorOrder === 0) {
          if (thisLeaf && otherLeaf && different) {
            // Equal keys, check for modifications
            const valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
            const valOther = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
            if (!Object.is(valThis, valOther)) {
              const result = different(thisCursor.currentKey, valThis, valOther);
              if (result && result.break)
                return result.break;
            }
          }
        } else if (cursorOrder > 0) {
          // If this is the case, we know that either:
          // 1. otherCursor stepped last from a starting position that trailed thisCursor, and is still behind, or
          // 2. thisCursor stepped last and leapfrogged otherCursor
          // Either of these cases is an "only other"
          if (otherLeaf && onlyB) {
            const otherVal = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
            const result = onlyB(otherCursor.currentKey, otherVal);
            if (result && result.break)
              return result.break;
          }
        } else if (onlyA) {
          if (thisLeaf && prevCursorOrder !== 0) {
            const valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
            const result = onlyA(thisCursor.currentKey, valThis);
            if (result && result.break)
              return result.break;
          }
        }
      }
    } else if (!thisLeaf && !otherLeaf && cursorOrder === 0) {
      const lastThis = thisInternalSpine.length - 1;
      const lastOther = otherInternalSpine.length - 1;
      const nodeThis = thisInternalSpine[lastThis][thisLevelIndices[lastThis]];
      const nodeOther = otherInternalSpine[lastOther][otherLevelIndices[lastOther]];
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
    } else {
      otherSuccess = stepDiffCursor(otherCursor);
    }
  }

  if (thisSuccess && onlyA)
    return finishCursorWalk(thisCursor, otherCursor, compareKeys, onlyA);
  if (otherSuccess && onlyB)
    return finishCursorWalk(otherCursor, thisCursor, compareKeys, onlyB);
  return undefined;
}

/**
 * Finishes walking `cursor` once the other cursor has already completed its walk.
 */
function finishCursorWalk<K, V, R>(
  cursor: DiffCursor<K, V>,
  cursorFinished: DiffCursor<K, V>,
  compareKeys: (a: K, b: K) => number,
  callback: (k: K, v: V) => { break?: R } | void
): R | undefined {
  const compared = compareDiffCursors(cursor, cursorFinished, compareKeys);
  if (compared === 0) {
    if (!stepDiffCursor(cursor))
      return undefined;
  } else if (compared < 0) {
    check(false, 'cursor walk terminated early');
  }
  return stepToEnd(cursor, callback);
}

/**
 * Walks the cursor to the end of the tree, invoking the callback for each key/value pair.
 */
function stepToEnd<K, V, R>(
  cursor: DiffCursor<K, V>,
  callback: (k: K, v: V) => { break?: R } | void
): R | undefined {
  let canStep = true;
  while (canStep) {
    const { leaf, levelIndices, currentKey } = cursor;
    if (leaf) {
      const value = leaf.values[levelIndices[levelIndices.length - 1]];
      const result = callback(currentKey, value);
      if (result && result.break)
        return result.break;
    }
    canStep = stepDiffCursor(cursor);
  }
  return undefined;
}

function makeDiffCursor<K, V>(
  internal: BTreeWithInternals<K, V>
): DiffCursor<K, V> {
  const root = internal._root;
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
function stepDiffCursor<K, V>(cursor: DiffCursor<K, V>, stepToNode?: boolean): boolean {
  const { internalSpine, levelIndices, leaf } = cursor;
  if (stepToNode === true || leaf) {
    const levelsLength = levelIndices.length;
    // Step to the next node only if:
    // - We are explicitly directed to via stepToNode, or
    // - There are no key/value pairs left to step to in this leaf
    if (stepToNode === true || levelIndices[levelsLength - 1] === 0) {
      const spineLength = internalSpine.length;
      if (spineLength === 0)
        return false;
      // Walk back up the tree until we find a new subtree to descend into
      const nodeLevelIndex = spineLength - 1;
      let levelIndexWalkBack = nodeLevelIndex;
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
    } else {
      // Move to new leaf value
      const valueIndex = --levelIndices[levelsLength - 1];
      cursor.currentKey = (leaf as BNode<K, V>).keys[valueIndex];
      return true;
    }
  } else { // Cursor does not point to a value in a leaf, so move downwards
    const nextLevel = internalSpine.length;
    const currentLevel = nextLevel - 1;
    const node = internalSpine[currentLevel][levelIndices[currentLevel]];
    if (node.isLeaf) {
      cursor.leaf = node;
      const valueIndex = (levelIndices[nextLevel] = node.values.length - 1);
      cursor.currentKey = node.keys[valueIndex];
    } else {
      const children = (node as BNodeInternal<K, V>).children;
      internalSpine[nextLevel] = children;
      const childIndex = children.length - 1;
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
function compareDiffCursors<K, V>(
  cursorA: DiffCursor<K, V>,
  cursorB: DiffCursor<K, V>,
  compareKeys: (a: K, b: K) => number
): number {
  const { height: heightA, currentKey: currentKeyA, levelIndices: levelIndicesA } = cursorA;
  const { height: heightB, currentKey: currentKeyB, levelIndices: levelIndicesB } = cursorB;
  // Reverse the comparison order, as cursors are advanced in reverse sorting order
  const keyComparison = compareKeys(currentKeyB, currentKeyA);
  if (keyComparison !== 0)
    return keyComparison;

  // Normalize depth values relative to the shortest tree.
  // This ensures that concurrent cursor walks of trees of differing heights can reliably land on shared nodes at the same time.
  // To accomplish this, a cursor that is on an internal node at depth D1 with maxKey X is considered "behind" a cursor on an
  // internal node at depth D2 with maxKey Y, when D1 < D2. Thus, always walking the cursor that is "behind" will allow the cursor
  // at shallower depth (but equal maxKey) to "catch up" and land on shared nodes.
  const heightMin = heightA < heightB ? heightA : heightB;
  const depthANormalized = levelIndicesA.length - (heightA - heightMin);
  const depthBNormalized = levelIndicesB.length - (heightB - heightMin);
  return depthANormalized - depthBNormalized;
}

/**
 * A walkable pointer into a BTree for computing efficient diffs between trees with shared data.
 * - A cursor points to either a key/value pair (KVP) or a node (which can be either a leaf or an internal node).
 *   As a consequence, a cursor cannot be created for an empty tree.
 * - A cursor can be walked forwards using `step`. A cursor can be compared to another cursor to
 *   determine which is ahead in advancement.
 * - A cursor is valid only for the tree it was created from, and only until the first edit made to
 *   that tree since the cursor's creation.
 * - A cursor contains a key for the current location, which is the maxKey when the cursor points to a node
 *   and a key corresponding to a value when pointing to a leaf.
 * - Leaf is only populated if the cursor points to a KVP. If this is the case, levelIndices.length === internalSpine.length + 1
 *   and levelIndices[levelIndices.length - 1] is the index of the value.
 */
type DiffCursor<K, V> = {
  height: number;
  internalSpine: BNode<K, V>[][];
  levelIndices: number[];
  leaf: BNode<K, V> | undefined;
  currentKey: K;
};

