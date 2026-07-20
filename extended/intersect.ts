import BTree from '../b+tree';
import { checkCanDoSetOperation, type BTreeWithInternals, BTreeConstructor } from './shared';
import forEachKeyInBoth from './forEachKeyInBoth';
import { bulkLoadRoot } from './bulkLoad';

/**
 * Returns a new tree containing only keys present in both input trees.
 * Neither tree is modified.
 *
 * Let `N` and `M` be the input sizes, `I` the number of keys present in both trees, `U = N + M - 2I`
 * the number of keys present in exactly one tree, `H` the larger tree height, and `G` the number of maximal
 * runs of keys belonging exclusively to one particular tree in merged key order. With a fixed max node size
 * and normally occupied nodes, the complexity is `O(min(I + U, I + G * H))`.
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
