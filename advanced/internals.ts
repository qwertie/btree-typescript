import type { BNode, BTreeNodeHost } from '../internal/nodes';

/** @internal */
export interface AdvancedTreeInternals<K, V> extends BTreeNodeHost<K, V> {
  _root: BNode<K, V>;
}
