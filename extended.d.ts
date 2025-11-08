import BTree from './b+tree';
export declare class BTreeEx<K = any, V = any> extends BTree<K, V> {
    clone(): BTreeEx<K, V>;
    greedyClone(force?: boolean): BTreeEx<K, V>;
    with(key: K): BTreeEx<K, V | undefined>;
    with<V2>(key: K, value: V2, overwrite?: boolean): BTreeEx<K, V | V2>;
    withPairs<V2>(pairs: [K, V | V2][], overwrite: boolean): BTreeEx<K, V | V2>;
    withKeys(keys: K[], returnThisIfUnchanged?: boolean): BTreeEx<K, V | undefined>;
    without(key: K, returnThisIfUnchanged?: boolean): BTreeEx<K, V>;
    withoutKeys(keys: K[], returnThisIfUnchanged?: boolean): BTreeEx<K, V>;
    withoutRange(low: K, high: K, includeHigh: boolean, returnThisIfUnchanged?: boolean): BTreeEx<K, V>;
    filter(callback: (k: K, v: V, counter: number) => boolean, returnThisIfUnchanged?: boolean): BTreeEx<K, V>;
    mapValues<R>(callback: (v: V, k: K, counter: number) => R): BTreeEx<K, R>;
    diffAgainst<R>(other: BTree<K, V>, onlyThis?: (k: K, v: V) => {
        break?: R;
    } | void, onlyOther?: (k: K, v: V) => {
        break?: R;
    } | void, different?: (k: K, vThis: V, vOther: V) => {
        break?: R;
    } | void): R | undefined;
}
export declare function diffAgainst<K, V, R>(treeThis: BTree<K, V>, treeOther: BTree<K, V>, onlyThis?: (k: K, v: V) => {
    break?: R;
} | void, onlyOther?: (k: K, v: V) => {
    break?: R;
} | void, different?: (k: K, vThis: V, vOther: V) => {
    break?: R;
} | void): R | undefined;
export default BTreeEx;
