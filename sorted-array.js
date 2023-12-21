"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** A super-inefficient sorted list for testing purposes */
class SortedArray {
    constructor(entries, compare) {
        this.cmp = compare || ((a, b) => a < b ? -1 : a > b ? 1 : a === b ? 0 : a - b);
        this.a = [];
        if (entries !== undefined)
            for (var e of entries)
                this.set(e[0], e[1]);
    }
    get size() { return this.a.length; }
    get(key, defaultValue) {
        var pair = this.a[this.indexOf(key, -1)];
        return pair === undefined ? defaultValue : pair[1];
    }
    set(key, value, overwrite) {
        var i = this.indexOf(key, -1);
        if (i <= -1)
            this.a.splice(~i, 0, [key, value]);
        else
            this.a[i] = [key, value];
        return i <= -1;
    }
    has(key) {
        return this.indexOf(key, -1) >= 0;
    }
    delete(key) {
        var i = this.indexOf(key, -1);
        if (i > -1)
            this.a.splice(i, 1);
        return i > -1;
    }
    clear() { this.a = []; }
    getArray() { return this.a; }
    minKey() { return this.a[0][0]; }
    maxKey() { return this.a[this.a.length - 1][0]; }
    forEach(callbackFn) {
        this.a.forEach(pair => callbackFn(pair[1], pair[0], this));
    }
    // a.values() used to implement IMap<K,V> but it's not actually available in Node v10.4
    [Symbol.iterator]() { return this.a.values(); }
    entries() { return this.a.values(); }
    keys() { return this.a.map(pair => pair[0]).values(); }
    values() { return this.a.map(pair => pair[1]).values(); }
    indexOf(key, failXor) {
        var lo = 0, hi = this.a.length, mid = hi >> 1;
        while (lo < hi) {
            var c = this.cmp(this.a[mid][0], key);
            if (c < 0)
                lo = mid + 1;
            else if (c > 0) // keys[mid] > key
                hi = mid;
            else if (c === 0)
                return mid;
            else
                throw new Error("Problem: compare failed");
            mid = (lo + hi) >> 1;
        }
        return mid ^ failXor;
    }
}
exports.default = SortedArray;
