import * as firesql from 'firesql/firesql.umd.js';
import 'firesql/rx';
import {throwError} from "rxjs";
import {Repository} from '../Repository';
import {AbstractConnector} from './AbstractConnector';
import {IConnectorInterface} from './ConnectorInterface';

export class Firestore {

}

export declare class User {
    public readonly uid: string | null;

    constructor(uid: string | null);

    public isAuthenticated(): boolean;
}

export type ConnectionFirestoreDataMode = 'PRIVATE' | 'ALL';

export interface IConnectionFirestore {
    path?: string;
    sql?: string;
    dataMode?: ConnectionFirestoreDataMode
}

export class FirestoreConnector<T> extends AbstractConnector<T> implements IConnectorInterface<T> {
    private readonly db: Firestore;
    private readonly currentUser: User;
    private firesSQL: any;
    private lastSql: string = '';
    private rxQuerySubscriber: any;
    private dataMode: ConnectionFirestoreDataMode = 'ALL';

    constructor(repository: Repository<T>, db: Firestore, options?: IConnectionFirestore) {
        super(repository, options);

        if (options && options.dataMode) {
            this.dataMode = options.dataMode;
        }

        /* istanbul ignore next */
        if (db.constructor.name !== 'AngularFirestore') {
            this.db = (db as any).firestore();
        } else {
            this.db = (db as any).firestore;
        }

        this.currentUser = (this.db as any)._credentials.currentUser;

        this.firesSQL = new firesql.FireSQL(this.db);
    }

    public add(items: T[]) {
        items.forEach((item: any) => {

            const data = item._toPlain();
            data['__uuid'] = item['_uuid'];
            data['__owner'] = {};

            if (this.currentUser.uid && this.currentUser.uid !== 'null') {
                data['__owner'][this.currentUser.uid] = true;
            }

            if (this.dataMode !== 'PRIVATE') {
                data['__owner']['EVERYBODY'] = true;
            }


            (this.db as any)
                .doc(this.getPath() + '/' + item._uuid)
                .set(data, {merge: true})
                .then()
                .catch((e) => {
                    throwError('error while creating firestore document "' + this.getPath() + '/' + item._uuid + '": ' + e.message);
                })
        });

        return;
    }

    public select(sql: string) {
        let finalSql = !this.options || !this.options.sql ? sql : this.options.sql;
        let finalSqlCondition = (finalSql.substr(('SELECT * FROM ' + this.repository.getClassName()).length)).trim();
        let finalSqlConditionUser = '';


        if (this.dataMode === 'PRIVATE') {
            finalSqlConditionUser = '`__owner.' + this.currentUser.uid + '` = true ';
        } else {
            finalSqlConditionUser = '`__owner.EVERYBODY` = true ';
            if (this.currentUser.uid && this.currentUser.uid !== 'null') {
                finalSqlCondition += ' OR `__owner.' + this.currentUser.uid + '` = true ';
            }
        }

        if (finalSqlCondition.length > 0 && finalSqlCondition.substr(0, 5) === 'WHERE') {
            finalSqlCondition = ' AND ' + finalSqlCondition.substr(6) + ' ';
        }

        const where = finalSqlConditionUser.length || finalSqlCondition.length ? ' WHERE ' : '';

        finalSql = 'SELECT * FROM ' + this.getPath() + where + finalSqlConditionUser + finalSqlCondition;

        if (this.lastSql !== finalSql) {

            const data$ = this.firesSQL.rxQuery(finalSql);

            if (this.rxQuerySubscriber) {
                this.rxQuerySubscriber.unsubscribe();
            }

            this.rxQuerySubscriber = data$.subscribe((results: any) => {
                this.repository
                    .createMany(results, '', 'firestore')
                    .then()
                    .catch();
            });


            this.lastSql = finalSql;
        }

        return;
    }

    public disconnect(): void {
        if (this.rxQuerySubscriber) {
            this.rxQuerySubscriber.unsubscribe();
        }
    }
}
