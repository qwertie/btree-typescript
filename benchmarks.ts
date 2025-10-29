#!/usr/bin/env ts-node
import BTree, {IMap} from '.';
import SortedArray from './sorted-array';
// Note: The `bintrees` package also includes a `BinTree` type which turned
// out to be an unbalanced binary tree. It is faster than `RBTree` for
// randomized data, but it becomes extremely slow when filled with sorted 
// data, so it's not usually a good choice.
import {RBTree} from 'bintrees';
const SortedSet = require("collections/sorted-set");         // Bad type definition: missing 'length'
const SortedMap = require("collections/sorted-map");         // No type definitions available
const functionalTree = require("functional-red-black-tree"); // No type definitions available

class Timer {
  start = Date.now();
  ms() { return Date.now() - this.start; }
  restart() { var ms = this.ms(); this.start += ms; return ms; }
}

function randInt(max: number) { return Math.random() * max | 0; }

function swap(keys: any[], i: number, j: number) {
  var tmp = keys[i];
  keys[i] = keys[j];
  keys[j] = tmp;
}

function makeArray(size: number, randomOrder: boolean, spacing = 10) {
  var keys: number[] = [], i, n;
  for (i = 0, n = 0; i < size; i++, n += 1 + randInt(spacing))
    keys[i] = n;
  if (randomOrder)
    for (i = 0; i < size; i++) 
      swap(keys, i, randInt(size));
  return keys;
}

function measure<T=void>(message: (t:T) => string, callback: () => T, minMillisec: number = 600, log = console.log) {
  var timer = new Timer(), counter = 0, ms;
  do {
    var result = callback();
    counter++;
  } while ((ms = timer.ms()) < minMillisec);
  ms /= counter;
  log((Math.round(ms * 10) / 10) + "\t" + message(result));
  return result;
}

function countTreeNodeStats(tree: BTree<any, any>) {
  const root = (tree as any)._root;
  if (!root)
    return { total: 0, shared: 0 };

  const visit = (node: any, ancestorShared: boolean): { total: number, shared: number } => {
    if (!node)
      return { total: 0, shared: 0 };
    const selfShared = node.sharedSizeTag < 0 || ancestorShared;
    let shared = selfShared ? 1 : 0;
    let total = 1;
    const children: any[] | undefined = node.children;
    if (children) {
      for (const child of children) {
        const stats = visit(child, selfShared);
        total += stats.total;
        shared += stats.shared;
      }
    }
    return { total, shared };
  };

  return visit(root, false);
}

console.log("Benchmark results (milliseconds with integer keys/values)");
console.log("---------------------------------------------------------");

console.log();
console.log("### Insertions at random locations: sorted-btree vs the competition ###");

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
console.log("### Measure effect of max node size ###");
{
  console.log();
  var keys = makeArray(100000, true);
  var timer = new Timer();
  for (let nodeSize = 10; nodeSize <= 80; nodeSize += 2) {
    let tree = new BTree([], undefined, nodeSize);
    for (let i = 0; i < keys.length; i++)
      tree.set(keys[i], undefined);
    console.log(`${timer.restart()}\tInsert ${tree.size} keys in B+tree with node size ${tree.maxNodeSize}`);
  }
}

console.log();
console.log("### Delta between B+ trees");
{
  console.log();
  const sizes = [100, 1000, 10000, 100000, 1000000];

  sizes.forEach((size, i) => {
    for (let j = i; j < sizes.length; j++) {
      const tree = new BTree();
      for (let k of makeArray(size, true))
        tree.set(k, k * 10);

      const otherSize = sizes[j];
      const otherTree = new BTree();
      for (let k of makeArray(otherSize, true))
        otherTree.set(k, k * 10);

      measure(() => `Delta between B+ trees with ${size} nodes and B+tree with ${otherSize} nodes`, () => {
        tree.diffAgainst(otherTree);
      });
    }
  })

  console.log();
  sizes.forEach((size, i) => {
    for (let j = 0; j < sizes.length; j++) {
      const otherSize = sizes[j];
      const keys = makeArray(size + otherSize, true);
      const tree = new BTree();
      for (let k of keys.slice(0, size))
        tree.set(k, k * 10);
      
      const otherTree = tree.clone();
      for (let k of keys.slice(size))
        tree.set(k, k * 10);

      measure(() => `Delta between B+ trees with ${size} nodes and cheap cloned B+tree with ${otherSize} additional nodes`, () => {
        tree.diffAgainst(otherTree);
      });
    }
  })
}

