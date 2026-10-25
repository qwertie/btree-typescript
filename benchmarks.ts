#!/usr/bin/env ts-node
import BTree from '.';
import BTreeEx from './extended';
import SortedArray from './sorted-array';
import forEachKeyNotIn from './extended/forEachKeyNotIn';
import subtract from './extended/subtract';
// Note: The `bintrees` package also includes a `BinTree` type which turned
// out to be an unbalanced binary tree. It is faster than `RBTree` for
// randomized data, but it becomes extremely slow when filled with sorted 
// data, so it's not usually a good choice.
import {RBTree} from 'bintrees';
import { logTreeNodeStats } from './test/shared';
import { performance } from 'perf_hooks'; // node.js only
const SortedSet = require("collections/sorted-set");         // Bad type definition: missing 'length'
const SortedMap = require("collections/sorted-map");         // No type definitions available
const functionalTree = require("functional-red-black-tree"); // No type definitions available

class Timer {
  start = perfNow();
  ms() { return ((perfNow() - this.start) * 100 | 0) / 100; }
  restart() { var ms = this.ms(); this.start += ms; return ms; }
}

console.log("Benchmark results (milliseconds with integer keys/values)");
console.log("---------------------------------------------------------");

console.log();
console.log("### Insertions at random locations: sorted-btree vs the competition (millisec) ###");

for (let size of [1000, 10000, 100000, 1000000]) {
  console.log();
  var keys = makeArray(size, true);

  measure(map => `Insert ${map.size} pairs in sorted-btree's BTree`, () => {
    let map = new BTree();
    for (let k of keys)
      map.set(k, k);
    return map;
  });
  measure(map => `Insert ${map.size} pairs in sorted-btree's BTree set (no values)`, () => {
    let map = new BTree();
    for (let k of keys)
      map.set(k, undefined);
    return map;
  });
  measure(map => `Insert ${map.length} pairs in collections' SortedMap`, () => {
    let map = new SortedMap();
    for (let k of keys)
      map.set(k, k);
    return map;
  });
  measure(set => `Insert ${set.length} pairs in collections' SortedSet (no values)`, () => {
    let set = new SortedSet();
    for (let k of keys)
      set.push(k);
    return set;
  });
  measure(set => `Insert ${set.length} pairs in functional-red-black-tree`, () => {
    let set = functionalTree();
    for (let k of keys)
      set = set.insert(k, k);
    return set;
  });
  measure(set => `Insert ${set.size} pairs in bintrees' RBTree (no values)`, () => {
    let set = new RBTree((a: any, b: any) => a - b);
    for (let k of keys)
      set.insert(k);
    return set;
  });
  //measure(set => `Insert ${set.size} pairs in bintrees' BinTree (no values)`, () => {
  //  let set = new BinTree((a: any, b: any) => a - b);
  //  for (let k of keys)
  //    set.insert(k);
  //  return set;
  //});
}

console.log();
console.log("### Insert in order, delete: sorted-btree vs the competition ###");

