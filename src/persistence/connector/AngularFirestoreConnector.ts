import firebase from 'firebase/app';
import 'firebase/firestore';
import {FireSQL} from 'firesql';
import 'firesql/rx';
import {Repository} from "../Repository";
import {AbstractConnector} from "./AbstractConnector";
import {IConnectorInterface} from "./ConnectorInterface";


export class AngularFirestore {

}

export interface IConnectionAngularFirestore {
    path?: string;
}


export class AngularFirestoreConnector<T> extends AbstractConnector<T> implements IConnectorInterface<T> {

    private readonly db: AngularFirestore;
    private firesSQL: FireSQL;
    private lastSql: string = '';
    private rxQuerySubscriber: any;

    constructor(repository: Repository<T>, db: AngularFirestore, options?: IConnectionAngularFirestore) {
        super(repository, options);
        this.db = db;
        firebase.initializeApp((db as any).firestore.app.options);
        this.firesSQL = new FireSQL(firebase.firestore());

    }

    public add(items: T[]) {

        items.forEach((item: any) => {
            const data = item._toPlain();
            data['__uuid'] = item['_uuid'];
            (this.db as any).doc(this.getPath() + '/' + item._uuid).set(data).then().catch((e: any) => {
                throw e;
            })
        });

        return;
    }

    public select(sql: string) {

        if (this.lastSql !== sql) {
            const data$ = this.firesSQL.rxQuery(sql);

            if (this.rxQuerySubscriber) {
                this.rxQuerySubscriber.unsubscribe();
            }

            this.rxQuerySubscriber = data$.subscribe((results: any) => {
                this.repository.createMany(results, 'angularFirestore');
            });

            this.lastSql = sql;
        }

        return;
    }

}