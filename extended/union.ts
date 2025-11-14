import BTree from '../b+tree';
import { BTreeConstructor, type BTreeWithInternals, checkCanDoSetOperation } from './shared';
import { decompose, buildFromDecomposition } from "./decompose";

/**
 * Efficiently unions two trees, reusing subtrees wherever possible without mutating either input.
 *
 * Complexity is O(N + M) when the trees overlap heavily, and additionally bounded by O(log(N + M) * D)
 * where `D` is the number of disjoint key ranges, because disjoint subtrees are skipped entirely.
 * In practice, that means for keys of random distribution the performance is linear and for keys with significant
 * numbers of non-overlapping key ranges it is much faster.
 * @param treeA First tree to union.
 * @param treeB Second tree to union.
 * @param combineFn Called for keys that appear in both trees. Return the desired value, or
 *        `undefined` to omit the key from the result. Note: symmetric difference can be achieved by always returning `undefined`.
 * @returns A new BTree that contains the unioned key/value pairs.
 * @throws Error if the trees were created with different comparators or max node sizes.
 */
export default function union<TBTree extends BTree<K, V>, K, V>(
  treeA: TBTree,
  treeB: TBTree,
  combineFn: (key: K, leftValue: V, rightValue: V) => V | undefined
): TBTree {
  if (treeA === treeB)
    return treeA.clone();
  const _treeA = treeA as unknown as BTreeWithInternals<K, V>;
  const _treeB = treeB as unknown as BTreeWithInternals<K, V>;
  const branchingFactor = checkCanDoSetOperation(_treeA, _treeB, false);
  if (_treeA._root.size() === 0)
    return treeB.clone();
  if (_treeB._root.size() === 0)
    return treeA.clone();

  // Decompose both trees into disjoint subtrees leaves.
  // As many of these as possible will be reused from the original trees, and the remaining
  // will be leaves that are the result of merging intersecting leaves.
  const decomposed = decompose(_treeA, _treeB, combineFn);
  const constructor = treeA.constructor as BTreeConstructor<TBTree, K, V>;
  return buildFromDecomposition(constructor, branchingFactor, decomposed, _treeA._compare, _treeA._maxNodeSize);
}
