import { BehaviorSubject } from 'rxjs';
import { ICallback, IClassProperty, IRepositoryData, Repository } from '..';
import { QueryCallback } from './query/QueryCallback';
/// <reference path="alasql.d.ts" />
// tslint:disable-next-line:no-var-requires
const alasql = require('alasql');

export interface IStatement {
    where?: string;
    orderBy?: string;
    groupBy?: string;
    limit?: number;
    offset?: number;
    params?: any[];
}

export interface IQueryCallbackChanges {
    count?: number;
    results?: any[];
}

/**
 * INTERNAL USE ONLY
 */
export class QuerySubject<T> {

    public queryCallbackChanges$: BehaviorSubject<IQueryCallbackChanges> = new BehaviorSubject<IQueryCallbackChanges>({});
    private readonly behaviorSubject$: BehaviorSubject<T[]>;
    private readonly queryCallback: QueryCallback<T>;

    /**
     * construct new query subject by injecting repository
     * @param repository
     * @param sql
     * @param callback
     */
    constructor(private repository: Repository<T>, sql?: IStatement, callback?: ICallback<T>) {
        this.queryCallback = new QueryCallback<T>(this);
        this.behaviorSubject$ = new BehaviorSubject<T[]>(this.execStatement(sql, callback));
        if (sql) {
            this.observeStatement(sql, callback);
        }
    }

    /**
     * get behaviour subject
     */
    public getBehaviourSubject(): BehaviorSubject<T[]> {
        return this.behaviorSubject$;
    }

    /**
     *
     */
    private updateQueryCallback(changes: IQueryCallbackChanges) {
        this.queryCallbackChanges$.next(changes);
    }

    /**
     * observe and re-execute statement on any changes
     * @param sql
     * @param callback
     */
    private observeStatement(sql: IStatement, callback?: ICallback<T>) {

        if (sql.params) {
            sql.params.forEach((param: any) => {
                if (typeof param === 'object' && param.asObservable !== undefined && typeof param.asObservable === 'function') {
                    param.asObservable().subscribe(() => {
                        this.behaviorSubject$.next(this.execStatement(sql, callback));
                    });
                }
            })
        }

        return;

    }

    /**
     *
     * @param statement
     */
    private replaceStatement(statement: string): string {

        this.repository.getClassProperties().forEach((property: IClassProperty) => {
            statement = statement.replace(new RegExp(' ' + property.name + '->', 'gm'), ' _ref->' + property.name + '->');
            statement = statement.replace(new RegExp(' ' + property.name + ' ', 'gm'), ' _ref->' + property.name + ' ');
        });

        return statement;
    }


    /**
     * execute sql statement on alasql
     * @param sql
     * @param callback
     */
    private execStatement(sql?: IStatement, callback?: ICallback<T>): T[] {

        let count: number = -1;
        let statement = '';
        let params = sql && sql.params !== undefined ? sql.params : null;

        if (params) {
            const tmpParams: any = [];
            params.forEach((param: any) => {
                if (typeof param === 'object' && param.asObservable !== undefined && typeof param.asObservable === 'function' && typeof param.getValue === 'function') {
                    tmpParams.push(param.getValue());
                } else {
                    tmpParams.push(param);
                }
            });
            params = tmpParams;
        }

        if (sql && sql.where) {
            statement += ' WHERE ' + sql.where;
        }

        if (sql && sql.groupBy) {
            statement += ' GROUP BY ' + sql.groupBy;
        }

        if (sql && sql.orderBy) {
            statement += ' ORDER BY ' + sql.orderBy;
        }

        statement = this.replaceStatement(statement);

        if (callback) {
            count = alasql('SELECT COUNT(*) as c FROM ' + this.repository.getTableName() + ' ' + statement, params)[0]['c'];
        }

        if (sql && sql.limit) {
            statement += ' LIMIT ' + sql.limit;
        }

        if (sql && sql.offset) {
            if (sql.limit === undefined) {
                statement += ' LIMIT 1';
            }
            statement += ' OFFSET ' + sql.offset;
        }

        const results = alasql('SELECT * FROM ' + this.repository.getTableName() + ' ' + statement, params).map((d: IRepositoryData) => d._ref);

        if (callback) {
            const changes: IQueryCallbackChanges = { count: count, results: results };
            this.updateQueryCallback(changes);
            callback(this.queryCallback);
        }

        return results;

    }
}
