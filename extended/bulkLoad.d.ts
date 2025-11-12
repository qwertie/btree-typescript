import BTree from '../b+tree';
/**
 * Loads a B-Tree from a sorted list of entries in bulk. This is faster than inserting
 * entries one at a time, and produces a more optimally balanced tree.
 * Time and space complexity: O(n).
 * @param entries The list of key/value pairs to load. Must be sorted by key in strictly ascending order.
 * @param maxNodeSize The branching factor (maximum node size) for the resulting tree.
 * @param compare Function to compare keys.
 * @returns A new BTree containing the given entries.
 */
export declare function bulkLoad<K, V>(entries: (K | V)[], maxNodeSize: number, compare: (a: K, b: K) => number): BTree<K, V>;
