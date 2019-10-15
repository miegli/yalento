"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
function Connect(config) {
    return function (constructor) {
        var _a;
        return _a = class extends constructor {
            },
            _a.CONFIG = config,
            _a.TABLE = constructor.toString().split(' ')[1],
            _a;
    };
}
exports.Connect = Connect;
