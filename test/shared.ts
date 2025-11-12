import BTree, { IMap } from '../b+tree';
import SortedArray from '../sorted-array';
import MersenneTwister from 'mersenne-twister';

const rand = new MersenneTwister(1234);

export function randInt(max: number): number {
  return rand.random_int() % max;
}

export function expectTreeEqualTo<K, V>(tree: BTree<K, V>, list: SortedArray<K, V>): void {
  tree.checkValid();
  expect(tree.toArray()).toEqual(list.getArray());
}

export function addToBoth<K, V>(a: IMap<K, V>, b: IMap<K, V>, k: K, v: V): void {
  expect(a.set(k, v)).toEqual(b.set(k, v));
}

export function makeArray(
  size: number,
  randomOrder: boolean,
  spacing = 10,
  collisionChance = 0,
  rng?: MersenneTwister
): number[] {
  const randomizer = rng ?? rand;
  const useGlobalRand = rng === undefined;

  const randomFloat = () => {
    if (typeof randomizer.random === 'function')
      return randomizer.random();
    return Math.random();
  };

  const randomIntWithMax = (max: number) => {
    if (max <= 0)
      return 0;
    if (useGlobalRand)
      return randInt(max);
    return Math.floor(randomFloat() * max);
  };

  const keys: number[] = [];
  let current = 0;
  for (let i = 0; i < size; i++) {
    if (i > 0 && collisionChance > 0 && randomFloat() < collisionChance) {
      keys[i] = keys[i - 1];
    } else {
      current += 1 + randomIntWithMax(spacing);
      keys[i] = current;
    }
  }
  if (randomOrder) {
    for (let i = 0; i < size; i++)
      swap(keys, i, randomIntWithMax(size));
  }
  return keys;
}

export const randomInt = (rng: MersenneTwister, maxExclusive: number) =>
  Math.floor(rng.random() * maxExclusive);

function swap(keys: any[], i: number, j: number) {
  const tmp = keys[i];
  keys[i] = keys[j];
  keys[j] = tmp;
}