for (let size of [9999, 1000, 10000, 100000, 1000000]) {
  var log = (size === 9999 ? () => {} : console.log);
  log();
  var keys = makeArray(size, false), i;

  let btree = measure(tree => `Insert ${tree.size} sorted pairs in B+ tree`, () => {
    let tree = new BTree();
    for (let k of keys)
      tree.set(k, k * 10);
    return tree;
  }, 600, log);
  let btreeSet = measure(tree => `Insert ${tree.size} sorted keys in B+ tree set (no values)`, () => {
    let tree = new BTree();
    for (let k of keys)
      tree.set(k, undefined);
    return tree;
  }, 600, log);
  // Another tree for the bulk-delete test
  let btreeSet2 = btreeSet.greedyClone();

  let sMap = measure(map => `Insert ${map.length} sorted pairs in collections' SortedMap`, () => {
    let map = new SortedMap();
    for (let k of keys)
      map.set(k, k * 10);
    return map;
  }, 600, log);
  let sSet = measure(set => `Insert ${set.length} sorted keys in collections' SortedSet (no values)`, () => {
    let set = new SortedSet();
    for (let k of keys)
      set.push(k);
    return set;
  }, 600, log);
  let fTree = measure(map => `Insert ${map.length} sorted pairs in functional-red-black-tree`, () => {
    let map = functionalTree();
    for (let k of keys)
      map = map.insert(k, k * 10);
    return map;
  }, 600, log);
  let rbTree = measure(set => `Insert ${set.size} sorted keys in bintrees' RBTree (no values)`, () => {
    let set = new RBTree((a: any, b: any) => a - b);
    for (let k of keys)
      set.insert(k);
    return set;
  }, 600, log);
  //let binTree = measure(set => `Insert ${set.size} sorted keys in bintrees' BinTree (no values)`, () => {
  //  let set = new BinTree((a: any, b: any) => a - b);
  //  for (let k of keys)
  //    set.insert(k);
  //  return set;
  //});

  // Bug fix: can't use measure() for deletions because the 
  //          trees aren't the same on the second iteration
  var timer = new Timer();
  
  for (i = 0; i < keys.length; i += 2)
    btree.delete(keys[i]);
  log(`${timer.restart()}\tDelete every second item in B+ tree`);

  for (i = 0; i < keys.length; i += 2)
    btreeSet.delete(keys[i]);
  log(`${timer.restart()}\tDelete every second item in B+ tree set`);

  btreeSet2.editRange(btreeSet2.minKey(), btreeSet2.maxKey(), true, (k,v,i) => {
    if ((i & 1) === 0) return {delete:true};
  });
  log(`${timer.restart()}\tBulk-delete every second item in B+ tree set`);

  for (i = 0; i < keys.length; i += 2)
    sMap.delete(keys[i]);
  log(`${timer.restart()}\tDelete every second item in collections' SortedMap`);

  for (i = 0; i < keys.length; i += 2)
    sSet.delete(keys[i]);
  log(`${timer.restart()}\tDelete every second item in collections' SortedSet`);

  for (i = 0; i < keys.length; i += 2)
    fTree = fTree.remove(keys[i]);
  log(`${timer.restart()}\tDelete every second item in functional-red-black-tree`);

  for (i = 0; i < keys.length; i += 2)
    rbTree.remove(keys[i]);
  log(`${timer.restart()}\tDelete every second item in bintrees' RBTree`);
}

console.log();
console.log("### Insertions at random locations: sorted-btree vs Array vs Map ###");

for (let size of [9999, 1000, 10000, 100000, 1000000]) {
  // Don't print anything in the first iteration (warm up the optimizer)
  var log = (size === 9999 ? () => {} : console.log);
  var keys = makeArray(size, true);
  log();
  
  if (size <= 100000) {
    measure(list => `Insert ${list.size} pairs in sorted array`, () => {
      let list = new SortedArray();
      for (let k of keys)
        list.set(k, k);
      return list;
    }, 600, log);
  } else {
    log(`SLOW!\tInsert ${size} pairs in sorted array`);
  }

  measure(tree => `Insert ${tree.size} pairs in B+ tree`, () => {
    let tree = new BTree();
    for (let k of keys)
      tree.set(k, k);
    return tree;
  }, 600, log);

  measure(map => `Insert ${map.size} pairs in ES6 Map (hashtable)`, () => {
    let map = new Map();
    for (let k of keys)
      map.set(k, k);
    return map;
  }, 600, log);
}

console.log();
console.log("### Insert in order, scan, delete: sorted-btree vs Array vs Map ###");

for (let size of [1000, 10000, 100000, 1000000]) {
  console.log();
  var keys = makeArray(size, false), i;

  var list = measure(list => `Insert ${list.size} sorted pairs in array`, () => {
    let list = new SortedArray();
    for (let k of keys)
      list.set(k, k * 10);
    return list;
  });

  let tree = measure(tree => `Insert ${tree.size} sorted pairs in B+ tree`, () => {
    let tree = new BTree();
    for (let k of keys)
      tree.set(k, k * 10);
    return tree;
  });

  let map = measure(map => `Insert ${map.size} sorted pairs in Map hashtable`, () => {
    let map = new Map();
    for (let k of keys)
      map.set(k, k * 10);
    return map;
  });

  measure(sum => `Sum of all values with forEach in sorted array: ${sum}`, () => {
    var sum = 0;
    list.getArray().forEach(pair => sum += pair[1]);
    return sum;
  });
  measure(sum => `Sum of all values with forEachPair in B+ tree: ${sum}`, () => {
    var sum = 0;
    tree.forEachPair((k, v) => sum += v);
    return sum;
  });
  measure(sum => `Sum of all values with forEach in B+ tree: ${sum}`, () => {
    var sum = 0;
    tree.forEach(v => sum += v);
    return sum;
  });
  measure(sum => `Sum of all values with iterator in B+ tree: ${sum}`, () => {
    var sum = 0;
    // entries() (instead of values()) with reused pair should be fastest
    // (not using for-of because tsc is in ES5 mode w/o --downlevelIteration)
    for (var it = tree.entries(undefined, []), next = it.next(); !next.done; next = it.next())
      sum += next.value[1];
    return sum;
  });
  measure(sum => `Sum of all values with forEach in Map: ${sum}`, () => {
    var sum = 0;
    map.forEach(v => sum += v);
    return sum;
  });

  if (keys.length <= 100000) {
    measure(() => `Delete every second item in sorted array`, () => {
      for (i = keys.length-1; i >= 0; i -= 2)
        list.delete(keys[i]);
    });
  } else
    console.log(`SLOW!\tDelete every second item in sorted array`);

  measure(() => `Delete every second item in B+ tree`, () => {
    for (i = keys.length-1; i >= 0; i -= 2)
      tree.delete(keys[i]);
  });
  
  measure(() => `Delete every second item in Map hashtable`, () => {
    for (i = keys.length-1; i >= 0; i -= 2)
      map.delete(keys[i]);
  });
}

