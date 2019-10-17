import { BehaviorSubject } from 'rxjs';
import { ICallback, IClassProperty, IRepositoryData, Repository } from '..';
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

/**
 * INTERNAL USE ONLY
 */
export class QuerySubject<T> {

    private readonly behaviorSubject: BehaviorSubject<T[]>;
    private readonly temporaryTableName: string;

    /**
     * construct new query subject by injecting repository
     * @param repository
     * @param sql
     * @param callback
     */
    constructor(private repository: Repository<T>, sql?: IStatement, callback?: ICallback) {
        this.temporaryTableName = this.createDatabase();
        this.behaviorSubject = new BehaviorSubject<T[]>(this.execStatement(sql, callback));
        if (sql) {
            this.observeStatement(sql, callback);
        }
    }

    /**
     * get behaviour subject
     */
    public getBehaviourSubject(): BehaviorSubject<T[]> {
        return this.behaviorSubject;
    }

    /**
     * create temporary database if not exists
     */
    private createDatabase(): string {

        const table = 'temp' + this.repository.getInstanceIdentifier();
        alasql('CREATE TABLE IF NOT EXISTS ' + table);

        return table;

    }


    /**
     * observe and re-execute statement on any changes
     * @param sql
     * @param callback
     */
    private observeStatement(sql: IStatement, callback?: ICallback) {

        if (sql.params) {
            sql.params.forEach((param: any) => {
                if (typeof param === 'object' && param.asObservable !== undefined && typeof param.asObservable === 'function') {
                    param.asObservable().subscribe(() => {
                        this.behaviorSubject.next(this.execStatement(sql, callback));
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
    private execStatement(sql?: IStatement, callback?: ICallback): T[] {

        let statement = '';
        let params = sql && sql.params !== undefined ? sql.params : null;

        if (this.repository.getTempData().length) {
            alasql.tables[this.temporaryTableName].data = this.repository.getTempData();
            this.repository.resetTempData();
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
            callback(alasql('SELECT COUNT(*) as c FROM ' + this.temporaryTableName + ' ' + statement, params)[0]['c'], 1);
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

        return alasql('SELECT * FROM ' + this.temporaryTableName + ' ' + statement, params).map((d: IRepositoryData) => d._ref);

    }
}
