import BTree from '../b+tree';
import { alternatingPush, createAlternatingList, checkCanDoSetOperation, type BTreeWithInternals, BTreeConstructor } from './shared';
import forEachKeyInBoth from './forEachKeyInBoth';
import { bulkLoadRoot } from './bulkLoad';

/**
 * Returns a new tree containing only keys present in both input trees.
 * Neither tree is modified.
 * @param treeA First tree to intersect.
 * @param treeB Second tree to intersect.
 * @param combineFn Called for keys that appear in both trees. Return the desired value, or
 *        `undefined` to omit the key from the result.
 * @description Complexity is bounded O(N + M) for both time and allocations.
 * However, it is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
 * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
 * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than calling `toArray`
 * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
 */
export default function intersect<TBTree extends BTree<K, V>, K, V>(
  treeA: TBTree,
  treeB: TBTree,
  combineFn: (key: K, leftValue: V, rightValue: V) => V
): TBTree {
  const _treeA = treeA as unknown as BTreeWithInternals<K, V>;
  const _treeB = treeB as unknown as BTreeWithInternals<K, V>;
  const branchingFactor = checkCanDoSetOperation(_treeA, _treeB, true);
  if (_treeA._root.size() === 0)
    return treeB.clone();
  if (_treeB._root.size() === 0)
    return treeA.clone();

  const intersected = createAlternatingList<K, V>();
  forEachKeyInBoth(treeA, treeB, (key, leftValue, rightValue) => {
    const mergedValue = combineFn(key, leftValue, rightValue);
    alternatingPush(intersected, key, mergedValue);
  });

  // Intersected keys are guaranteed to be in order, so we can bulk load
  const constructor = treeA.constructor as BTreeConstructor<TBTree, K, V>;
  const resultTree = new constructor(undefined, treeA._compare, branchingFactor);
  resultTree._root = bulkLoadRoot(intersected, branchingFactor, treeA._compare);
  return resultTree as unknown as TBTree;
}
