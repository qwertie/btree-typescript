import BTree, { BNode, BNodeInternal } from '../b+tree';
import { buildFromDecomposition, DecomposeResult } from '../extended/decompose';
import { BTreeConstructor } from '../extended/shared';
import { compareNumbers } from './shared';

const Tree = BTree as unknown as BTreeConstructor<BTree<number, number>, number, number>;

function makeDecomposition(heights: number[], maxNodeSize = 4, full = false) {
  let nextKey = 0;
  const occupancy = full ? maxNodeSize : Math.floor(maxNodeSize / 2);
  const makeNode = (height: number): BNode<number, number> => {
    if (height <= 0) {
      const keys = Array.from({ length: height < 0 ? 1 : occupancy }, () => nextKey++);
      return new BNode(keys, keys.slice());
    }
    const children = Array.from({ length: occupancy }, () => makeNode(height - 1));
    return new BNodeInternal(children, children.reduce((size, child) => size + child.size(), 0));
  };
  const nodes = heights.map(height => {
    const node = makeNode(height);
    if (height >= 0)
      node.isShared = true;
    return node;
  });
  const sources = nodes.filter((_, i) => heights[i] >= 0).map(node => {
    const tree = new Tree(undefined, compareNumbers, maxNodeSize);
    tree._root = node;
    return tree;
  });
  const snapshots = sources.map(tree => tree.toArray());
  const decomposed: DecomposeResult<number, number> = {
    heights,
    nodes,
    tallestIndex: heights.indexOf(Math.max(...heights))
  };
  const expected: [number, number][] = Array.from({ length: nextKey }, (_, key) => [key, key]);
  return { decomposed, sources, snapshots, expected };
}

describe('Reconstruction frontier', () => {
  describe.each([false, true])('left side: %s', leftSide => {
    it.each([4, 8, 12])('walks a height-%i staircase in linear work', height => {
      const heights = Array.from({ length: height + 1 }, (_, i) => height - i);
      if (leftSide)
        heights.reverse();
      const { decomposed, sources, snapshots, expected } = makeDecomposition(heights);

      // Count frontier node visits, not elapsed time or comparator calls.
      const visits = jest.spyOn(BNode.prototype, 'isLeaf', 'get');
      let result: BTree<number, number>;
      let visitCount: number;
      try {
        result = buildFromDecomposition(Tree, 4, decomposed, compareNumbers, 4);
        visitCount = visits.mock.calls.length;
      } finally {
        visits.mockRestore();
      }

      expect(visitCount).toBeLessThanOrEqual(4 * height + 2);
      expect(result.toArray()).toEqual(expected);
      expect(result.size).toBe(expected.length);
      result.checkValid(true);
      sources.forEach((tree, i) => {
        expect(tree.toArray()).toEqual(snapshots[i]);
        tree.checkValid(true);
      });
    });
  });

  it.each([4, 5])('handles height changes, root splits and underfilled leaves at fanout %i', maxNodeSize => {
    const heights = [
      0, -1, 1, 0, -1, 2, 1, -1, 0, 3,
      3, -1, 0, 1, 2, 0, -1, 1, 2, 3, -1
    ];
    const { decomposed, sources, snapshots, expected } = makeDecomposition(heights, maxNodeSize, true);
    const result = buildFromDecomposition(Tree, maxNodeSize, decomposed, compareNumbers, maxNodeSize);

    expect(result.toArray()).toEqual(expected);
    expect(result.size).toBe(expected.length);
    result.checkValid(true);
    sources.forEach((tree, i) => {
      expect(tree.toArray()).toEqual(snapshots[i]);
      tree.checkValid(true);
      const key = snapshots[i][0][0];
      result.set(key, -1);
      expect(tree.get(key)).toBe(key);
      const lastKey = snapshots[i][snapshots[i].length - 1][0];
      tree.set(lastKey, -2);
      expect(result.get(lastKey)).toBe(lastKey);
      tree.checkValid(true);
    });
    result.checkValid(true);
  });
});
