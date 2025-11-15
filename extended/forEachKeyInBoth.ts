import BTree from '../b+tree';
import { type BTreeWithInternals, checkCanDoSetOperation } from './shared';
import { createCursor, moveForwardOne, moveTo, getKey, noop } from "./parallelWalk"

/**
 * Calls the supplied `callback` for each key/value pair shared by both trees, in sorted key order.
 * Neither tree is modified.
 *
 * Complexity is O(N + M) when the trees overlap heavily, and additionally bounded by O(log(N + M) * D)
 * where `D` is the number of disjoint key ranges between the trees, because whole non-intersecting subtrees
 * are skipped.
 * In practice, that means for keys of random distribution the performance is linear and for keys with significant
 * numbers of non-overlapping key ranges it is much faster.
 * @param treeA First tree to compare.
 * @param treeB Second tree to compare.
 * @param callback Invoked for keys that appear in both trees. It can cause iteration to early exit by returning `{ break: R }`.
 * @returns The first `break` payload returned by the callback, or `undefined` if the walk finishes.
 * @throws Error if the trees were built with different comparators.
 */
export default function forEachKeyInBoth<K, V, R = void>(
  treeA: BTree<K, V>,
  treeB: BTree<K, V>,
  callback: (key: K, leftValue: V, rightValue: V) => { break?: R } | void
): R | undefined {
  const _treeA = treeA as unknown as BTreeWithInternals<K, V>;
  const _treeB = treeB as unknown as BTreeWithInternals<K, V>;
  checkCanDoSetOperation(_treeA, _treeB, true);
  if (treeB.size === 0 || treeA.size === 0)
    return;

  const cmp = treeA._compare;
  const makePayload = (): undefined => undefined;
  let cursorA = createCursor<K, V, undefined>(_treeA, makePayload, noop, noop, noop, noop, noop);
  let cursorB = createCursor<K, V, undefined>(_treeB, makePayload, noop, noop, noop, noop, noop);
  let leading = cursorA;
  let trailing = cursorB;
  let order = cmp(getKey(leading), getKey(trailing));

  // This walk is somewhat similar to a merge walk in that it does an alternating hop walk with cursors.
  // However, the only thing we care about is when the two cursors are equal (equality is intersection).
  // When they are not equal we just advance the trailing cursor.
  while (true) {
    const areEqual = order === 0;
    if (areEqual) {
      const key = getKey(leading);
      const vA = cursorA.leaf.values[cursorA.leafIndex];
      const vB = cursorB.leaf.values[cursorB.leafIndex];
      const result = callback(key, vA, vB);
      if (result && result.break) {
        return result.break;
      }
      const outT = moveForwardOne(trailing, leading);
      const outL = moveForwardOne(leading, trailing);
      if (outT && outL)
        break;
      order = cmp(getKey(leading), getKey(trailing));
    } else {
      if (order < 0) {
        const tmp = trailing;
        trailing = leading; leading = tmp;
      }
      // At this point, leading is guaranteed to be ahead of trailing.
      const [out, nowEqual] = moveTo(trailing, leading, getKey(leading), true, areEqual)
      if (out) {
        // We've reached the end of one tree, so intersections are guaranteed to be done.
        break;
      } else if (nowEqual) {
        order = 0;
      } else {
        order = -1; // trailing is ahead of leading
      }
    }
  }
}
