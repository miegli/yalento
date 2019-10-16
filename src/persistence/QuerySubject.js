"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var rxjs_1 = require("rxjs");
/// <reference path="alasql.d.ts" />
// tslint:disable-next-line:no-var-requires
var alasql = require('alasql');
var QuerySubject = /** @class */ (function () {
    function QuerySubject(repository, sql, callback) {
        this.repository = repository;
        this.behaviorSubject = new rxjs_1.BehaviorSubject(this.execStatement(sql, callback));
    }
    QuerySubject.prototype.getBehaviourSubject = function () {
        return this.behaviorSubject;
    };
    QuerySubject.prototype.execStatement = function (sql, callback) {
        var statement = '';
        var countResult;
        if (sql && sql.where) {
            statement += ' WHERE ' + sql.where;
        }
        if (sql && sql.groupBy) {
            statement += ' GROUP BY ' + sql.groupBy;
        }
        if (sql && sql.orderBy) {
            statement += ' ORDER BY ' + sql.orderBy;
        }
        if (sql && sql.having) {
            statement += ' HAVING ' + sql.having;
        }
        if (callback) {
            if (sql && sql.params) {
                countResult = alasql('SELECT COUNT(*) as c FROM ?' + statement, __spreadArrays([this.repository.getData()], sql.params));
            }
            else {
                countResult = alasql('SELECT COUNT(*) as c FROM ?' + statement, [this.repository.getData()]);
            }
            callback(countResult ? countResult[0]['c'] : 0, 1);
        }
        if (sql && sql.limit) {
            statement += ' LIMIT ' + sql.limit;
        }
        if (sql && sql.offset) {
            statement += ' OFFSET ' + sql.offset;
        }
        if (sql && sql.params) {
            return alasql('SELECT * FROM ?' + statement, __spreadArrays([this.repository.getData()], sql.params)).map(function (d) { return d._ref; });
        }
        return alasql('SELECT * FROM ?' + statement, [this.repository.getData()]).map(function (d) { return d._ref; });
    };
    return QuerySubject;
}());
exports.QuerySubject = QuerySubject;
