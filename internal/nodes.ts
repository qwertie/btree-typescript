import type { EditRangeResult } from '../core/types';
import { check } from './assert';

type index = number;
const undefVals: any[] = [];

/** @internal */
export interface BTreeNodeHost<K, V> {
  _compare: (a: K, b: K) => number;
  _size: number;
  _maxNodeSize: number;
  maxNodeSize: number;
}

/** Leaf node / base class. **************************************************/
export class BNode<K,V> {
  // If this is an internal node, _keys[i] is the highest key in children[i].
  keys: K[];
  values: V[];
  // True if this node might be within multiple `BTree`s (or have multiple parents).
  // If so, it must be cloned before being mutated to avoid changing an unrelated tree.
  // This is transitive: if it's true, children are also shared even if `isShared!=true`
  // in those children. (Certain operations will propagate isShared=true to children.)
  isShared: true | undefined;
  get isLeaf() { return (this as any).children === undefined; }
  
  constructor(keys: K[] = [], values?: V[]) {
    this.keys = keys;
    this.values = values || undefVals as any[];
    this.isShared = undefined;
  }

  ///////////////////////////////////////////////////////////////////////////
  // Shared methods /////////////////////////////////////////////////////////

  maxKey() {
    return this.keys[this.keys.length-1];
  }

  // If key not found, returns i^failXor where i is the insertion index.
  // Callers that don't care whether there was a match will set failXor=0.
  indexOf(key: K, failXor: number, cmp: (a:K, b:K) => number): index {
    const keys = this.keys;
    var lo = 0, hi = keys.length, mid = hi >> 1;
    while(lo < hi) {
      var c = cmp(keys[mid], key);
      if (c < 0)
        lo = mid + 1;
      else if (c > 0) // key < keys[mid]
        hi = mid;
      else if (c === 0)
        return mid;
      else {
        // c is NaN or otherwise invalid
        if (key === key) // at least the search key is not NaN
          return keys.length;
        else
          throw new Error("BTree: NaN was used as a key");
      }
      mid = (lo + hi) >> 1;
    }
    return mid ^ failXor;

    // Unrolled version: benchmarks show same speed, not worth using
    /*var i = 1, c: number = 0, sum = 0;
    if (keys.length >= 4) {
      i = 3;
      if (keys.length >= 8) {
        i = 7;
        if (keys.length >= 16) {
          i = 15;
          if (keys.length >= 32) {
            i = 31;
            if (keys.length >= 64) {
              i = 127;
              i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 64 : -64;
              sum += c;
              i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 32 : -32;
              sum += c;
            }
            i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 16 : -16;
            sum += c;
          }
          i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 8 : -8;
          sum += c;
        }
        i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 4 : -4;
        sum += c;
      }
      i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 2 : -2;
      sum += c;
    }
    i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 1 : -1;
    c = i < keys.length ? cmp(keys[i], key) : 1;
    sum += c;
    if (c < 0) {
      ++i;
      c = i < keys.length ? cmp(keys[i], key) : 1;
      sum += c;
    }
    if (sum !== sum) {
      if (key === key) // at least the search key is not NaN
        return keys.length ^ failXor;
      else
        throw new Error("BTree: NaN was used as a key");
    }
    return c === 0 ? i : i ^ failXor;*/
  }

  /////////////////////////////////////////////////////////////////////////////
  // Leaf Node: misc //////////////////////////////////////////////////////////

  minKey(): K | undefined {
    return this.keys[0];
  }

  minPair(reusedArray: [K,V]): [K,V] | undefined {
    if (this.keys.length === 0)
      return undefined;
    reusedArray[0] = this.keys[0];
    reusedArray[1] = this.values[0];
    return reusedArray;
  }

  maxPair(reusedArray: [K,V]): [K,V] | undefined {
    if (this.keys.length === 0)
      return undefined;
    const lastIndex = this.keys.length - 1;
    reusedArray[0] = this.keys[lastIndex];
    reusedArray[1] = this.values[lastIndex];
    return reusedArray;
  }

  clone(): BNode<K,V> {
    var v = this.values;
    return new BNode<K,V>(this.keys.slice(0), v === undefVals ? v : v.slice(0));
  }

  greedyClone(force?: boolean): BNode<K,V> {
    return this.isShared && !force ? this : this.clone();
  }

  get(key: K, defaultValue: V|undefined, tree: BTreeNodeHost<K,V>): V|undefined {
    var i = this.indexOf(key, -1, tree._compare);
    return i < 0 ? defaultValue : this.values[i];
  }

