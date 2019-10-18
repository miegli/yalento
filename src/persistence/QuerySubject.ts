import { BehaviorSubject } from 'rxjs';
import { ICallback, IClassProperty, IRepositoryData, Repository } from '..';
import { QueryCallback } from './query/QueryCallback';
import { IQueryPaginatorDefaults, QueryPaginator } from './query/QueryPaginator';
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
    pageSize?: number;
    pageIndex?: number;
}

/**
 * INTERNAL USE ONLY
 */
export class QuerySubject<T> {

    private queryCallbackChanges$: BehaviorSubject<IQueryCallbackChanges> = new BehaviorSubject<IQueryCallbackChanges>({});
    private readonly behaviorSubject$: BehaviorSubject<T[]>;
    private readonly queryCallback: QueryCallback<T>;
    private _execStatementCount: number = 0;

    /**
     * construct new query subject by injecting repository
     * @param repository
     * @param sql
     * @param callback
     */
    constructor(private repository: Repository<T>, sql?: IStatement, callback?: ICallback<T>, paginatorDefaults?: IQueryPaginatorDefaults) {
        this.queryCallback = new QueryCallback<T>(this);
        this.setPaginatorDefaults(paginatorDefaults, sql);

        this.behaviorSubject$ = new BehaviorSubject<T[]>(this.statementHasObservables(sql) ? [] : this.execStatement(sql, callback));
        this.observeStatement(sql, callback);
        this.observePaginatorChanges(sql, callback);

    }

    /**
     * get behaviour subject
     */
    public getBehaviourSubject(): BehaviorSubject<T[]> {
        return this.behaviorSubject$;
    }

    /**
     * get behaviour subject
     */
    public getPaginator(): QueryPaginator<T> {
        return this.queryCallback.paginator;
    }

    /**
     * update query callback changes
     */
    public updateQueryCallbackChanges(changes: IQueryCallbackChanges) {
        this.queryCallbackChanges$.next(changes);
    }

    /**
     * get query callback changes observer
     */
    public getQueryCallbackChanges(): BehaviorSubject<IQueryCallbackChanges> {
        return this.queryCallbackChanges$;
    }

    /**
     *
     * @param paginatorDefaults
     * @param sql
     */
    private setPaginatorDefaults(paginatorDefaults?: IQueryPaginatorDefaults, sql?: IStatement) {

        if (paginatorDefaults && paginatorDefaults.pageSizeOptions) {
            this.getPaginator().setPageSizeOptions(paginatorDefaults.pageSizeOptions);
        }

        if (paginatorDefaults && paginatorDefaults.pageSize) {
            this.getPaginator().setPageSize(paginatorDefaults.pageSize, true);
            if (this.getPaginator().getPageSizeOptions().indexOf(this.getPaginator().getPageSize()) < 0) {
                this.getPaginator().addPageSizeOption(paginatorDefaults.pageSize);
            }
        } else if (sql && sql.limit) {
            this.getPaginator().setPageSize(sql.limit, true);
        }


    }

    /**
     *
     * @param sql
     */
    private statementHasObservables(sql?: IStatement): boolean {

        let count = 0;

        if (sql && sql.params) {
            sql.params.forEach((param: any) => {
                if (typeof param === 'object' && param.asObservable !== undefined && typeof param.asObservable === 'function') {
                    count++;
                }
            })
        }

        return count > 0;
    }

    /**
     * observe and re-execute statement on any changes
     * @param sql
     * @param callback
     */
    private observeStatement(sql?: IStatement, callback?: ICallback<T>) {

        if (sql && sql.params) {
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
     * observe and re-execute statement on any changes
     * @param sql
     * @param callback
     */
    private observePaginatorChanges(sql?: IStatement, callback?: ICallback<T>) {

        this.queryCallbackChanges$.subscribe((changes: IQueryCallbackChanges) => {
            if (changes.pageIndex !== undefined || changes.pageSize !== undefined) {
                this.behaviorSubject$.next(this.execStatement(sql, callback));
            }
        });

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

        let statement = '';
        let params = sql && sql.params !== undefined ? sql.params : null;
        if (!sql) {
            sql = {};
        }

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


        if (sql.where) {
            statement += ' WHERE ' + sql.where;
        }

        if (sql.groupBy) {
            statement += ' GROUP BY ' + sql.groupBy;
        }

        if (sql.orderBy) {
            statement += ' ORDER BY ' + sql.orderBy;
        }

        statement = this.replaceStatement(statement);

        const count = alasql('SELECT COUNT(*) as c FROM ' + this.repository.getTableName() + ' ' + statement, params)[0]['c'];

        if (sql.limit && !this.getPaginator().hasPageSizeChanges()) {
            statement += ' LIMIT ' + sql.limit;
        } else if (this.getPaginator().getPageSize()) {
            statement += ' LIMIT ' + this.getPaginator().getPageSize();
        }

        if (sql.offset) {
            if (sql.limit === undefined) {
                statement += ' LIMIT 1';
            }
            statement += ' OFFSET ' + sql.offset;
        } else {
            if (count && this.getPaginator().getPageIndex() * this.getPaginator().getPageSize() > count) {
                this.getPaginator().setPageIndex(Math.floor(count / this.getPaginator().getPageSize()));
            }
            if (this.getPaginator().getPageIndex() * this.getPaginator().getPageSize()) {
                statement += ' OFFSET ' + this.getPaginator().getPageIndex() * this.getPaginator().getPageSize();
            }
        }

        const results = alasql('SELECT * FROM ' + this.repository.getTableName() + ' ' + statement, params).map((d: IRepositoryData) => d._ref);

        const changes: IQueryCallbackChanges = { count: count, results: results };


        this.updateQueryCallbackChanges(changes);

        if (callback) {
            callback(this.queryCallback);
        }

        this._execStatementCount++;

        return results;

    }
}
