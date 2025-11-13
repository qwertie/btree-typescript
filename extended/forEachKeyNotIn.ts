import BTree from '../b+tree';
import { type BTreeWithInternals, checkCanDoSetOperation } from './shared';
import { createCursor, moveForwardOne, moveTo, getKey, noop } from "./parallelWalk"

/**
 * Calls the supplied `callback` for each key/value pair that is in includeTree but not in excludeTree.
 * This is also known as set subtraction.
 * The callback will be called in sorted key order.
 * Neither tree is modified.
 * @param includeTree The first tree. This is the tree from which keys will be taken.
 * @param excludeTree The second tree. Keys present in this tree will be excluded.
 * @param callback Invoked for keys that are in includeTree but not in excludeTree. It can cause iteration to early exit by returning `{ break: R }`.
 * @description Complexity is bounded by O(N + M) for time.
 * However, time is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
 * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
 * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully interleaved keys, none intersecting) performance is faster than calling `toArray`
 * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
 */
export default function forEachKeyNotIn<K, V, R = void>(
  includeTree: BTree<K, V>,
  excludeTree: BTree<K, V>,
  callback: (key: K, value: V) => { break?: R } | void
): R | undefined {
  const _includeTree = includeTree as unknown as BTreeWithInternals<K, V>;
  const _excludeTree = excludeTree as unknown as BTreeWithInternals<K, V>;
  checkCanDoSetOperation(_includeTree, _excludeTree, true);
  if (includeTree.size === 0) {
    return;
  }

  const finishWalk = () => {
    let out = false;
    do {
      const key = getKey(cursorInclude);
      const value = cursorInclude.leaf.values[cursorInclude.leafIndex];
      const result = callback(key, value);
      if (result && result.break) {
        return result.break;
      }
      out = moveForwardOne(cursorInclude, cursorExclude);
    } while (!out);
  }

  const cmp = includeTree._compare;
  const makePayload = (): undefined => undefined;
  let cursorInclude = createCursor<K, V, undefined>(_includeTree, makePayload, noop, noop, noop, noop, noop);

  if (excludeTree.size === 0) {
    finishWalk();
    return;
  }

  let cursorExclude = createCursor<K, V, undefined>(_excludeTree, makePayload, noop, noop, noop, noop, noop);
  let order = cmp(getKey(cursorInclude), getKey(cursorExclude));

  while (true) {
    const areEqual = order === 0;
    if (areEqual) {
      // Keys are equal, so this key is in both trees and should be skipped.
      const outInclude = moveForwardOne(cursorExclude, cursorInclude);
      if (outInclude)
        break;
      const [outExclude, nowEqual] = moveTo(cursorInclude, cursorExclude, getKey(cursorInclude), true, areEqual);
      if (outExclude) {
        finishWalk();
        break;
      }
      order = nowEqual ? 0 : -1;
    } else {
      if (order < 0) {
        const key = getKey(cursorInclude);
        const value = cursorInclude.leaf.values[cursorInclude.leafIndex];
        const result = callback(key, value);
        if (result && result.break) {
          return result.break;
        }
        const outInclude = moveForwardOne(cursorInclude, cursorExclude);
        if (outInclude) {
          break;
        }
        order = cmp(getKey(cursorInclude), getKey(cursorExclude));
      } else {
        // At this point, include is guaranteed to be ahead of exclude.
        const [out, nowEqual] = moveTo(cursorExclude, cursorInclude, getKey(cursorInclude), true, areEqual)
        if (out) {
          // We've reached the end of exclude, so call for all remaining keys in include
          finishWalk();
          break;
        } else if (nowEqual) {
          order = 0;
        } else {
          order = -1; // trailing is ahead of leading
        }
      }
    }
  }
}