  getPairOrNextLower(key: K, compare: (a: K, b: K) => number, inclusive: boolean, reusedArray: [K,V]): [K,V]|undefined {
    var i = this.indexOf(key, -1, compare);
    const indexOrLower = i < 0 ? ~i - 1 : (inclusive ? i : i - 1);
    if (indexOrLower >= 0) {
      reusedArray[0] = this.keys[indexOrLower];
      reusedArray[1] = this.values[indexOrLower];
      return reusedArray;
    }
    return undefined;
  }

  getPairOrNextHigher(key: K, compare: (a: K, b: K) => number, inclusive: boolean, reusedArray: [K,V]): [K,V]|undefined {
    var i = this.indexOf(key, -1, compare);
    const indexOrLower = i < 0 ? ~i : (inclusive ? i : i + 1);
    const keys = this.keys;
    if (indexOrLower < keys.length) {
      reusedArray[0] = keys[indexOrLower];
      reusedArray[1] = this.values[indexOrLower];
      return reusedArray;
    }
    return undefined;
  }

  checkValid(depth: number, tree: BTreeNodeHost<K,V>, baseIndex: number): number {
    var kL = this.keys.length, vL = this.values.length;
    check(this.values === undefVals ? kL <= vL : kL === vL,
      "keys/values length mismatch: depth", depth, "with lengths", kL, vL, "and baseIndex", baseIndex);
    // Note: we don't check for "node too small" because sometimes a node
    // can legitimately have size 1. This occurs if there is a batch 
    // deletion, leaving a node of size 1, and the siblings are full so
    // it can't be merged with adjacent nodes. However, the parent will
    // verify that the average node size is at least half of the maximum.
    check(depth == 0 || kL > 0, "empty leaf at depth", depth, "and baseIndex", baseIndex);
    return kL;
  }

  /////////////////////////////////////////////////////////////////////////////
  // Leaf Node: set & node splitting //////////////////////////////////////////

  set(key: K, value: V, overwrite: boolean|undefined, tree: BTreeNodeHost<K,V>): boolean|BNode<K,V> { 
    var i = this.indexOf(key, -1, tree._compare);
    if (i < 0) {
      // key does not exist yet
      i = ~i;
      tree._size++;
      
      if (this.keys.length < tree._maxNodeSize) {
        return this.insertInLeaf(i, key, value, tree);
      } else {
        // This leaf node is full and must split
        var newRightSibling = this.splitOffRightSide(), target: BNode<K,V> = this;
        if (i > this.keys.length) {
          i -= this.keys.length;
          target = newRightSibling;
        }
        target.insertInLeaf(i, key, value, tree);
        return newRightSibling;
      }
    } else {
      // Key already exists
      if (overwrite !== false) {
        if (value !== undefined)
          this.reifyValues();
        // usually this is a no-op, but some users may wish to edit the key
        this.keys[i] = key;
        this.values[i] = value;
      }
      return false;
    }
  }

  reifyValues() {
    if (this.values === undefVals)
      return this.values = this.values.slice(0, this.keys.length);
    return this.values;
  }

  insertInLeaf(i: index, key: K, value: V, tree: BTreeNodeHost<K,V>) {
    this.keys.splice(i, 0, key);
    if (this.values === undefVals) {
      while (undefVals.length < tree._maxNodeSize)
        undefVals.push(undefined);
      if (value === undefined) {
        return true;
      } else {
        this.values = undefVals.slice(0, this.keys.length - 1);
      }
    }
    this.values.splice(i, 0, value);
    return true;
  }
  
  takeFromRight(rhs: BNode<K,V>) {
    // Reminder: parent node must update its copy of key for this node
    // assert: neither node is shared
    // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
    var v = this.values;
    if (rhs.values === undefVals) {
      if (v !== undefVals)
        v.push(undefined as any);
    } else {
      v = this.reifyValues();
      v.push(rhs.values.shift()!);
    }
    this.keys.push(rhs.keys.shift()!);
  }

  takeFromLeft(lhs: BNode<K,V>) {
    // Reminder: parent node must update its copy of key for this node
    // assert: neither node is shared
    // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
    var v = this.values;
    if (lhs.values === undefVals) {
      if (v !== undefVals)
        v.unshift(undefined as any);
    } else {
      v = this.reifyValues();
      v.unshift(lhs.values.pop()!);
    }
    this.keys.unshift(lhs.keys.pop()!);
  }

  splitOffRightSide(): BNode<K,V> {
    // Reminder: parent node must update its copy of key for this node
    var half = this.keys.length >> 1, keys = this.keys.splice(half);
    var values = this.values === undefVals ? undefVals : this.values.splice(half);
    return new BNode<K,V>(keys, values);
  }

