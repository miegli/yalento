import { BehaviorSubject } from 'rxjs';
import { ICallback, IRepositoryData, Repository } from '..';
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

export class QuerySubject<T> {

    private readonly behaviorSubject: BehaviorSubject<T[]>;

    constructor(private repository: Repository<T>, sql?: IStatement, callback?: ICallback) {
        this.behaviorSubject = new BehaviorSubject<T[]>(this.execStatement(sql, callback));
    }

    public getBehaviourSubject(): BehaviorSubject<T[]> {
        return this.behaviorSubject;
    }

    private execStatement(sql?: IStatement, callback?: ICallback): T[] {

        let statement = '';


        if (sql && sql.where) {
            statement += ' WHERE ' + sql.where;
        }

        if (sql && sql.groupBy) {
            statement += ' GROUP BY ' + sql.groupBy;
        }

        if (sql && sql.orderBy) {
            statement += ' ORDER BY ' + sql.orderBy;
        }

        if (callback) {
            let countResult: any;
            if (sql && sql.params) {
                countResult = alasql('SELECT COUNT(*) as c FROM ?' + statement, [this.repository.getData(), ...sql.params]);
            } else {
                countResult = alasql('SELECT COUNT(*) as c FROM ?' + statement, [this.repository.getData()]);
            }
            callback(countResult[0]['c'], 1);
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

        if (sql && sql.params) {
            return alasql('SELECT * FROM ?' + statement, [this.repository.getData(), ...sql.params]).map((d: IRepositoryData) => d._ref);
        }
        return alasql('SELECT * FROM ?' + statement, [this.repository.getData()]).map((d: IRepositoryData) => d._ref);
    }

}
