import { BehaviorSubject } from 'rxjs';
import { ICallback, IClassProperty, IRepositoryData, Repository } from '..';
import { QueryCallback } from './query/QueryCallback';
import { IPageEventSort, IQueryPaginatorDefaults, QueryPaginator } from './query/QueryPaginator';
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
    resultsAll?: any[];
    pageSize?: number;
    pageIndex?: number;
    pageSort?: IPageEventSort;
    dataAdded?: boolean;
    selectSqlStatement?: string;
}

/**
 * INTERNAL USE ONLY
 */
export class QuerySubject<T> {

    private queryCallbackChanges$: BehaviorSubject<IQueryCallbackChanges> = new BehaviorSubject<IQueryCallbackChanges>({});
    private readonly behaviorSubject$: BehaviorSubject<T[]> = new BehaviorSubject<T[]>([]);
    private readonly queryCallback: QueryCallback<T>;
    private _lastExecStatement: string = '';

    /**
     *
     * @param repository
     * @param sql
     * @param callback
     * @param paginatorDefaults
     */
    constructor(private repository: Repository<T>, sql?: IStatement, callback?: ICallback<T>, paginatorDefaults?: IQueryPaginatorDefaults) {
        this.queryCallback = new QueryCallback<T>(this);
        this.setPaginatorDefaults(paginatorDefaults, sql);
        this.observeStatement(sql, callback);
        this.observeChanges(sql, callback);

        this.execStatement(sql);

        if (callback) {
            this.behaviorSubject$.subscribe(() => {
                callback(this.queryCallback);
            })
        }
    }

    /**
     *
     */
    public getLastExecStatement(): string {
        return this._lastExecStatement;
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

        if (paginatorDefaults && paginatorDefaults.pageSort) {
            this.getPaginator().setPageSort(paginatorDefaults.pageSort);
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
     * observe and re-execute statement on any changes
     * @param sql
     * @param callback
     */
    private observeStatement(sql?: IStatement, callback?: ICallback<T>) {

        if (sql && sql.params) {
            sql.params.forEach((param: any) => {
                if (typeof param === 'object' && param.asObservable !== undefined && typeof param.asObservable === 'function') {
                    param.asObservable().subscribe(() => {
                        this.behaviorSubject$.next(this.execStatement(sql));
                        if (callback) {
                            callback(this.queryCallback);
                        }
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
    private observeChanges(sql?: IStatement, callback?: ICallback<T>) {

        this.queryCallbackChanges$.subscribe((changes: IQueryCallbackChanges) => {
            if (changes.results === undefined) {
                this.execStatement(sql);
            } else {
                this.behaviorSubject$.next(changes.results);
            }
            if (callback) {
                callback(this.queryCallback);
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
     *
     * @param sql
     */
    private execStatement(sql?: IStatement): T[] {

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

        let selectSqlStatement = alasql.parse('SELECT * FROM ' + this.repository.getClassName() + ' ' + statement, params).toString();
        if (params) {
            params.forEach((value: string, index: number) => {
                selectSqlStatement = selectSqlStatement.replace('$' + index, value);
            })
        }

        if (sql.groupBy) {
            statement += ' GROUP BY ' + sql.groupBy;
        }

        if (this.getPaginator().getPageSortProperty() !== '' && this.getPaginator().getPageSortDirection() !== '') {
            statement += ' ORDER BY ' + this.getPaginator().getPageSortProperty() + ' ' + this.getPaginator().getPageSortDirection();
        } else if (sql.orderBy) {
            statement += ' ORDER BY ' + sql.orderBy;
        }

        statement = this.replaceStatement(statement);
        const resultsAll = alasql('SELECT * FROM ' + this.repository.getTableName() + ' ' + statement, params).map((d: IRepositoryData) => d._ref);
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

        if (this._lastExecStatement !== selectSqlStatement) {
            this.repository.loadQueryFromConnectors(selectSqlStatement);
        }

        this._lastExecStatement = selectSqlStatement;

        this.updateQueryCallbackChanges({
            resultsAll: resultsAll,
            results: results,
            count: count,
        });


        return results;

    }
}
