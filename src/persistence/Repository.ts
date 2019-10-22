import { classToPlain, serialize } from "class-transformer";
import "es6-shim";
import { Guid } from "guid-typescript";
import "reflect-metadata";
import { BehaviorSubject } from 'rxjs';
import {
    AngularFirestoreConnector,
    Firestore,
    IConnectionAngularFirestore,
} from "./connector/AngularFirestoreConnector";
import { IConnectorInterface } from "./connector/ConnectorInterface";
import { QueryCallback } from './query/QueryCallback';
import { IQueryPaginatorDefaults, QueryPaginator } from './query/QueryPaginator';
import { IQueryCallbackChanges, IStatement, QuerySubject } from './QuerySubject';
/// <reference path="alasql.d.ts" />
// tslint:disable-next-line:no-var-requires
const alasql = require('alasql');

export type ICallback<T> = (callback: QueryCallback<T>) => void;

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
        this.reloadSubjects();

        return this;
    }

    /**
     * performs sql statement and return behaviour subject as observable results
     * @param sql
     * @param callback
     */
    public select(sql?: IStatement, callback?: ICallback<T>): BehaviorSubject<T[]> {
        const subject = new QuerySubject<T>(this, sql, callback);
        this._subjects.push(subject);

        subject.getQueryCallbackChanges().subscribe((changes: IQueryCallbackChanges) => {
            if (changes.selectSqlStatement !== undefined) {
                Object.keys(this._connections).forEach((key: string) => {
                    this._connections[key].select(changes.selectSqlStatement as string);
                });
            }
        });

        return subject.getBehaviourSubject();
    }

    /**
     * perform sql statement and return behaviour subject as observable results
     * @param options
     */
    public selectWithPaginator(options?: ISelectWithPaginator): QueryPaginator<T> {
        const subject = new QuerySubject<T>(this, options ? options.sql : {}, undefined, options ? options.paginatorDefaults : undefined);
        this._subjects.push(subject);

        subject.getQueryCallbackChanges().subscribe((changes: IQueryCallbackChanges) => {
            if (changes.selectSqlStatement !== undefined) {
                (Object.keys(this._connections) as IConnectionsKeys).forEach((key: string) => {
                    this._connections[key].select(changes.selectSqlStatement as string)
                });
            }
        });

        this.reloadSubjects();

        return subject.getPaginator();
    }

    /**
     *
     * @param data
     * @param id
     * @param skipChangeDetection
     * @param fromConnector
     */
    public create(data?: IRepositoryDataCreate, id?: string | number, skipChangeDetection?: boolean, fromConnector?: string): T {

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
            this._tempData.push({ _ref: c, _uuid: c._uuid });
        }


        if (!skipChangeDetection) {
            Object.keys(this._connections as any).forEach((key: string) => {
                if (key !== fromConnector) {
                    this._connections[key].add([c]);
                }
            });
            this.updateSubjects({ dataAdded: true });
        }

        return c;

    }

    /**
     *
     * @param data
     * @param fromConnector
     */
    public createMany(data: IRepositoryDataCreate[], fromConnector?: string): T[] {

        const added: T[] = [];

        data.forEach(value => {
            added.push(this.create(value, value['__uuid'] === undefined ? undefined : value['__uuid'], true, fromConnector));
        });

        Object.keys(this._connections).forEach((key: string) => {
            if (key !== fromConnector) {
                this._connections[key].add(added);
            }
        });

        this.updateSubjects({ dataAdded: true });

        return added;

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
            this._classProperties.push({ name: property });
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
     * @param changes
     */
    public updateSubjects(changes: IQueryCallbackChanges) {

        this._subjects.forEach((subject: QuerySubject<any>) => {
            subject.updateQueryCallbackChanges(changes);
        })

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
                return serialize(c, { excludePrefixes: this._excludeSerializeProperties })
            },
        });

        Object.defineProperty(c, '_toPlain', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: () => {
                return classToPlain(c, { excludePrefixes: this._excludeSerializeProperties })
            },
        });

        return c;

    }

    /**
     * create temporary database if not exists
     */
    private createDatabase() {

        alasql('CREATE TABLE IF NOT EXISTS ' + this.getTableName());
        alasql.tables[this.getTableName()].data = this._tempData;
    }

    private reloadSubjects() {
        this._subjects.forEach((sub: QuerySubject<T>) => {
            sub.updateQueryCallbackChanges({ selectSqlStatement: sub.getLastExecStatement() });
        });
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