console.log();
console.log("### How max node size affects performance ###");
{
  console.log();
  var keys = makeArray(100000, true);
  var timer = new Timer();
  for (let nodeSize = 10; nodeSize <= 80; nodeSize += 2) {
    let tree = new BTree([], undefined, nodeSize);
    for (let i = 0; i < keys.length; i++)
      tree.set(keys[i], keys[i] + 1);
    console.log(`${timer.restart()}\tInsert ${tree.size} keys in B+tree with node size ${tree.maxNodeSize}`);
  }
}

console.log();
console.log("### BTree.diffAgainst()");
{
  console.log();
  const sizes = [100, 1000, 10000, 100000, 1000000];

  sizes.forEach((size, i) => {
    const tree = fillBTreeOfSize(size);
    sizes.slice(0, i).forEach(otherSize => {
      const otherTree = fillBTreeOfSize(otherSize);

      measure(() => `BTree.diffAgainst ${size} pairs vs ${otherSize} pairs`, () => {
        tree.diffAgainst(otherTree, inTree => {}, inOther => {});
      });
    });
  });

  console.log();
  sizes.forEach((size, i) => {
    sizes.forEach(otherSize => {
      const keys = makeArray(size + otherSize, true);
      const tree = new BTreeEx();
      for (let k of keys.slice(0, size))
        tree.set(k, k * 2);
      
      const otherTree = tree.clone();
      for (let k of keys.slice(size))
        tree.set(k, k * 2);

      measure(() => `BTree.diffAgainst ${size} pairs vs cloned copy with ${otherSize} extra pairs`, () => {
        tree.diffAgainst(otherTree, inTree => {}, inOther => {});
      });
    });
  });
}

console.log();
console.log("### Accelerated union of B+ trees");
{
  console.log();
  const sizes = [100, 1000, 10000, 100000];

  const preferLeftUnion = (_k: number, leftValue: any, _rightValue: any) => leftValue;

  const measureUnionVsBaseline = (
    baseTitle: string,
    tree1: BTreeEx<number, number>,
    tree2: BTreeEx<number, number>,
    includeBaseline = true,
    prefer = preferLeftUnion,
  ) => {
    const unionResult = measure(() => `union():  ${baseTitle}`, () => {
      return tree1.union(tree2, prefer);
    });
    logTreeNodeStats('union(): ', unionResult);

    if (includeBaseline) {
      const baselineResult = measure(() => `baseline: ${baseTitle}`, () => {
        const result = tree1.clone();
        tree2.forEachPair((k, v) => {
          result.set(k, v, false);
        });
        return result;
      });
      logTreeNodeStats('baseline:', baselineResult);
    }
  };

  testNonOverlappingRanges('Union', sizes, measureUnionVsBaseline);
  testMaybeOverlappingRanges('Union', sizes, 1,
    (txt, t1, t2) => measureUnionVsBaseline(txt, t1, t2, false),
    "Adjacent ranges (one intersection point)");

  console.log();
  console.log("#### Interleaved ranges (two intersection points)");
  sizes.forEach((size) => {
    const tree1 = new BTreeEx<number, number>();
    const tree2 = new BTreeEx<number, number>();

    // Tree1: 0 to size, 2*size to 3*size
    // Tree2: size to 2*size
    for (let i = 0; i <= size; i++) {
      tree1.set(i, i);
      tree1.set(i + 2 * size, i + 2 * size);
      tree2.set(i + size, i + size);
    }

    measureUnionVsBaseline(`Union ${size * 2}+${size} interleaved range trees`, tree1, tree2, false);
  });

  testCompleteOverlap('Union trees', sizes, measureUnionVsBaseline, 'Complete overlap (all keys intersect)');
  testPercentOverlap('Union trees', sizes, 10, measureUnionVsBaseline);
  testRandomOverlaps('Union', sizes, (t, t1, t2) => measureUnionVsBaseline(t, t1, t2, false), "Union random overlaps");

  console.log();
  console.log("#### Union with empty tree");
  [100000].forEach((size) => {
    const tree1 = fillBTreeOfSize(size);
    const tree2 = new BTreeEx<number, number>();

    const baseTitle = `Union ${size}-key tree with empty tree`;
    measureUnionVsBaseline(baseTitle, tree1, tree2);
  });

  testLargeSparseOverlap('Union', measureUnionVsBaseline);
}