  /////////////////////////////////////////////////////////////////////////////
  // Leaf Node: scanning & deletions //////////////////////////////////////////

  forRange<R>(low: K, high: K, includeHigh: boolean|undefined, editMode: boolean, tree: BTreeNodeHost<K,V>, count: number,
              onFound?: (k:K, v:V, counter:number) => EditRangeResult<V,R>|void): EditRangeResult<V,R>|number {
    var cmp = tree._compare;
    var iLow, iHigh;
    if (high === low) {
      if (!includeHigh)
        return count;
      iHigh = (iLow = this.indexOf(low, -1, cmp)) + 1;
      if (iLow < 0)
        return count;
    } else {
      iLow = this.indexOf(low, 0, cmp);
      iHigh = this.indexOf(high, -1, cmp);
      if (iHigh < 0)
        iHigh = ~iHigh;
      else if (includeHigh === true)
        iHigh++;
    }
    var keys = this.keys, values = this.values;
    if (onFound !== undefined) {
      for(var i = iLow; i < iHigh; i++) {
        var key = keys[i];
        var result = onFound(key, values[i], count++);
        if (result !== undefined) {
          if (editMode === true) {
            if (key !== keys[i] || this.isShared === true)
              throw new Error("BTree illegally changed or cloned in editRange");
            if (result.delete) {
              this.keys.splice(i, 1);
              if (this.values !== undefVals)
                this.values.splice(i, 1);
              tree._size--;
              i--;
              iHigh--;
            } else if (result.hasOwnProperty('value')) {
              values![i] = result.value!;
            }
          }
          if (result.break !== undefined)
            return result;
        }
      }
    } else
      count += iHigh - iLow;
    return count;
  }

  /** Adds entire contents of right-hand sibling (rhs is left unchanged) */
  mergeSibling(rhs: BNode<K,V>, _: number) {
    this.keys.push.apply(this.keys, rhs.keys);
    if (this.values === undefVals) {
      if (rhs.values === undefVals)
        return;
      this.values = this.values.slice(0, this.keys.length);
    }
    this.values.push.apply(this.values, rhs.reifyValues());
  }
}

/** Internal node (non-leaf node) ********************************************/
export class BNodeInternal<K,V> extends BNode<K,V> {
  // Note: conventionally B+ trees have one fewer key than the number of 
  // children, but I find it easier to keep the array lengths equal: each
  // keys[i] caches the value of children[i].maxKey().
  children: BNode<K,V>[];

  /** 
   * This does not mark `children` as shared, so it is the responsibility of the caller
   * to ensure children are either marked shared, or aren't included in another tree.
   */
  constructor(children: BNode<K,V>[], keys?: K[]) {
    if (!keys) {
      keys = [];
      for (var i = 0; i < children.length; i++)
        keys[i] = children[i].maxKey();
    }
    super(keys);
    this.children = children;
  }

  clone(): BNode<K,V> {
    var children = this.children.slice(0);
    for (var i = 0; i < children.length; i++)
      children[i].isShared = true;
    return new BNodeInternal<K,V>(children, this.keys.slice(0));
  }

  greedyClone(force?: boolean): BNode<K,V> {
    if (this.isShared && !force)
      return this;
    var nu = new BNodeInternal<K,V>(this.children.slice(0), this.keys.slice(0));
    for (var i = 0; i < nu.children.length; i++)
      nu.children[i] = nu.children[i].greedyClone(force);
    return nu;
  }

  minKey() {
    return this.children[0].minKey();
  }

  minPair(reusedArray: [K,V]): [K,V] | undefined {
    return this.children[0].minPair(reusedArray);
  }

  maxPair(reusedArray: [K,V]): [K,V] | undefined {
    return this.children[this.children.length - 1].maxPair(reusedArray);
  }

  get(key: K, defaultValue: V|undefined, tree: BTreeNodeHost<K,V>): V|undefined {
    var i = this.indexOf(key, 0, tree._compare), children = this.children;
    return i < children.length ? children[i].get(key, defaultValue, tree) : undefined;
  }

  getPairOrNextLower(key: K, compare: (a: K, b: K) => number, inclusive: boolean, reusedArray: [K,V]): [K,V]|undefined {
    var i = this.indexOf(key, 0, compare), children = this.children;
    if (i >= children.length)
      return this.maxPair(reusedArray);
    const result = children[i].getPairOrNextLower(key, compare, inclusive, reusedArray);
    if (result === undefined && i > 0) {
      return children[i - 1].maxPair(reusedArray);
    }
    return result;
  }

