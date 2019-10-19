import {Repository} from "../Repository";
import {AbstractConnector} from "./AbstractConnector";
import {IConnectorInterface} from "./ConnectorInterface";

export class AngularFirestore {

}

export interface IConnectionAngularFirestore {
    path?: string;
}


export class AngularFirestoreConnector<T> extends AbstractConnector<T> implements IConnectorInterface {

    private db: AngularFirestore;

    constructor(repository: Repository<T>, db: AngularFirestore, options?: IConnectionAngularFirestore) {
        super(repository, options);
        this.db = db;
    }

    public add(items: T[]) {

        items.forEach((item: any) => {
            (this.db as any).doc(this.getPath() + '/' + item._uuid).set(item._toPlain()).then().catch((e: any) => {
                throw e;
            })
        });

        return;
    }

}