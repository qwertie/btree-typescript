"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alternatingPush = exports.alternatingGetSecond = exports.alternatingGetFirst = exports.alternatingCount = void 0;
// ------- Alternating list helpers -------
// These helpers manage a list that alternates between two types of entries.
// Storing data this way avoids small tuple allocations and shows major improvements
// in GC time in benchmarks.
function alternatingCount(list) {
    return list.length >> 1;
}
exports.alternatingCount = alternatingCount;
function alternatingGetFirst(list, index) {
    return list[index << 1];
}
exports.alternatingGetFirst = alternatingGetFirst;
function alternatingGetSecond(list, index) {
    return list[(index << 1) + 1];
}
exports.alternatingGetSecond = alternatingGetSecond;
function alternatingPush(list, first, second) {
    // Micro benchmarks show this is the fastest way to do this
    list.push(first, second);
}
exports.alternatingPush = alternatingPush;
