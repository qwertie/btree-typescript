import BTree from '../b+tree';
import { checkCanDoSetOperation, type BTreeWithInternals, BTreeConstructor } from './shared';
import forEachKeyInBoth from './forEachKeyInBoth';
import { bulkLoadRoot } from './bulkLoad';

/**
 * Returns a new tree containing only keys present in both input trees.
 * Neither tree is modified.
 *
 * Let `A` and `B` be the input sizes, `H` the larger tree height (counting a leaf as height 1),
 * and `S` the number of maximal contiguous runs of keys from one tree in the totally ordered
 * list of keys from both trees, in which a key present in both trees is listed once per tree
 * (so every shared key starts a new run, and `S` is at least the number of shared keys).
 * The runtime of this method is `O(min(A + B, S * H))`.
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

  const intersectedKeys: K[] = [];
  const intersectedValues: V[] = [];
  forEachKeyInBoth(treeA, treeB, (key, leftValue, rightValue) => {
    const mergedValue = combineFn(key, leftValue, rightValue);
    intersectedKeys.push(key);
    intersectedValues.push(mergedValue);
  });

  // Intersected keys are guaranteed to be in order, so we can bulk load
  const constructor = treeA.constructor as BTreeConstructor<TBTree, K, V>;
  const resultTree = new constructor(undefined, treeA._compare, branchingFactor);
  resultTree._root = bulkLoadRoot(intersectedKeys, intersectedValues, branchingFactor, treeA._compare);
  return resultTree as unknown as TBTree;
}
