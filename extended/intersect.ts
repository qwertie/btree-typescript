import BTree from '../b+tree';
import { alternatingPush, createAlternatingList, checkCanDoSetOperation, type BTreeWithInternals, BTreeConstructor } from './shared';
import forEachKeyInBoth from './forEachKeyInBoth';
import { bulkLoadRoot } from './bulkLoad';

/**
 * Returns a new tree containing only keys present in both input trees.
 * Neither tree is modified.
 *
 * Complexity is O(N + M) in the fully overlapping case and additionally bounded by O(log(N + M) * D),
 * where `D` is the number of disjoint key ranges, because disjoint subtrees are skipped entirely.
 * In practice, that means for keys of random distribution the performance is linear and for keys with significant
 * numbers of non-overlapping key ranges it is much faster.
 * @param treeA First tree to intersect.
 * @param treeB Second tree to intersect.
 * @param combineFn Called for keys that appear in both trees. Return the desired value.
 * @returns A new tree populated with the intersection.
 * @throws Error if the trees were created with different comparators.
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
    return treeA.clone();
  if (_treeB._root.size() === 0)
    return treeB.clone();

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
