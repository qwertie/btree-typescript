import BTree from '../b+tree';
import type { BTreeWithInternals } from './shared';
import { decompose, buildFromDecomposition } from "./decompose";
import { checkCanDoSetOperation } from "./parallelWalk";

/**
 * Efficiently unions two trees, reusing subtrees wherever possible.
 * Neither input tree is modified.
 * @param treeA First tree to union.
 * @param treeB Second tree to union.
 * @param combineFn Called for keys that appear in both trees. Return the desired value, or
 *        `undefined` to omit the key from the result.
 * @returns A new BTree that contains the unioned key/value pairs.
 * @description Complexity is bounded O(N + M) for both time and allocations.
 * However, it is additionally bounded by O(log(N + M) * D) where D is the number of disjoint ranges of keys between
 * the two trees. In practice, that means for keys of random distribution the performance is O(N + M) and for
 * keys with significant numbers of non-overlapping key ranges it is O(log(N + M) * D) which is much faster.
 * The algorithm achieves this additional non-linear bound by skipping over non-intersecting subtrees entirely.
 * Note that in benchmarks even the worst case (fully interleaved keys) performance is faster than cloning `this`
 * and inserting the contents of `other` into the clone.
 */
export default function union<TBTree extends BTree<K, V>, K, V>(
  treeA: TBTree,
  treeB: TBTree,
  combineFn: (key: K, leftValue: V, rightValue: V) => V | undefined
): TBTree {
  const _treeA = treeA as unknown as BTreeWithInternals<K, V>;
  const _treeB = treeB as unknown as BTreeWithInternals<K, V>;
  const branchingFactor = checkCanDoSetOperation(_treeA, _treeB);
  if (_treeA._root.size() === 0)
    return treeB.clone();
  if (_treeB._root.size() === 0)
    return treeA.clone();

  // Decompose both trees into disjoint subtrees leaves.
  // As many of these as possible will be reused from the original trees, and the remaining
  // will be leaves that are the result of merging intersecting leaves.
  const decomposed = decompose(_treeA, _treeB, combineFn);
  const constructor = treeA.constructor as new (entries?: [K, V][], compare?: (a: K, b: K) => number, maxNodeSize?: number) => TBTree;
  return buildFromDecomposition(constructor, branchingFactor, decomposed, _treeA._compare, _treeA._maxNodeSize);
}