  getPairOrNextHigher(key: K, compare: (a: K, b: K) => number, inclusive: boolean, reusedArray: [K,V]): [K,V]|undefined {
    var i = this.indexOf(key, 0, compare), children = this.children, length = children.length;
    if (i >= length)
      return undefined;
    const result = children[i].getPairOrNextHigher(key, compare, inclusive, reusedArray);
    if (result === undefined && i < length - 1) {
      return children[i + 1].minPair(reusedArray);
    }
    return result;
  }

  checkValid(depth: number, tree: BTreeNodeHost<K,V>, baseIndex: number): number {
    let kL = this.keys.length, cL = this.children.length;
    check(kL === cL, "keys/children length mismatch: depth", depth, "lengths", kL, cL, "baseIndex", baseIndex);
    check(kL > 1 || depth > 0, "internal node has length", kL, "at depth", depth, "baseIndex", baseIndex);
    let size = 0, c = this.children, k = this.keys, childSize = 0;
    for (var i = 0; i < cL; i++) {
      size += c[i].checkValid(depth + 1, tree, baseIndex + size);
      childSize += c[i].keys.length;
      check(size >= childSize, "wtf", baseIndex); // no way this will ever fail
      check(i === 0 || c[i-1].constructor === c[i].constructor, "type mismatch, baseIndex:", baseIndex);
      if (c[i].maxKey() != k[i])
        check(false, "keys[", i, "] =", k[i], "is wrong, should be ", c[i].maxKey(), "at depth", depth, "baseIndex", baseIndex);
      if (!(i === 0 || tree._compare(k[i-1], k[i]) < 0))
        check(false, "sort violation at depth", depth, "index", i, "keys", k[i-1], k[i]);
    }
    // 2020/08: BTree doesn't always avoid grossly undersized nodes,
    // but AFAIK such nodes are pretty harmless, so accept them.
    let toofew = childSize === 0; // childSize < (tree.maxNodeSize >> 1)*cL;
    if (toofew || childSize > tree.maxNodeSize*cL)
      check(false, toofew ? "too few" : "too many", "children (", childSize, size, ") at depth", depth, "maxNodeSize:", tree.maxNodeSize, "children.length:", cL, "baseIndex:", baseIndex);
    return size;
  }

  /////////////////////////////////////////////////////////////////////////////
  // Internal Node: set & node splitting //////////////////////////////////////

  set(key: K, value: V, overwrite: boolean|undefined, tree: BTreeNodeHost<K,V>): boolean|BNodeInternal<K,V> {
    var c = this.children, max = tree._maxNodeSize, cmp = tree._compare;
    var i = Math.min(this.indexOf(key, 0, cmp), c.length - 1), child = c[i];
    
    if (child.isShared)
      c[i] = child = child.clone();
    if (child.keys.length >= max) {
      // child is full; inserting anything else will cause a split.
      // Shifting an item to the left or right sibling may avoid a split.
      // We can do a shift if the adjacent node is not full and if the
      // current key can still be placed in the same node after the shift.
      var other: BNode<K,V>;
      if (i > 0 && (other = c[i-1]).keys.length < max && cmp(child.keys[0], key) < 0) {
        if (other.isShared)
          c[i-1] = other = other.clone();
        other.takeFromRight(child);
        this.keys[i-1] = other.maxKey();
      } else if ((other = c[i+1]) !== undefined && other.keys.length < max && cmp(child.maxKey(), key) < 0) {
        if (other.isShared)
          c[i+1] = other = other.clone();
        other.takeFromLeft(child);
        this.keys[i] = c[i].maxKey();
      }
    }

    var result = child.set(key, value, overwrite, tree);
    if (result === false)
      return false;
    this.keys[i] = child.maxKey();
    if (result === true)
      return true;

    // The child has split and `result` is a new right child... does it fit?
    if (this.keys.length < max) { // yes
      this.insert(i+1, result);
      return true;
    } else { // no, we must split also
      var newRightSibling = this.splitOffRightSide(), target: BNodeInternal<K,V> = this;
      if (cmp(result.maxKey(), this.maxKey()) > 0) {
        target = newRightSibling;
        i -= this.keys.length;
      }
      target.insert(i+1, result);
      return newRightSibling;
    }
  }

  /** 
   * Inserts `child` at index `i`.
   * This does not mark `child` as shared, so it is the responsibility of the caller
   * to ensure that either child is marked shared, or it is not included in another tree.
   */
  insert(i: index, child: BNode<K,V>) {
    this.children.splice(i, 0, child);
    this.keys.splice(i, 0, child.maxKey());
  }

