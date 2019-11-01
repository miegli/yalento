import * as firesql from 'firesql/firesql.umd.js';
import 'firesql/rx';
import {Repository} from '../Repository';
import {AbstractConnector} from './AbstractConnector';
import {IConnectorInterface} from './ConnectorInterface';

export class Firestore {
}

export interface IConnectionFirestore {
    path?: string;
    sql?: string;
}

export class FirestoreConnector<T> extends AbstractConnector<T> implements IConnectorInterface<T> {
    private readonly db: Firestore;
    private firesSQL: any;
    private lastSql: string = '';
    private rxQuerySubscriber: any;

    constructor(repository: Repository<T>, db: Firestore, options?: IConnectionFirestore) {
        super(repository, options);

        /* istanbul ignore next */
        if (db.constructor.name !== 'AngularFirestore') {
            this.db = (db as any).firestore();
        } else {
            this.db = (db as any).firestore;
        }

        this.firesSQL = new firesql.FireSQL(this.db);
    }

    public add(items: T[]) {
        items.forEach((item: any) => {
            const data = item._toPlain();
            data['__uuid'] = item['_uuid'];

            (this.db as any)
                .doc(this.getPath() + '/' + item._uuid)
                .set(data)
                .then();
        });

        return;
    }

    public select(sql: string) {
        const finalSql = !this.options || !this.options.sql ? sql : this.options.sql;

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
