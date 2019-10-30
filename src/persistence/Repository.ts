import {classToPlain, serialize} from "class-transformer";
import "es6-shim";
import {Guid} from "guid-typescript";
import "reflect-metadata";
import {take} from "rxjs/operators";
import {
    AngularFirestoreConnector,
    Firestore,
    IConnectionAngularFirestore,
} from "./connector/AngularFirestoreConnector";
import {IConnectorInterface} from "./connector/ConnectorInterface";
import {IQueryPaginatorDefaults, QueryPaginator} from './query/QueryPaginator';
import {IStatement, QuerySubject} from './QuerySubject';
import {Select} from "./select/select";
/// <reference path="alasql.d.ts" />
// tslint:disable-next-line:no-var-requires
const alasql = require('alasql');


export interface IRepositoryData {
    _ref: any;
    _uuid: string | number;
}

export interface IRepositoryDataCreate {
    [key: string]: any
}

export interface IClassProperty {
    name: string;
}

export interface ISelectWithPaginator {
    sql?: IStatement;
    paginatorDefaults?: IQueryPaginatorDefaults;
}


export interface IConnections<T> {
    [key: string]: IConnectorInterface<T>;
}

export type IConnectionsKeys = ['angularFirestore'];

/**
 * Repository class
 * This class can be instantiated by new constructor.
 * You can use the class as singleton, if you share repository data, otherwise initiate new instance for every sql statement
 */
export class Repository<T> {

    private readonly _instanceIdentifier: string;
    private readonly _class: any;
    private readonly _classProperties: IClassProperty[] = [];
    private readonly _constructorArguments: any;
    private readonly _subjects: Array<QuerySubject<T>> = [];
    private _tempData: IRepositoryData[] = [];
    private _excludeSerializeProperties: string[] = [];
    private _connections: IConnections<T> = {};
    private _className: string = '';

    /**
     * construct new repository instance
     * @param constructor
     * @param constructorArguments
     */
    constructor(private constructor: any, ...constructorArguments: any[]) {
        this._class = constructor;
        this._constructorArguments = constructorArguments;
        this._instanceIdentifier = Guid.create().toString().replace(/-/g, '');
        this.createDatabase();
        this.initSerializer();
    }

    /**
     * destroy repository instance
     */
    public destroy() {

        Object.keys(this._connections).forEach((connectionId: string) => {
            this._connections[connectionId].disconnect();
        });

    }

    /**
     *
     * @param firestore
     * @param options
     */
    public connectFirestore(firestore: Firestore, options?: IConnectionAngularFirestore): Repository<T> {

        this._connections.angularFirestore = new AngularFirestoreConnector<T>(this, firestore, options);

        return this;
    }

    /**
     *
     */
    public loadQueryFromConnectors(query: string) {
        (Object.keys(this._connections) as IConnectionsKeys).forEach((key: string) => {
            this._connections[key].select(query);
        });
    }

    /**
     * performs sql statement
     * @param sql
     */
    public select(sql?: IStatement, paginatorDefaults?: IQueryPaginatorDefaults): Select<T> {
        const subject = new QuerySubject<T>(this, sql, paginatorDefaults);
        this._subjects.push(subject);
        return new Select<T>(subject);
    }

    /**
     *
     * @param data
     * @param id
     * @param fromConnector
     */
    public create(data?: IRepositoryDataCreate, id?: string | number, fromConnector?: string, skipChanges?: boolean): Promise<T> {

        return new Promise<T>((resolve => {

            const c = this.createClassInstance(id) as any;

            if (data) {
                Object.keys(data).forEach((key: string) => {
                    c[key] = data[key];
                });
            }

            const existingItem = this._tempData.filter((item: IRepositoryData) => {
                return item._uuid === c['__uuid'];
            });

            if (existingItem.length) {
                existingItem.forEach((item: IRepositoryData) => {
                    item._ref = c;
                })
            } else {
                this._tempData.push({_ref: c, _uuid: c._uuid});
            }

            Object.keys(this._connections as any).forEach((key: string) => {
                if (key !== fromConnector) {
                    this._connections[key].add([c]);
                }
            });

            if (!skipChanges) {
                this._subjects.forEach((subject: QuerySubject<T>) => {
                    subject.updateQueryCallbackChanges({dataAdded: true});
                });
            }


            resolve(c);


        }));

    }

    /**
     *
     * @param data
     * @param fromConnector
     */
    public async createMany(data: IRepositoryDataCreate[], fromConnector?: string): Promise<T[]> {

        const promises: any = [];

        data.forEach(value => {
            promises.push(this.create(value, value['__uuid'] === undefined ? undefined : value['__uuid'], fromConnector, true));
        });

        this._subjects.forEach((subject: QuerySubject<T>) => {
            subject.updateQueryCallbackChanges({dataAdded: true});
        });

        return new Promise<T[]>((resolve => {
            Promise.all(promises).then((c: any) => {
                resolve(c);
            }).catch(() => {
                resolve([]);
            })
        }));

    }

    /**
     * INTERNAL USE ONLY: return temp repository data
     */
    public getTempData(): IRepositoryData[] {
        return this._tempData;
    }

    /**
     * INTERNAL USE ONLY: return temporary identifier
     */
    public getInstanceIdentifier(): string {
        return this._instanceIdentifier;
    }

    /**
     * INTERNAL USE ONLY: return temporary identifier
     */
    public getClassProperties(): IClassProperty[] {

        if (this._classProperties.length) {
            return this._classProperties;
        }

        const c = this._constructorArguments.length ? new this._class(...this._constructorArguments) : new this._class;

        Object.keys(c).forEach((property: string) => {
            this._classProperties.push({name: property});
        });

        return this._classProperties;

    }


    /**
     * get assql table name
     */
    public getTableName(): string {
        return 'temp' + this.getInstanceIdentifier();
    }

    /**
     *
     */
    public getClassName(): string {
        return this._className;
    }

    /**
     *
     * @param id
     */
    public createClassInstance(id?: string | number): T {

        const c = this._constructorArguments.length ? new this._class(...this._constructorArguments) : new this._class;
        const uuid = id === undefined ? Guid.create().toString() : id;

        Object.defineProperty(c, '_uuid', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: uuid,
        });

        Object.defineProperty(c, '_toJson', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: () => {
                return serialize(c, {excludePrefixes: this._excludeSerializeProperties})
            },
        });

        Object.defineProperty(c, '_toPlain', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: () => {
                return classToPlain(c, {excludePrefixes: this._excludeSerializeProperties})
            },
        });

        return c;

    }

    /**
     * create temporary database if not exists
     */
    private createDatabase() {

        this._tempData = [];
        alasql('CREATE TABLE IF NOT EXISTS ' + this.getTableName());
        alasql.tables[this.getTableName()].data = this._tempData;
    }


    /**
     * check properties that can to be serialized
     */
    private initSerializer() {

        const c = this.createClassInstance() as any;
        this._className = c.constructor.name;
        Object.keys(c).forEach((key: string) => {
            try {
                new c[key].constructor();
            } catch (e) {
                this._excludeSerializeProperties.push(key);
            }
        });


    }

}
