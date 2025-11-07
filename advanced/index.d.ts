import BTree from '../core/index';
export declare class AdvancedBTree<K = any, V = any> extends BTree<K, V> {
    clone(): AdvancedBTree<K, V>;
    greedyClone(force?: boolean): AdvancedBTree<K, V>;
    diffAgainst<R>(other: BTree<K, V>, onlyThis?: (k: K, v: V) => {
        break?: R;
    } | void, onlyOther?: (k: K, v: V) => {
        break?: R;
    } | void, different?: (k: K, vThis: V, vOther: V) => {
        break?: R;
    } | void): R | undefined;
}
export default AdvancedBTree;
