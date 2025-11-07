import BTree from '../core/index';
export declare class AdvancedBTree<K = any, V = any> extends BTree<K, V> {
    clone(): AdvancedBTree<K, V>;
    greedyClone(force?: boolean): AdvancedBTree<K, V>;
    with(key: K): AdvancedBTree<K, V | undefined>;
    with<V2>(key: K, value: V2, overwrite?: boolean): AdvancedBTree<K, V | V2>;
    withPairs<V2>(pairs: [K, V | V2][], overwrite: boolean): AdvancedBTree<K, V | V2>;
    withKeys(keys: K[], returnThisIfUnchanged?: boolean): AdvancedBTree<K, V | undefined>;
    without(key: K, returnThisIfUnchanged?: boolean): AdvancedBTree<K, V>;
    withoutKeys(keys: K[], returnThisIfUnchanged?: boolean): AdvancedBTree<K, V>;
    withoutRange(low: K, high: K, includeHigh: boolean, returnThisIfUnchanged?: boolean): AdvancedBTree<K, V>;
    filter(callback: (k: K, v: V, counter: number) => boolean, returnThisIfUnchanged?: boolean): AdvancedBTree<K, V>;
    mapValues<R>(callback: (v: V, k: K, counter: number) => R): AdvancedBTree<K, R>;
    diffAgainst<R>(other: BTree<K, V>, onlyThis?: (k: K, v: V) => {
        break?: R;
    } | void, onlyOther?: (k: K, v: V) => {
        break?: R;
    } | void, different?: (k: K, vThis: V, vOther: V) => {
        break?: R;
    } | void): R | undefined;
}
export default AdvancedBTree;