console.log();
console.log("### Merge between B+ trees");
{
  console.log();
  const sizes = [100, 1000, 10000, 100000];

  // Test 1: Non-overlapping ranges (best case - minimal intersections)
  console.log("# Non-overlapping ranges (disjoint keys)");
  sizes.forEach((size) => {
    const tree1 = new BTree();
    const tree2 = new BTree();

    const offset = size * 3;
    for (let i = 0; i < size; i++) {
      tree1.set(i, i);                    // Keys: 0...(size-1)
      tree2.set(offset + i, offset + i);  // Keys well beyond tree1's range
    }

    const preferLeft = (_k: number, v1: number, _v2: number) => v1;
    const mergeResult = measure(() => `Merge ${size}+${size} non-overlapping trees using merge()`, () => {
      return tree1.merge(tree2, preferLeft);
    });
    const mergeStats = countTreeNodeStats(mergeResult);
    console.log(`\tShared nodes (merge): ${mergeStats.shared}/${mergeStats.total}`);

    const baselineResult = measure(() => `Merge ${size}+${size} non-overlapping trees using clone+set loop (baseline)`, () => {
      const result = tree1.clone();
      tree2.forEachPair((k, v) => {
        result.set(k, v, false);
      });
      return result;
    });
    const baselineStats = countTreeNodeStats(baselineResult);
    console.log(`\tShared nodes (baseline): ${baselineStats.shared}/${baselineStats.total}`);
  });

  console.log();
  console.log("# Adjacent ranges (one intersection points)");
  sizes.forEach((size) => {
    const tree1 = new BTree();
    const tree2 = new BTree();

    // Tree1: 0-size, Tree2: size-(2*size)
    for (let i = 0; i < size; i++) {
      tree1.set(i, i);
      tree2.set(i + size, i + size);
    }

    const preferLeft = (_k: number, v1: number, _v2: number) => v1;
    const mergeResult = measure(() => `Merge ${size}+${size} adjacent range trees using merge()`, () => {
      return tree1.merge(tree2, preferLeft);
    });
    const mergeStats = countTreeNodeStats(mergeResult);
    console.log(`\tShared nodes (merge): ${mergeStats.shared}/${mergeStats.total}`);

    const baselineResult = measure(() => `Merge ${size}+${size} adjacent range trees using clone+set loop (baseline)`, () => {
      const result = tree1.clone();
      tree2.forEachPair((k, v) => {
        result.set(k, v, false);
      });
      return result;
    });
    const baselineStats = countTreeNodeStats(baselineResult);
    console.log(`\tShared nodes (baseline): ${baselineStats.shared}/${baselineStats.total}`);
  });

  console.log();
  console.log("# Interleaved ranges (two intersection points)");
  sizes.forEach((size) => {
    const tree1 = new BTree();
    const tree2 = new BTree();

    // Tree1: 0-size, 2*size-3*size
    // Tree2: size-2*size
    for (let i = 0; i < size; i++) {
      tree1.set(i, i);
      tree1.set(i + 2 * size, i + 2 * size);
      tree2.set(i + size, i + size);
    }

    const preferLeft = (_k: number, v1: number, _v2: number) => v1;
    const mergeResult = measure(() => `Merge ${size*2}+${size} interleaved range trees using merge()`, () => {
      return tree1.merge(tree2, preferLeft);
    });
    const mergeStats = countTreeNodeStats(mergeResult);
    console.log(`\tShared nodes (merge): ${mergeStats.shared}/${mergeStats.total}`);

    const baselineResult = measure(() => `Merge ${size*2}+${size} interleaved range trees using clone+set loop (baseline)`, () => {
      const result = tree1.clone();
      tree2.forEachPair((k, v) => {
        result.set(k, v, false);
      });
      return result;
    });
    const baselineStats = countTreeNodeStats(baselineResult);
    console.log(`\tShared nodes (baseline): ${baselineStats.shared}/${baselineStats.total}`);
  });

  console.log();
  console.log("# Complete overlap (worst case - all keys intersect)");
  sizes.forEach((size) => {
    const tree1 = new BTree();
    const tree2 = new BTree();

    for (let i = 0; i < size; i++) {
      tree1.set(i, i);
      tree2.set(i, i * 10);
    }

    const preferLeft = (_k: number, v1: number, _v2: number) => v1;
    const mergeResult = measure(() => `Merge ${size}+${size} completely overlapping trees (prefer left)`, () => {
      return tree1.merge(tree2, preferLeft);
    });
    const mergeStats = countTreeNodeStats(mergeResult);
    console.log(`\tShared nodes (merge): ${mergeStats.shared}/${mergeStats.total}`);
  });

  console.log();
  console.log("# Partial overlap (10% intersection)");
  sizes.forEach((size) => {
    const tree1 = new BTree();
    const tree2 = new BTree();

    // Tree1: 0-(size)
    // Tree2: (~0.9*size)-(1.9*size)
    // Overlap: last 10% of tree1 and first 10% of tree2
    for (let i = 0; i < size; i++) {
      tree1.set(i, i);
    }
    const offset = Math.floor(size * 0.9);
    for (let i = 0; i < size; i++) {
      const key = offset + i;
      tree2.set(key, key * 10);
    }

    const preferLeft = (_k: number, v1: number, _v2: number) => v1;
    const mergeResult = measure(() => `Merge trees with 10% overlap (${size}+${size} keys) using merge()`, () => {
      return tree1.merge(tree2, preferLeft);
    });
    const mergeStats = countTreeNodeStats(mergeResult);
    console.log(`\tShared nodes (merge): ${mergeStats.shared}/${mergeStats.total}`);

    const baselineResult = measure(() => `Merge trees with 10% overlap (${size}+${size} keys) using clone+set loop (baseline)`, () => {
      const result = tree1.clone();
      tree2.forEachPair((k, v) => {
        result.set(k, v, false);
      });
      return result;
    });
    const baselineStats = countTreeNodeStats(baselineResult);
    console.log(`\tShared nodes (baseline): ${baselineStats.shared}/${baselineStats.total}`);
  });

  console.log();
  console.log("# Merge random overlaps");
  sizes.forEach((size) => {
    const keys1 = makeArray(size, true);
    const keys2 = makeArray(size, true);

    const tree1 = new BTree();
    const tree2 = new BTree();

    for (let k of keys1) {
      tree1.set(k, k);
    }
    for (let k of keys2) {
      tree2.set(k, k * 10);
    }

    const preferLeft = (_k: number, v1: number, _v2: number) => v1;
    const mergeResult = measure(() => `Merge ${tree1.size}+${tree2.size} trees with random keys using merge()`, () => {
      return tree1.merge(tree2, preferLeft);
    });
    const mergeStats = countTreeNodeStats(mergeResult);
    console.log(`\tShared nodes (merge): ${mergeStats.shared}/${mergeStats.total}`);

    const baselineResult = measure(() => `Merge ${tree1.size}+${tree2.size} trees with random keys using clone+set loop (baseline)`, () => {
      const result = tree1.clone();
      tree2.forEachPair((k, v) => {
        result.set(k, v, false);
      });
      return result;
    });
    const baselineStats = countTreeNodeStats(baselineResult);
    console.log(`\tShared nodes (baseline): ${baselineStats.shared}/${baselineStats.total}`);
  });

  console.log();
  console.log("# Merge with empty tree");
  sizes.forEach((size) => {
    const tree1 = new BTree();
    const tree2 = new BTree();

    for (let i = 0; i < size; i++) {
      tree1.set(i, i);
    }

    const preferLeft = (_k: number, v1: number, _v2: number) => v1;
    const mergeResult = measure(() => `Merge ${size}-key tree with empty tree`, () => {
      return tree1.merge(tree2, preferLeft);
    });
    const mergeStats = countTreeNodeStats(mergeResult);
    console.log(`\tShared nodes (merge): ${mergeStats.shared}/${mergeStats.total}`);
  });

  console.log();
  console.log("# Compare merge vs manual iteration for complete overlap");
  sizes.forEach((size) => {
    const tree1 = new BTree();
    const tree2 = new BTree();

    for (let i = 0; i < size; i++) {
      tree1.set(i, i);
      tree2.set(i, i * 10);
    }

    const preferLeft = (_k: number, v1: number, _v2: number) => v1;

    const mergeResult = measure(() => `Merge ${size}+${size} overlapping trees using merge()`, () => {
      return tree1.merge(tree2, preferLeft);
    });
    const mergeStats = countTreeNodeStats(mergeResult);
    console.log(`\tShared nodes (merge): ${mergeStats.shared}/${mergeStats.total}`);

    const baselineResult = measure(() => `Merge ${size}+${size} overlapping trees using clone+set loop (baseline)`, () => {
      const result = tree1.clone();
      tree2.forEachPair((k, v) => {
        result.set(k, v, false); // Don't overwrite
      });
      return result;
    });
    const baselineStats = countTreeNodeStats(baselineResult);
    console.log(`\tShared nodes (baseline): ${baselineStats.shared}/${baselineStats.total}`);
  });

  console.log();
  console.log("# Large sparse-overlap trees (1M keys each, 10 overlaps per 100k)");
  {
    const totalKeys = 1_000_000;
    const overlapInterval = 100_000;
    const overlapPerInterval = 10;

    const tree1 = new BTree<number, number>();
    for (let i = 0; i < totalKeys; i++) {
      tree1.set(i, i);
    }

    const tree2 = new BTree<number, number>();
    for (let i = 0; i < totalKeys; i++) {
      if ((i % overlapInterval) < overlapPerInterval) {
        tree2.set(i, i);
      } else {
        tree2.set(totalKeys + i, totalKeys + i);
      }
    }

    const preferLeft = (_k: number, v1: number, _v2: number) => v1;

    const mergeResult = measure(() => `Merge ${tree1.size}+${tree2.size} sparse-overlap trees using merge()`, () => {
      return tree1.merge(tree2, preferLeft);
    });
    const mergeStats = countTreeNodeStats(mergeResult);
    console.log(`\tShared nodes (merge): ${mergeStats.shared}/${mergeStats.total}`);

    const baselineResult = measure(() => `Merge ${tree1.size}+${tree2.size} sparse-overlap trees using clone+set loop (baseline)`, () => {
      const result = tree1.clone();
      tree2.forEachPair((k, v) => {
        result.set(k, v, false);
      });
      return result;
    });
    const baselineStats = countTreeNodeStats(baselineResult);
    console.log(`\tShared nodes (baseline): ${baselineStats.shared}/${baselineStats.total}`);
  }
}
