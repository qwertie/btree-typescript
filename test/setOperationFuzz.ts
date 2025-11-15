import BTreeEx from '../extended';
import MersenneTwister from 'mersenne-twister';
import { makeArray } from './shared';

const compare = (a: number, b: number) => a - b;

describe('Complicated set operation fuzz tests', () => {
  const FUZZ_SETTINGS = {
    branchingFactors: [4, 5, 32],
    ooms: [2, 3],
    fractionsPerOOM: [0.1, 0.25, 0.5],
    collisionChances: [0.05, 0.1, 0.3],
    timeoutMs: 30_000
  } as const;

  FUZZ_SETTINGS.fractionsPerOOM.forEach(fraction => {
    if (fraction < 0 || fraction > 1)
      throw new Error('FUZZ_SETTINGS.fractionsPerOOM must contain values between 0 and 1');
  });
  FUZZ_SETTINGS.collisionChances.forEach(chance => {
    if (chance < 0 || chance > 1)
      throw new Error('FUZZ_SETTINGS.collisionChances must contain values between 0 and 1');
  });

  jest.setTimeout(FUZZ_SETTINGS.timeoutMs);

  const rng = new MersenneTwister(0xC0FFEE);

  for (const maxNodeSize of FUZZ_SETTINGS.branchingFactors) {
    describe(`branching factor ${maxNodeSize}`, () => {
      for (const collisionChance of FUZZ_SETTINGS.collisionChances) {
        for (const oom of FUZZ_SETTINGS.ooms) {
          const size = 5 * Math.pow(10, oom);
          for (const fractionA of FUZZ_SETTINGS.fractionsPerOOM) {
            const fractionB = 1 - fractionA;
            const collisionLabel = collisionChance.toFixed(2);

            test(`size ${size}, fractionA ${fractionA.toFixed(2)}, fractionB ${fractionB.toFixed(2)}, collision ${collisionLabel}`, () => {
              const treeA = new BTreeEx<number, number>([], compare, maxNodeSize);
              const treeB = new BTreeEx<number, number>([], compare, maxNodeSize);

              const keys = makeArray(size, true, 1, collisionChance, rng);

              for (const value of keys) {
                const assignToA = rng.random() < fractionA;
                const assignToB = rng.random() < fractionB;

                if (!assignToA && !assignToB) {
                  if (rng.random() < 0.5)
                    treeA.set(value, value);
                  else
                    treeB.set(value, value);
                  continue;
                }

                if (assignToA)
                  treeA.set(value, value);
                if (assignToB)
                  treeB.set(value, value);
              }

              const keepValue = (_k: number, left: number, _right: number) => left;
              const dropValue = () => undefined;

              const symmetricViaUnion = treeA.union(treeB, dropValue);
              const fullUnion = treeA.union(treeB, keepValue);
              const intersection = treeA.intersect(treeB, keepValue);
              const symmetricViaSubtract = fullUnion.subtract(intersection);

              expect(symmetricViaUnion.toArray()).toEqual(symmetricViaSubtract.toArray());

              const diffBA = treeB.subtract(treeA);
              const diffAB = treeA.subtract(treeB);
              const mergedDiffs = diffAB.union(diffBA, keepValue);

              expect(mergedDiffs.toArray()).toEqual(symmetricViaUnion.toArray());

              symmetricViaUnion.checkValid();
              symmetricViaSubtract.checkValid();
              mergedDiffs.checkValid();
              treeA.checkValid();
              treeB.checkValid();
            });
          }
        }
      }
    });
  }
});