console.log();
console.log("### Subtraction of B+ trees");
{
  console.log();
  const sizes = [100, 1000, 10000, 100000];

  const measureSubtractVsBaseline = (
    baseTitle: string,
    includeTree: BTreeEx<number, number>,
    excludeTree: BTreeEx<number, number>,
  ) => {
    const subtractResult = measure(() => `subtract: ${baseTitle}`, () => {
      return subtract<BTreeEx<number, number>, number, number>(includeTree, excludeTree);
    });
    logTreeNodeStats('subtract:', subtractResult);

    // Baseline
    const baselineResult = measure(() => `baseline: ${baseTitle}`, () => {
      const result = includeTree.clone();
      excludeTree.forEachPair((key) => {
        result.delete(key);
      });
      return result;
    });
    logTreeNodeStats('baseline:', baselineResult);
  };

  testNonOverlappingRanges('Subtract', sizes, measureSubtractVsBaseline, "Non-overlapping ranges (nothing removed)");

  testPartialMiddleOverlap('Subtract', sizes, measureSubtractVsBaseline, "Partial overlap (middle segment removed)");

  console.log();
  console.log("#### Interleaved keys (every other key removed)");
  sizes.forEach((size) => {
    const includeTree = fillBTreeOfSize(size * 2, 0, 1);
    const excludeTree = new BTreeEx<number, number>();
    for (let i = 0; i < size * 2; i += 2)
      excludeTree.set(i, i);

    const baseTitle = `Subtract ${includeTree.size}-${excludeTree.size} interleaved trees`;
    measureSubtractVsBaseline(baseTitle, includeTree, excludeTree);
  });

  testCompleteOverlap('Subtract', sizes, measureSubtractVsBaseline, "Complete overlap (entire tree removed)");

  console.log();
  console.log("#### Random overlaps (~10% removed)");
  sizes.forEach((size) => {
    const keysInclude = makeArray(size, true);
    const keysExclude = makeArray(size, true);
    const overlapCount = Math.max(1, Math.floor(size * 0.1));
    for (let i = 0; i < overlapCount && i < keysInclude.length && i < keysExclude.length; i++) {
      keysExclude[i] = keysInclude[i];
    }

    const includeTree = new BTreeEx<number, number>();
    const excludeTree = new BTreeEx<number, number>();
    for (const key of keysInclude)
      includeTree.set(key, key * 3);
    for (const key of keysExclude)
      excludeTree.set(key, key * 7);

    const baseTitle = `Subtract ${includeTree.size}-${excludeTree.size} random trees`;
    measureSubtractVsBaseline(baseTitle, includeTree, excludeTree);
  });

  console.log();
  console.log("#### Subtract empty tree");
  sizes.forEach((size) => {
    const includeTree = fillBTreeOfSize(size, 0, 1, 1);
    const excludeTree = new BTreeEx<number, number>();

    measureSubtractVsBaseline(`Subtract ${includeTree.size}-0 keys`, includeTree, excludeTree);
  });

  testLargeSparseOverlap('Subtract', measureSubtractVsBaseline,
    "Large sparse-overlap trees (1M keys each, 10 overlaps per 100k)");
}

