import BTree from '../core/index';
import { BNode, BNodeInternal } from '../internal/nodes';
import { check } from '../internal/assert';
import type { AdvancedTreeInternals } from './internals';

const getInternals = <K, V>(tree: BTree<K, V>): AdvancedTreeInternals<K, V> => {
  return tree as unknown as AdvancedTreeInternals<K, V>;
};

const wrapBaseTree = <K, V>(tree: BTree<K, V>): AdvancedBTree<K, V> => {
  const source = getInternals(tree);
  const wrapped = new AdvancedBTree<K, V>(undefined, source._compare, source._maxNodeSize);
  const target = getInternals(wrapped);
  target._root = source._root;
  target._size = source._size;
  return wrapped;
};

type DiffCursor<K, V> = {
  height: number;
  internalSpine: BNode<K, V>[][];
  levelIndices: number[];
  leaf: BNode<K, V> | undefined;
  currentKey: K;
};

export class AdvancedBTree<K = any, V = any> extends BTree<K, V> {
  clone(): AdvancedBTree<K, V> {
    return wrapBaseTree(super.clone());
  }

  greedyClone(force?: boolean): AdvancedBTree<K, V> {
    return wrapBaseTree(super.greedyClone(force));
  }

  diffAgainst<R>(
    other: BTree<K, V>,
    onlyThis?: (k: K, v: V) => { break?: R } | void,
    onlyOther?: (k: K, v: V) => { break?: R } | void,
    different?: (k: K, vThis: V, vOther: V) => { break?: R } | void
  ): R | undefined {
    const thisInternals = getInternals(this);
    const otherInternals = getInternals(other);
    if (otherInternals._compare !== thisInternals._compare) {
      throw new Error('Tree comparators are not the same.');
    }

    if (this.isEmpty || other.isEmpty) {
      if (this.isEmpty && other.isEmpty)
        return undefined;
      if (this.isEmpty) {
        return onlyOther === undefined
          ? undefined
          : AdvancedBTree.stepToEnd(
              AdvancedBTree.makeDiffCursor(other, otherInternals),
              onlyOther
            );
      }
      return onlyThis === undefined
        ? undefined
        : AdvancedBTree.stepToEnd(
            AdvancedBTree.makeDiffCursor(this, thisInternals),
            onlyThis
          );
    }

    const compareKeys = thisInternals._compare;
    const thisCursor = AdvancedBTree.makeDiffCursor(this, thisInternals);
    const otherCursor = AdvancedBTree.makeDiffCursor(other, otherInternals);
    let thisSuccess = true;
    let otherSuccess = true;
    let prevCursorOrder = AdvancedBTree.compare(thisCursor, otherCursor, compareKeys);
    while (thisSuccess && otherSuccess) {
      const cursorOrder = AdvancedBTree.compare(thisCursor, otherCursor, compareKeys);
      const { leaf: thisLeaf, internalSpine: thisInternalSpine, levelIndices: thisLevelIndices } = thisCursor;
      const { leaf: otherLeaf, internalSpine: otherInternalSpine, levelIndices: otherLevelIndices } = otherCursor;
      if (thisLeaf || otherLeaf) {
        if (prevCursorOrder !== 0) {
          if (cursorOrder === 0) {
            if (thisLeaf && otherLeaf && different) {
              const valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
              const valOther = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
              if (!Object.is(valThis, valOther)) {
                const result = different(thisCursor.currentKey, valThis, valOther);
                if (result && result.break)
                  return result.break;
              }
            }
          } else if (cursorOrder > 0) {
            if (otherLeaf && onlyOther) {
              const otherVal = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
              const result = onlyOther(otherCursor.currentKey, otherVal);
              if (result && result.break)
                return result.break;
            }
          } else if (onlyThis) {
            if (thisLeaf && prevCursorOrder !== 0) {
              const valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
              const result = onlyThis(thisCursor.currentKey, valThis);
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
          thisSuccess = AdvancedBTree.step(thisCursor, true);
          otherSuccess = AdvancedBTree.step(otherCursor, true);
          continue;
        }
      }
      prevCursorOrder = cursorOrder;
      if (cursorOrder < 0) {
        thisSuccess = AdvancedBTree.step(thisCursor);
      } else {
        otherSuccess = AdvancedBTree.step(otherCursor);
      }
    }

    if (thisSuccess && onlyThis)
      return AdvancedBTree.finishCursorWalk(thisCursor, otherCursor, compareKeys, onlyThis);
    if (otherSuccess && onlyOther)
      return AdvancedBTree.finishCursorWalk(otherCursor, thisCursor, compareKeys, onlyOther);
    return undefined;
  }

  private static finishCursorWalk<K, V, R>(
    cursor: DiffCursor<K, V>,
    cursorFinished: DiffCursor<K, V>,
    compareKeys: (a: K, b: K) => number,
    callback: (k: K, v: V) => { break?: R } | void
  ): R | undefined {
    const compared = AdvancedBTree.compare(cursor, cursorFinished, compareKeys);
    if (compared === 0) {
      if (!AdvancedBTree.step(cursor))
        return undefined;
    } else if (compared < 0) {
      check(false, 'cursor walk terminated early');
    }
    return AdvancedBTree.stepToEnd(cursor, callback);
  }

  private static stepToEnd<K, V, R>(
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
      canStep = AdvancedBTree.step(cursor);
    }
    return undefined;
  }

  private static makeDiffCursor<K, V>(tree: BTree<K, V>, internals: AdvancedTreeInternals<K, V>): DiffCursor<K, V> {
    const root = internals._root;
    return {
      height: tree.height,
      internalSpine: [[root]],
      levelIndices: [0],
      leaf: undefined,
      currentKey: root.maxKey()
    };
  }

  private static step<K, V>(cursor: DiffCursor<K, V>, stepToNode?: boolean): boolean {
    const { internalSpine, levelIndices, leaf } = cursor;
    if (stepToNode === true || leaf) {
      const levelsLength = levelIndices.length;
      if (stepToNode === true || levelIndices[levelsLength - 1] === 0) {
        const spineLength = internalSpine.length;
        if (spineLength === 0)
          return false;
        const nodeLevelIndex = spineLength - 1;
        let levelIndexWalkBack = nodeLevelIndex;
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
      } else {
        const valueIndex = --levelIndices[levelsLength - 1];
        cursor.currentKey = (leaf as BNode<K, V>).keys[valueIndex];
        return true;
      }
    } else {
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

  private static compare<K, V>(
    cursorA: DiffCursor<K, V>,
    cursorB: DiffCursor<K, V>,
    compareKeys: (a: K, b: K) => number
  ): number {
    const { height: heightA, currentKey: currentKeyA, levelIndices: levelIndicesA } = cursorA;
    const { height: heightB, currentKey: currentKeyB, levelIndices: levelIndicesB } = cursorB;
    const keyComparison = compareKeys(currentKeyB, currentKeyA);
    if (keyComparison !== 0) {
      return keyComparison;
    }
    const heightMin = heightA < heightB ? heightA : heightB;
    const depthANormalized = levelIndicesA.length - (heightA - heightMin);
    const depthBNormalized = levelIndicesB.length - (heightB - heightMin);
    return depthANormalized - depthBNormalized;
  }
}

export default AdvancedBTree;
