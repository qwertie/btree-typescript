import BTreeEx from '../extended';
import MersenneTwister from 'mersenne-twister';
import {
  expectTreeMatchesEntries,
  forEachFuzzCase,
  populateFuzzTrees,
  SetOperationFuzzSettings
} from './shared';

const compare = (a: number, b: number) => a - b;

describe('Set operation fuzz tests', () => {
  const FUZZ_SETTINGS: SetOperationFuzzSettings = {
    branchingFactors: [4, 5, 32],
    ooms: [2, 3],
    fractionsPerOOM: [0.1, 0.25, 0.5],
    removalChances: [0.01, 0.1]
  };

  const FUZZ_TIMEOUT_MS = 30_000;
  jest.setTimeout(FUZZ_TIMEOUT_MS);

  const rng = new MersenneTwister(0xC0FFEE);
  // Separate generator for omit ranges, so the trees generated above are unaffected by it.
  const rangeRng = new MersenneTwister(0xBADDAD);

  forEachFuzzCase(FUZZ_SETTINGS, ({ maxNodeSize, size, fractionA, fractionB, removalChance, removalLabel }) => {
    it(`branch ${maxNodeSize}, size ${size}, fractionA ${fractionA.toFixed(2)}, fractionB ${fractionB.toFixed(2)}, removal ${removalLabel}`, () => {
      const treeA = new BTreeEx<number, number>([], compare, maxNodeSize);
      const treeB = new BTreeEx<number, number>([], compare, maxNodeSize);
      const treeC = new BTreeEx<number, number>([], compare, maxNodeSize);
      const [treeAEntries, treeBEntries, treeCEntries] = populateFuzzTrees(
        [
          { tree: treeA, fraction: fractionA, removalChance },
          { tree: treeB, fraction: fractionB, removalChance },
          { tree: treeC, fraction: 0.5 }
        ],
        { rng, size, compare, maxNodeSize }
      );

      const keepEither = (_k: number, left: number, _right: number) => left;
      const dropValue = () => undefined;
      const combineSum = (_k: number, left: number, right: number) => left + right;

      const unionDrop = treeA.union(treeB, dropValue);
      const unionKeep = treeA.union(treeB, keepEither);
      const intersection = treeA.intersect(treeB, keepEither);
      const diffAB = treeA.subtract(treeB);
      const diffBA = treeB.subtract(treeA);

      // 1. Partition of A: A = (A\B) ∪ (A∩B) and parts are disjoint.
      const partition = diffAB.union(intersection, keepEither);
      expect(partition.toArray()).toEqual(treeAEntries);
      expect(diffAB.intersect(intersection, keepEither).size).toBe(0);

      // 2. Recover B from union and A\B: (A∪B)\(A\B) = B.
      expect(unionKeep.subtract(diffAB).toArray()).toEqual(treeBEntries);

      // 3. Symmetric difference two ways.
      const symFromDiffs = diffAB.union(diffBA, keepEither);
      const symFromUnion = unionKeep.subtract(intersection);
      expect(symFromDiffs.toArray()).toEqual(symFromUnion.toArray());

      // 4. Intersection via difference: A∩B = A \ (A\B).
      expect(intersection.toArray()).toEqual(treeA.subtract(diffAB).toArray());

      // 5. Difference via intersection: A\B = A \ (A∩B).
      expect(diffAB.toArray()).toEqual(treeA.subtract(intersection).toArray());

      // 6. Idempotence.
      expect(treeA.union(treeA, keepEither).toArray()).toEqual(treeAEntries);
      expect(treeA.intersect(treeA, keepEither).toArray()).toEqual(treeAEntries);
      expect(diffAB.subtract(treeB).toArray()).toEqual(diffAB.toArray());

      // 7. Commutativity.
      expect(intersection.toArray()).toEqual(treeB.intersect(treeA, keepEither).toArray());
      const commUT = treeA.union(treeB, combineSum);
      const commTU = treeB.union(treeA, combineSum);
      expect(commUT.toArray()).toEqual(commTU.toArray());

      // 8. Associativity.
      const assocLeft = treeA.intersect(treeB, keepEither).intersect(treeC, keepEither);
      const assocRight = treeA.intersect(treeB.intersect(treeC, keepEither), keepEither);
      expect(assocLeft.toArray()).toEqual(assocRight.toArray());
      const assocSumLeft = treeA.union(treeB, combineSum).union(treeC, combineSum);
      const assocSumRight = treeA.union(treeB.union(treeC, combineSum), combineSum);
      expect(assocSumLeft.toArray()).toEqual(assocSumRight.toArray());

      // 9. Absorption.
      expect(treeA.intersect(treeA.union(treeB, keepEither), keepEither).toArray()).toEqual(treeAEntries);
      expect(treeA.union(treeA.intersect(treeB, keepEither), keepEither).toArray()).toEqual(treeAEntries);

      // 10. Distributivity.
      const distIntersect = treeA.intersect(treeB.union(treeC, keepEither), keepEither);
      const distRight = treeA.intersect(treeB, keepEither).union(treeA.intersect(treeC, keepEither), keepEither);
      expect(distIntersect.toArray()).toEqual(distRight.toArray());
      const distSubtract = treeA.subtract(treeB.union(treeC, keepEither));
      const distSubtractRight = treeA.subtract(treeB).subtract(treeC);
      expect(distSubtract.toArray()).toEqual(distSubtractRight.toArray());
      const distIntersectDiff = treeA.intersect(treeB, keepEither).subtract(treeC);
      const distDiffIntersect = treeA.subtract(treeC).intersect(treeB, keepEither);
      expect(distIntersectDiff.toArray()).toEqual(distDiffIntersect.toArray());

      // 11. Superset sanity.
      expect(treeA.subtract(treeA.union(treeB, keepEither)).size).toBe(0);
      expect(diffAB.intersect(treeB, keepEither).size).toBe(0);

      // 12. Cardinality relations.
      expect(unionKeep.size).toBe(treeA.size + treeB.size - intersection.size);
      expect(diffAB.size).toBe(treeA.size - intersection.size);
      expect(treeA.size).toBe(diffAB.size + intersection.size);

      // 13. Omitting a key range. Bounds are integers, so they may land on keys.
      const [lo, mid, hi] = [rangeRng.random(), rangeRng.random(), rangeRng.random()]
        .map((r) => Math.floor(r * (size + 2)))
        .sort(compare);
      const range = { gt: lo, lte: hi };
      const omitA = treeA.omit(range);
      const omitB = treeB.omit(range);
      // Omit is subtraction of the keys in range.
      expect(omitA.toArray()).toEqual(treeA.subtract(treeA.filter((k) => k > lo && k <= hi)).toArray());
      // Splitting the range, at either side of the split point.
      expect(treeA.omit({ gt: lo, lte: mid }).omit({ gt: mid, lte: hi }).toArray()).toEqual(omitA.toArray());
      expect(treeA.omit({ gt: lo, lt: mid }).omit({ gte: mid, lte: hi }).toArray()).toEqual(omitA.toArray());
      // Open-ended omits partition the tree, at either side of the split point.
      const omitBelow = treeA.omit({ lt: mid });
      const omitAbove = treeA.omit({ gte: mid });
      expect(omitBelow.intersect(omitAbove, keepEither).size).toBe(0);
      expect(omitAbove.union(omitBelow, keepEither).toArray()).toEqual(treeAEntries);
      expect(omitBelow.size + omitAbove.size).toBe(treeA.size);
      expect(treeA.omit({ lte: mid }).size + treeA.omit({ gt: mid }).size).toBe(treeA.size);
      // Omit distributes over union, intersection and subtraction.
      expect(unionKeep.omit(range).toArray()).toEqual(omitA.union(omitB, keepEither).toArray());
      expect(intersection.omit(range).toArray()).toEqual(omitA.intersect(treeB, keepEither).toArray());
      expect(diffAB.omit(range).toArray()).toEqual(omitA.subtract(treeB).toArray());

      partition.checkValid(true);
      unionDrop.checkValid(true);
      unionKeep.checkValid(true);
      intersection.checkValid(true);
      diffAB.checkValid(true);
      diffBA.checkValid(true);
      omitA.checkValid(true);
      omitBelow.checkValid(true);
      omitAbove.checkValid(true);
      treeA.checkValid(true);
      treeB.checkValid(true);
      treeC.checkValid(true);

      expectTreeMatchesEntries(treeA, treeAEntries);
      expectTreeMatchesEntries(treeB, treeBEntries);
      expectTreeMatchesEntries(treeC, treeCEntries);
    });
  });
});