console.log();
console.log("### Omitting a key range from B+ trees");
{
  const sizes = [100, 1000, 10000, 100000, 1000000];
  const trees = sizes.map((size) => fillBTreeOfSize(size, 0, 1, 1));

  const measureOmitVsBaseline = (
    baseTitle: string,
    tree: BTreeEx<number, number>,
    start: number | undefined,
    end: number | undefined,
  ) => {
    const omitResult = measure(() => `omit:     ${baseTitle}`, () => {
      return tree.omit(start as number, end);
    });
    logTreeNodeStats('omit:    ', omitResult);

    // Baseline: the core library's approach (as in `withoutRange`)
    const baselineResult = measure(() => `baseline: ${baseTitle}`, () => {
      const result = tree.clone();
      result.deleteRange(start ?? tree.minKey()!, end ?? tree.maxKey()!, end === undefined);
      return result;
    });
    logTreeNodeStats('baseline:', baselineResult);
  };

  const testOmitRanges = (heading: string, title: (size: number) => string,
    getRange: (size: number) => [number | undefined, number | undefined]) => {
    console.log();
    console.log('#### ' + heading);
    trees.forEach((tree, i) => {
      const [start, end] = getRange(sizes[i]);
      measureOmitVsBaseline(title(sizes[i]), tree, start, end);
    });
  };

  testOmitRanges("Middle half removed", size => `Omit middle ${size / 2} of ${size} keys`,
    size => [size / 4, size * 3 / 4]);
  testOmitRanges("Prefix removed (no start bound)", size => `Omit first ${size / 2} of ${size} keys`,
    size => [undefined, size / 2]);
  testOmitRanges("Suffix removed (no end bound)", size => `Omit last ${size / 2} of ${size} keys`,
    size => [size / 2, undefined]);
  testOmitRanges("Small range removed (10 keys)", size => `Omit 10 middle keys of ${size} keys`,
    size => [size / 2, size / 2 + 10]);
  testOmitRanges("Empty range (gap between keys, nothing removed)", size => `Omit empty range of ${size} keys`,
    size => [size / 2 + 0.25, size / 2 + 0.75]);
}

console.log();
console.log("### Intersection between B+ trees");
{
  console.log();
  const sizes = [100, 1000, 10000, 100000];
  const preferLeftIntersection = (_k: number, leftValue: number, _rightValue: number) => leftValue;

  const measureIntersectVsBaseline = (
    baseTitle: string,
    tree1: BTreeEx<number, number>,
    tree2: BTreeEx<number, number>,
    combine = preferLeftIntersection,
  ) => {
    const intersectResult = measure(() => `intersect: ${baseTitle}`, () => {
      return tree1.intersect(tree2, combine);
    });
    logTreeNodeStats('intersect:', intersectResult);

    // Baseline
    const baselineResult = measure(() => `baseline:  ${baseTitle}`, () => {
      const result = new BTreeEx<number, number>(undefined, tree1._compare, tree1._maxNodeSize);
      intersectBySorting(tree1, tree2, (key, leftValue, rightValue) => {
        const mergedValue = combine(key, leftValue, rightValue);
        result.set(key, mergedValue);
      });
      return result;
    });
    logTreeNodeStats('baseline: ', baselineResult);
  };

  testNonOverlappingRanges('Intersect', sizes, measureIntersectVsBaseline);
  testPartialMiddleOverlap('Intersect', sizes, measureIntersectVsBaseline,
    "Partial overlap (middle segment shared)");

  console.log();
  console.log("#### Interleaved keys (every other key shared)");
  sizes.forEach((size) => {
    const tree1 = new BTreeEx<number, number>();
    const tree2 = new BTreeEx<number, number>();
    for (let i = 0; i < size * 2; i++) {
      tree1.set(i, i);
      if (i % 2 === 0)
        tree2.set(i, i * 3);
    }

    measureIntersectVsBaseline(`Intersect ${tree1.size}+${tree2.size} interleaved trees`, tree1, tree2);
  });

  console.log();
  console.log("#### Complete overlap (all keys shared)");
  sizes.forEach((size) => {
    const tree1 = fillBTreeOfSize(size, 0, 1, 1);
    const tree2 = fillBTreeOfSize(size, 0, 1, 5);

    measureIntersectVsBaseline(`Intersect ${tree1.size}+${tree2.size} identical trees`, tree1, tree2);
  });

  testRandomOverlaps('Intersect', sizes, measureIntersectVsBaseline);

  console.log();
  console.log("#### Intersection with empty tree");
  sizes.forEach((size) => {
    const tree1 = fillBTreeOfSize(size, 0, 1, 1);
    const tree2 = new BTreeEx<number, number>();

    measureIntersectVsBaseline(`Intersect ${tree1.size}-key tree with empty tree`, tree1, tree2);
  });

  testLargeSparseOverlap('Intersect', measureIntersectVsBaseline);
}

