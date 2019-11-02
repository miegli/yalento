import * as firesql from 'firesql/firesql.umd.js';
import 'firesql/rx';
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

export type ConnectionFirestoreDataMode = 'PRIVATE_ONLY' | 'PUBLIC_ONLY' | 'DEFAULT';

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
    private dataMode: ConnectionFirestoreDataMode = 'DEFAULT';

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
            data['__public'] = this.dataMode === 'PRIVATE_ONLY' ? 0 : 1;
            data['__owner'] = this.currentUser.uid ? this.currentUser.uid : 'null';

            (this.db as any)
                .doc(this.getPath() + '/' + item._uuid)
                .set(data, {merge: true})
                .then();
        });

        return;
    }

    public select(sql: string) {
        let finalSql = !this.options || !this.options.sql ? sql : this.options.sql;
        let finalSqlCondition = (finalSql.substr(('SELECT * FROM ' + this.repository.getClassName()).length)).trim();
        let finalSqlConditionUser = '';

        switch (this.dataMode) {

            case "DEFAULT":
                finalSqlConditionUser = '(__public = 1 OR __owner = "' + this.currentUser.uid + '")';
                break;
            case "PRIVATE_ONLY":
                finalSqlConditionUser = '__owner = "' + this.currentUser.uid + '"';
                break;
            case "PUBLIC_ONLY":
                finalSqlConditionUser = '__public = 1';
                break;
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
