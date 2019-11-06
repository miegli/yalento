import * as firesql from 'firesql/firesql.umd.js';
import 'firesql/rx';
import {IEntity, Repository} from '../Repository';
import {AbstractConnector} from './AbstractConnector';
import {IConnectorInterface} from './ConnectorInterface';

export class Firestore {
}

export class Firebase {
}

export declare class User {
    public readonly uid: string | null;

    constructor(uid: string | null);

    public isAuthenticated(): boolean;
}

export type ConnectionFirestoreDataMode = 'PRIVATE' | 'ALL';

export interface IConnectionFirestore {
    path?: string;
    dataMode?: ConnectionFirestoreDataMode;
    realtimeMode?: boolean;
}

export class FirestoreConnector<T> extends AbstractConnector<T> implements IConnectorInterface<IEntity<T>> {
    private readonly db: Firestore;
    private readonly currentUser: User;
    private readonly dataMode: ConnectionFirestoreDataMode = 'ALL';
    private readonly realtimeMode: boolean = true;
    private firesSQL: any;
    private lastSql: string = '';
    private rxQuerySubscriber: any;

    constructor(repository: Repository<T>, db: Firestore, options?: IConnectionFirestore) {
        super(repository, options);

        if (options && options.dataMode) {
            this.dataMode = options.dataMode;
        }

        if (options && options.realtimeMode === false) {
            this.realtimeMode = false;
        }

        /* istanbul ignore next */
        if (db.constructor.name !== 'AngularFirestore') {
            this.db = (db as any).firestore();
        } else {
            this.db = (db as any).firestore;
        }

        this.currentUser = (this.db as any)._credentials ? (this.db as any)._credentials.currentUser : null;
        if (!this.currentUser) {
            this.currentUser = {
                uid: 'null',
                isAuthenticated(): boolean {
                    return false;
                },
            };
        }

        this.firesSQL = new firesql.FireSQL(this.db);
    }

    public getUserUuid(): string {
        return this.currentUser.uid || 'null';
    }

    public isPrivateMode(): boolean {
        return this.dataMode === 'PRIVATE';
    }

    public add(items: Array<IEntity<T>>) {
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
                .catch(e => {
                    throw new Error(
                        'error while creating firestore document "' + this.getPath() + '/' + item._uuid + '": ' + e.message,
                    );
                });
        });

        return;
    }

    public update(items: Array<IEntity<T>>) {

        this.add(items);

        return;
    }

    public remove(items: Array<IEntity<T>>) {
        items.forEach((item: any) => {
            (this.db as any)
                .doc(this.getPath() + '/' + item._uuid)
                .delete()
                .then()
                .catch(e => {
                    throw new Error(
                        'error while creating firestore document "' + this.getPath() + '/' + item._uuid + '": ' + e.message,
                    );
                });
        });

        return;
    }

    public select(sql: string) {
        const originalSqlParts = sql.split(' WHERE ', 2);
        const finalSql = 'SELECT * FROM ' + this.getPath() + ' WHERE ' + originalSqlParts[1];

        if (this.lastSql !== finalSql) {
            if (this.realtimeMode) {
                const data$ = this.firesSQL.rxQuery(finalSql);

                if (this.rxQuerySubscriber) {
                    this.rxQuerySubscriber.unsubscribe();
                }

                this.rxQuerySubscriber = data$.subscribe((results: any) => {
                    this.repository
                        .createMany(results, '', 'firestore')
                        .then()
                        .catch(e => {
                            throw e;
                        });
                });
            } else {
                this.firesSQL
                    .query(finalSql)
                    .then((results: any) => {
                        this.repository
                            .createMany(results, '', 'firestore')
                            .then()
                            .catch();
                    })
                    .catch(e => {
                        throw e;
                    });
            }

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