console.log();
console.log("### forEachKeyInBoth");
{
  const sizes = [100, 1000, 10000, 100000];

  const timeForEachKeyInBothVsBaseline = (
    baseTitle: string,
    tree1: BTreeEx<number, number>,
    tree2: BTreeEx<number, number>,
    forEachKeyInBothLabel = 'forEachKeyInBoth()',
  ) => {
    measure<{count: number, checksum: number }>(
      result => `forEachKeyInBoth: [count=${result.count}, checksum=${result.checksum}]`,
      function runForEachKeyInBoth() {
        let count = 0;
        let checksum = 0;
        tree1.forEachKeyInBoth(tree2, (_k, leftValue, rightValue) => {
          count++;
          checksum += leftValue + rightValue;
        });
        return { count, checksum };
      });
    measure<{count: number, checksum: number }>(
      result => `Baseline method:  [count=${result.count}, checksum=${result.checksum}]`,
      function runBaseline() {
        let count = 0;
        let checksum = 0;
        intersectBySorting(tree1, tree2, (_k, leftValue, rightValue) => {
          count++;
          checksum += leftValue + rightValue;
        });
        return { count, checksum };
      });
  };

  testNonOverlappingRanges('forEachKeyInBoth', sizes, timeForEachKeyInBothVsBaseline);
  test50PercentOverlappingRanges('forEachKeyInBoth', sizes, timeForEachKeyInBothVsBaseline);
  testCompleteOverlap('forEachKeyInBoth', sizes, timeForEachKeyInBothVsBaseline);
  testRandomOverlaps('forEachKeyInBoth', sizes, timeForEachKeyInBothVsBaseline);
  testLargeSparseOverlap('forEachKeyInBoth', timeForEachKeyInBothVsBaseline);
}

