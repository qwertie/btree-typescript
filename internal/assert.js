"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = void 0;
function check(fact) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    if (!fact) {
        args.unshift('B+ tree');
        throw new Error(args.join(' '));
    }
}
exports.check = check;
