"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var QuerySubject_1 = require("./QuerySubject");
var Repository = /** @class */ (function () {
    function Repository(constructor) {
        var constructorArguments = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            constructorArguments[_i - 1] = arguments[_i];
        }
        this.constructor = constructor;
        this._subjects = [];
        this.data = [];
        this._class = constructor;
        this._constructorArguments = constructorArguments;
    }
    Repository.prototype.watch = function (sql, callback) {
        var subject = new QuerySubject_1.QuerySubject(this, sql, callback);
        this._subjects.push(subject);
        return subject.getBehaviourSubject();
    };
    Repository.prototype.create = function (data) {
        var _a;
        var c = this._constructorArguments ? new ((_a = this._class).bind.apply(_a, __spreadArrays([void 0], this._constructorArguments)))() : new this._class;
        if (data) {
            Object.keys(data).forEach(function (key) {
                c[key] = data[key];
            });
        }
        var e = { _ref: c };
        Object.keys(c).forEach(function (key) {
            // @ts-ignore
            e[key] = c[key];
        });
        this.data.push(e);
        return c;
    };
    Repository.prototype.getData = function () {
        return this.data;
    };
    return Repository;
}());
exports.Repository = Repository;