console.log();
console.log("### forEachKeyNotIn");
{
  const sizes = [100, 1000, 10000, 100000];

  const measureForEachKeyNotInVsBaseline = (
    baseTitle: string,
    includeTree: BTreeEx<number, number>,
    excludeTree: BTreeEx<number, number>,
  ) => {
    measure<{count: number, checksum: number }>(
      result => `forEachKeyNotIn: [count=${result.count}, checksum=${result.checksum}]`,
      function runForEachKeyNotIn() {
        let count = 0;
        let checksum = 0;
        forEachKeyNotIn(includeTree, excludeTree, (_key, value) => {
          count++;
          checksum += value;
        });
        return { count, checksum };
      });
    measure<{count: number, checksum: number }>(
      result => `baseline method: [count=${result.count}, checksum=${result.checksum}]`,
      function runBaseline() {
        let count = 0;
        let checksum = 0;
        subtractBySorting(includeTree, excludeTree, (_key, value) => {
          count++;
          checksum += value;
        });
        return { count, checksum };
      });
  };

  testNonOverlappingRanges('forEachKeyNotIn', sizes, measureForEachKeyNotInVsBaseline,
    "Non-overlapping ranges (all keys survive)");
  test50PercentOverlappingRanges('forEachKeyNotIn', sizes, measureForEachKeyNotInVsBaseline);
  testCompleteOverlap('forEachKeyNotIn', sizes, measureForEachKeyNotInVsBaseline,
    "Complete overlap (no keys survive)");
  testRandomOverlaps('forEachKeyNotIn', sizes, measureForEachKeyNotInVsBaseline,
    "Random overlaps (~10% of include removed)");
  testLargeSparseOverlap('forEachKeyNotIn', measureForEachKeyNotInVsBaseline);
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//MARK: Shared test patterns

function fillBTreeOfSize(size: number, first = 0, spacing?: number, valueMult = 2, randomOrder = false) {
  const tree = new BTreeEx();
  for (let k of makeArray(size, randomOrder, first, spacing))
    tree.set(k, k * valueMult);
  return tree;
}

type TwoTreeBenchmark = (baseTitle: string, tree1: BTreeEx<number, number>, tree2: BTreeEx<number, number>) => void;

function testNonOverlappingRanges(
  labelPrefix: string, sizes: number[], run: TwoTreeBenchmark,
  heading = "Non-overlapping ranges (no shared keys)"
) {
  return testMaybeOverlappingRanges(labelPrefix, sizes, -100, run, heading);
}

function testMaybeOverlappingRanges(
  labelPrefix: string, sizes: number[], overlap: number, run: TwoTreeBenchmark, heading: string,
) {
  console.log();
  console.log('#### ' + heading);
  sizes.forEach((size) => {
    const tree1 = fillBTreeOfSize(size, 0, 1, 1);
    const tree2 = fillBTreeOfSize(size, size - overlap, 1, 1);
    console.assert(tree1.minKey() === 0 && tree1.maxKey() === size - 1);
    console.assert(tree2.minKey() === size - overlap && tree2.maxKey() === size - overlap + size - 1);

    const descr = overlap > 0 ? `trees with ${overlap} keys overlaping` : `disjoint trees`;
    const baseTitle = `${labelPrefix} ${size}+${size} ${descr}`;
    run(baseTitle, tree1, tree2);
  });
}

function test50PercentOverlappingRanges(
  labelPrefix: string, sizes: number[], run: TwoTreeBenchmark, heading: string = "50% overlapping ranges",
) {
  console.log();
  console.log('#### ' + heading);
  sizes.forEach((size) => {
    const tree1 = fillBTreeOfSize(size, 0, 1, 1);
    const tree2 = fillBTreeOfSize(size, Math.floor(size / 2), 1, 2);

    const baseTitle = `${labelPrefix} ${tree1.size}+${tree2.size} half-overlapping trees`;
    run(baseTitle, tree1, tree2);
  });
}

function testCompleteOverlap(
  labelPrefix: string, sizes: number[], run: TwoTreeBenchmark, heading: string = "Complete overlap (all keys shared)",
) {
  console.log();
  console.log('#### ' + heading);
  sizes.forEach((size) => {
    const tree1 = fillBTreeOfSize(size, 0, 1, 1);
    const tree2 = fillBTreeOfSize(size, 0, 1, 3);
    console.assert(tree1.minKey() === tree2.minKey() && tree1.maxKey() === tree2.maxKey());

    const baseTitle = `${labelPrefix} ${tree1.size}+${tree2.size} identical-key trees`;
    run(baseTitle, tree1, tree2);
  });
}

function testPercentOverlap(
  labelPrefix: string, sizes: number[], percent: number, run: TwoTreeBenchmark, heading?: string,
) {
  console.log();
  console.log('#### ' + (heading ?? `${percent}% overlap`));
  sizes.forEach((size) => {
    const tree1 = fillBTreeOfSize(size, 0, 1, 1);
    const tree2 = fillBTreeOfSize(size, Math.floor(size * (1 - percent/100)), 1, 2);

    const baseTitle = `${labelPrefix} with ${percent}% overlap (${size}+${size} keys)`;
    run(baseTitle, tree1, tree2);
  });
}

function testPartialMiddleOverlap(
  labelPrefix: string, sizes: number[], run: TwoTreeBenchmark,
  heading: string = "Partial overlap (middle segment)",
) {
  console.log();
  console.log('#### ' + heading);
  sizes.forEach((size) => {
    const tree1 = fillBTreeOfSize(size, 0, 1, 1);
    const tree2 = fillBTreeOfSize(Math.floor(size / 2), Math.floor(size / 3), 1, 10);

    const baseTitle = `${labelPrefix} ${tree1.size}+${tree2.size} partially overlapping trees`;
    run(baseTitle, tree1, tree2);
  });
}

function testRandomOverlaps(
  labelPrefix: string, sizes: number[], run: TwoTreeBenchmark,
  heading: string = "Random overlaps (~10% shared keys)",
) {
  console.log();
  console.log('#### ' + heading);
  sizes.forEach((size) => {
    const keys1 = makeArray(size, true);
    const keys2 = makeArray(size, true);
    const overlapCount = Math.max(1, Math.floor(size * 0.1));
    for (let i = 0; i < overlapCount && i < keys1.length && i < keys2.length; i++) {
      keys2[i] = keys1[i];
    }

    const tree1 = new BTreeEx<number, number>();
    const tree2 = new BTreeEx<number, number>();

    for (let i = 0; i < keys1.length; i++) {
      const key = keys1[i];
      tree1.set(key, key * 5);
    }
    for (let i = 0; i < keys2.length; i++) {
      const key = keys2[i];
      tree2.set(key, key * 7);
    }

    const baseTitle = `${labelPrefix} ${tree1.size}+${tree2.size} random trees`;
    run(baseTitle, tree1, tree2);
  });
}

function testLargeSparseOverlap(
  labelPrefix: string, run: TwoTreeBenchmark,
  heading: string = "Large sparse-overlap trees (1M keys each, 10 overlaps per 100k)",
) {
  console.log();
  console.log('#### ' + heading);

  const totalKeys = 1_000_000;
  const overlapInterval = 100_000;
  const overlapPerInterval = 10;

  const tree1 = new BTreeEx<number, number>();
  for (let i = 0; i < totalKeys; i++) {
    tree1.set(i, i);
  }

  const tree2 = new BTreeEx<number, number>();
  for (let i = 0; i < totalKeys; i++) {
    if ((i % overlapInterval) < overlapPerInterval) {
      tree2.set(i, i * 7);
    } else {
      tree2.set(totalKeys + i, (totalKeys + i) * 7);
    }
  }

  const baseTitle = `${labelPrefix} ${tree1.size}+${tree2.size} sparse-overlap trees`;
  run(baseTitle, tree1, tree2);
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//MARK: Baseline algorithms

/** calls `callback` for each key and pair of values that is in both `tree1` and `tree2` (O(n)) */
function intersectBySorting(
  tree1: BTree<number, number>, tree2: BTree<number, number>,
  callback: (k: number, leftValue: number, rightValue: number) => void
) {
  const left = tree1.toArray();
  const right = tree2.toArray();
  let i = 0;
  let j = 0;
  const leftLen = left.length;
  const rightLen = right.length;

  while (i < leftLen && j < rightLen) {
    const [leftKey, leftValue] = left[i];
    const [rightKey, rightValue] = right[j];
    if (leftKey === rightKey) {
      callback(leftKey, leftValue, rightValue);
      i++;
      j++;
    } else if (leftKey < rightKey) {
      i++;
    } else {
      j++;
    }
  }
}

/** calls `callback` for each key and value that is in `tree1` but not `tree2` (O(n)) */
function subtractBySorting(
  includeTree: BTree<number, number>, excludeTree: BTree<number, number>,
  callback: (k: number, value: number) => void
) {
  const include = includeTree.toArray();
  const exclude = excludeTree.toArray();
  let i = 0;
  let j = 0;
  const includeLen = include.length;
  const excludeLen = exclude.length;

  while (i < includeLen) {
    const [includeKey, includeValue] = include[i];
    while (j < excludeLen && exclude[j][0] < includeKey)
      j++;
    if (j < excludeLen && exclude[j][0] === includeKey) {
      i++;
      continue;
    }
    callback(includeKey, includeValue);
    i++;
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//MARK: Core functionality

function perfNow(): number {
  return performance.now();
}

function randInt(max: number) { return Math.random() * max | 0; }

function swap(keys: any[], i: number, j: number) {
  var tmp = keys[i];
  keys[i] = keys[j];
  keys[j] = tmp;
}

/** Returns an array of numbers.
 * 
 *  @param size Array size
 *  @param randomOrder Whether to randomize the order after constructing the array
 *  @param spacing Max amount by which each number is bigger than the previous one (1 = no gaps)
 *  @param lowest Lowest value in the array
 */
function makeArray(size: number, randomOrder: boolean, lowest = 0, spacing = 10) {
  var keys: number[] = [], i, n;
  for (i = 0, n = lowest; i < size; i++, n += 1 + randInt(spacing))
    keys[i] = n;
  if (randomOrder)
    for (i = 0; i < size; i++) 
      swap(keys, i, randInt(size));
  return keys;
}

// Benchmark harness helper.
// Runs the callback up to 6 times, using the first run as a warmup if the first run takes less
// than `approxMillisec`. If multiple runs happen, the warmup run is excluded from measurement.
function measure<T=void>(
  message: (t:T) => string,
  callback: () => T,
  approxMillisec: number = 600,
  log = console.log
) {
  const timer = new Timer();

  let result = callback();
  let runCount = 1;
  const warmupEndMs = timer.ms();

  for (; runCount < 10 && timer.ms() < approxMillisec; runCount++)
    callback();

  let endMs = timer.ms(), measuredMs = endMs, measuredRuns = runCount;
  if (runCount > 1) {
    measuredMs = endMs - warmupEndMs;
    measuredRuns = runCount - 1;
  }

  const avgMs = measuredMs / measuredRuns;
  log((Math.round(avgMs * 100) / 100) + "\t" + message(result));
  return result;
}
