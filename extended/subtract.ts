import BTree from '../b+tree';
import { checkCanDoSetOperation, type BTreeWithInternals, BTreeConstructor, alternatingCount } from './shared';
import { buildFromDecomposition, decompose } from './decompose';

/**
 * Returns a new tree containing only keys that are present in treeA but notTreeB (set subtraction).
 * Neither tree is modified.
 * @param targetTree The tree to subtract from.
 * @param subtractTree The tree to subtract.
 * @description Complexity is bounded O(N + M) for time and O(N) for allocations.
 * However, it is additionally bounded by O(log(N + M) * D1) for time and O(log(N) * D2) for space where D1/D2 are the
 * number of disjoint ranges of keys between the two trees and in targetTree, respectively. In practice, that means for
 * keys of random distribution the performance is O(N + M) and for keys with significant numbers of non-overlapping key
 * ranges it is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than calling `toArray`
 * on both trees and performing a walk on the sorted contents due to the reduced allocation overhead.
 */
export default function subtract<TBTree extends BTree<K, V>, K, V>(
  targetTree: TBTree,
  subtractTree: TBTree
): TBTree {
  const _targetTree = targetTree as unknown as BTreeWithInternals<K, V>;
  const _subtractTree = subtractTree as unknown as BTreeWithInternals<K, V>;
  const branchingFactor = checkCanDoSetOperation(_targetTree, _subtractTree, false);
  if (_targetTree._root.size() === 0 || _subtractTree._root.size() === 0)
    return targetTree.clone();

  // Decompose target tree into disjoint subtrees leaves.
  // As many of these as possible will be reused from the original trees, and the remaining
  // will be leaves that are exploded (and filtered) due to intersecting leaves in subtractTree.
  const decomposed = decompose(_targetTree, _subtractTree, () => undefined, true);
  const constructor = targetTree.constructor as BTreeConstructor<TBTree, K, V>;
  if (alternatingCount(decomposed.disjoint) === 0) {
    return new constructor(undefined, targetTree._compare, targetTree._maxNodeSize) as unknown as TBTree;
  }
  return buildFromDecomposition(constructor, branchingFactor, decomposed, targetTree._compare, targetTree._maxNodeSize);
}
