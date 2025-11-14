import BTree from '../b+tree';
import { type BTreeWithInternals, checkCanDoSetOperation } from './shared';
import { createCursor, moveForwardOne, moveTo, getKey, noop } from "./parallelWalk"

/**
 * Calls the supplied `callback` for each key/value pair that is in `includeTree` but not in `excludeTree`
 * (set subtraction). The callback runs in sorted key order and neither tree is modified.
 *
 * Complexity is O(N + M) when the key ranges overlap heavily, and additionally bounded by O(log(N + M) * D)
 * where `D` is the number of disjoint ranges between the trees, because non-overlapping subtrees are skipped.
 * In practice, that means for keys of random distribution the performance is linear and for keys with significant
 * numbers of non-overlapping key ranges it is much faster.
 * @param includeTree The tree to iterate keys from.
 * @param excludeTree Keys present in this tree are omitted from the callback.
 * @param callback Invoked for keys that are in `includeTree` but not `excludeTree`. It can cause iteration to early exit by returning `{ break: R }`.
 * @returns The first `break` payload returned by the callback, or `undefined` if all qualifying keys are visited.
 * @throws Error if the trees were built with different comparators.
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

  const finishWalk = (): R | undefined => {
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
    return undefined;
  }

  const cmp = includeTree._compare;
  const makePayload = (): undefined => undefined;
  let cursorInclude = createCursor<K, V, undefined>(_includeTree, makePayload, noop, noop, noop, noop, noop);

  if (excludeTree.size === 0) {
    return finishWalk();
  }

  let cursorExclude = createCursor<K, V, undefined>(_excludeTree, makePayload, noop, noop, noop, noop, noop);
  let order = cmp(getKey(cursorInclude), getKey(cursorExclude));

  while (true) {
    const areEqual = order === 0;
    if (areEqual) {
      // Keys are equal, so this key is in both trees and should be skipped.
      const outInclude = moveForwardOne(cursorInclude, cursorExclude);
      if (outInclude)
        break;
      order = 1; // include is now ahead of exclude
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
          return finishWalk();
        } else if (nowEqual) {
          order = 0;
        } else {
          order = -1;
        }
      }
    }
  }
}