  /**
   * Split this node.
   * Modifies this to remove the second half of the items, returning a separate node containing them.
   */
  splitOffRightSide() {
    // assert !this.isShared;
    var half = this.children.length >> 1;
    return new BNodeInternal<K,V>(this.children.splice(half), this.keys.splice(half));
  }

  takeFromRight(rhs: BNode<K,V>) {
    // Reminder: parent node must update its copy of key for this node
    // assert: neither node is shared
    // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
    this.keys.push(rhs.keys.shift()!);
    this.children.push((rhs as BNodeInternal<K,V>).children.shift()!);
  }

  takeFromLeft(lhs: BNode<K,V>) {
    // Reminder: parent node must update its copy of key for this node
    // assert: neither node is shared
    // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
    this.keys.unshift(lhs.keys.pop()!);
    this.children.unshift((lhs as BNodeInternal<K,V>).children.pop()!);
  }

  /////////////////////////////////////////////////////////////////////////////
  // Internal Node: scanning & deletions //////////////////////////////////////

  // Note: `count` is the next value of the third argument to `onFound`. 
  //       A leaf node's `forRange` function returns a new value for this counter,
  //       unless the operation is to stop early.
  forRange<R>(low: K, high: K, includeHigh: boolean|undefined, editMode: boolean, tree: BTreeNodeHost<K,V>, count: number,
    onFound?: (k:K, v:V, counter:number) => EditRangeResult<V,R>|void): EditRangeResult<V,R>|number
  {
    var cmp = tree._compare;
    var keys = this.keys, children = this.children;
    var iLow = this.indexOf(low, 0, cmp), i = iLow;
    var iHigh = Math.min(high === low ? iLow : this.indexOf(high, 0, cmp), keys.length-1);
    if (!editMode) {
      // Simple case
      for(; i <= iHigh; i++) {
        var result = children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound);
        if (typeof result !== 'number')
          return result;
        count = result;
      }
    } else if (i <= iHigh) {
      try {
        for (; i <= iHigh; i++) {
          if (children[i].isShared)
            children[i] = children[i].clone();
          var result = children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound);
          // Note: if children[i] is empty then keys[i]=undefined.
          //       This is an invalid state, but it is fixed below.
          keys[i] = children[i].maxKey();
          if (typeof result !== 'number')
            return result;
          count = result;
        }
      } finally {
        // Deletions may have occurred, so look for opportunities to merge nodes.
        var half = tree._maxNodeSize >> 1;
        if (iLow > 0)
          iLow--;
        for (i = iHigh; i >= iLow; i--) {
          if (children[i].keys.length <= half) {
            if (children[i].keys.length !== 0) {
              this.tryMerge(i, tree._maxNodeSize);
            } else { // child is empty! delete it!
              keys.splice(i, 1);
              children.splice(i, 1);
            }
          }
        }
        if (children.length !== 0 && children[0].keys.length === 0)
          check(false, "emptiness bug");
      }
    }
    return count;
  }

  /** Merges child i with child i+1 if their combined size is not too large */
  tryMerge(i: index, maxSize: number): boolean {
    var children = this.children;
    if (i >= 0 && i + 1 < children.length) {
      if (children[i].keys.length + children[i+1].keys.length <= maxSize) {
        if (children[i].isShared) // cloned already UNLESS i is outside scan range
          children[i] = children[i].clone();
        children[i].mergeSibling(children[i+1], maxSize);
        children.splice(i + 1, 1);
        this.keys.splice(i + 1, 1);
        this.keys[i] = children[i].maxKey();
        return true;
      }
    }
    return false;
  }

  /**
   * Move children from `rhs` into this.
   * `rhs` must be part of this tree, and be removed from it after this call
   * (otherwise isShared for its children could be incorrect).
   */
  mergeSibling(rhs: BNode<K,V>, maxNodeSize: number) {
    // assert !this.isShared;
    var oldLength = this.keys.length;
    this.keys.push.apply(this.keys, rhs.keys);
    const rhsChildren = (rhs as any as BNodeInternal<K,V>).children;
    this.children.push.apply(this.children, rhsChildren);

    if (rhs.isShared && !this.isShared) {
      // All children of a shared node are implicitly shared, and since their new
      // parent is not shared, they must now be explicitly marked as shared.
      for (var i = 0; i < rhsChildren.length; i++)
        rhsChildren[i].isShared = true;
    }

    // If our children are themselves almost empty due to a mass-delete,
    // they may need to be merged too (but only the oldLength-1 and its
    // right sibling should need this).
    this.tryMerge(oldLength-1, maxNodeSize);
  }
}

export const EmptyLeaf = (() => {
  const n = new BNode<any, any>();
  n.isShared = true;
  return n;
})();
