import {classToPlain} from 'class-transformer';
import 'es6-shim';
import {Guid} from 'guid-typescript';
import 'reflect-metadata';
import {Observable} from 'rxjs';
import {IConnectorInterface} from './connector/ConnectorInterface';
import {Firebase, Firestore, FirestoreConnector, IConnectionFirestore} from './connector/FirestoreConnector';
import {IQueryPaginatorDefaults} from './query/QueryPaginator';
import {IStatement, IStatementOne, QuerySubject} from './QuerySubject';
import {Select} from './select/select';
/// <reference path="alasql.d.ts" />
// tslint:disable-next-line:no-var-requires
const alasql = require('alasql');

export interface IRepositoryData {
    _ref: any;
    __removed: boolean;
    _uuid: string | number;
    __owners: string[];
}

export interface IConnections<T> {
    [key: string]: IConnectorInterface<T>;
}


export interface IRepositoryDataCreate {
    [key: string]: any;
}

export interface IClassProperty {
    name: string;
}

interface IBaseEntityInner {
    save(): void;
}

class BaseEntity {

    public save(): any {
        return;
    };

    public setProperty(property: string, value: any): IBaseEntityInner {
        return {
            save: (): void => {
                return;
            }
        }
    }
}

export type IEntity<T> = BaseEntity & {
    [P in keyof T]?: T[P];
};


export type IConnectionsKeys = ['firestore'];

/**
 * Repository class
 * This class can be instantiated by new constructor.
 * You can use the class as singleton, if you share repository data, otherwise initiate new instance for every sql statement
 */
export class Repository<T> {
    public _zone: any = {
        run: (callback: any) => {
            callback();
        },
    };

    private readonly _instanceIdentifier: string;
    private readonly _class: any;
    private readonly _classProperties: IClassProperty[] = [];
    private readonly _constructorArguments: any;
    private readonly _subjects: Array<QuerySubject<T>> = [];
    private readonly _selects: Array<Select<T>> = [];
    private _subscriptions: any[] = [];
    private _tempData: IRepositoryData[] = [];
    private _excludeSerializeProperties: string[] = ['__owner', '__uuid'];
    private _connections: IConnections<IEntity<T>> = {};
    private _className: string = '';
    private userUuid: string = '';
    private privateMode: boolean = false;

    /**
     * construct new repository instance
     * @param model
     * @param constructorArguments
     */
    constructor(model: any, ...constructorArguments: any[]) {
        this._class = model;
        this._constructorArguments = constructorArguments;
        this._instanceIdentifier = Guid.create()
            .toString()
            .replace(/-/g, '');
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
        this._subjects.forEach((subject: QuerySubject<T>) => {
            subject.unsubscribe();
        });
        this._selects.forEach((select: Select<T>) => {
            select.unsubscribe();
        });
    }

    public unsubscribe() {
        this._subscriptions.forEach((sub: any) => {
            sub.unsubscribe();
        });
    }

    public getUserUuid(): string {
        return this.userUuid;
    }

    public isPrivateMode(): boolean {
        return this.privateMode;
    }

    /**
     *
     * @param firestore
     * @param options
     */
    public connectFirestore(firestore: Firestore | Firebase, options?: IConnectionFirestore): Repository<T> {
        this._connections.firestore = new FirestoreConnector<T>(this, firestore, options);
        this.userUuid = this._connections.firestore.getUserUuid();
        this.privateMode = this._connections.firestore.isPrivateMode();

        return this;
    }

    /**
     * set ngZone
     * @param ngZone
     */
    public setNgZone(ngZone: any) {
        this._zone = ngZone;
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
        subject.execStatement(subject.getSql());
        const select = new Select<T>(subject);
        this._selects.push(select);
        return select;
    }

    /**
     * select one
     * @param sql
     */
    public selectOne(sql?: IStatementOne): Observable<IEntity<T> | undefined> {
        return new Observable<IEntity<T>>(observer => {
            let sqlOne: IStatement = {limit: 1, offset: 0};
            if (sql) {
                sqlOne = {...sql};
            }

            const subject = new QuerySubject<T>(this, sqlOne);
            const select = new Select<T>(subject);
            this._selects.push(select);
            this._subjects.push(subject);

            this._subscriptions.push(
                select.getResultsAsObservable().subscribe((results: Array<IEntity<T>>) => {
                    if (results.length) {
                        this._zone.run(() => {
                            observer.next(results[0]);
                        });
                    }
                }),
            );

            subject.execStatement(subject.getSql());
        });
    }

    /**
     *
     * @param data
     * @param id
     * @param readDefaultsFromSelectStatement
     * @param skipConnector
     */
    public create(
        data?: IRepositoryDataCreate,
        id?: string | number,
        readDefaultsFromSelectStatement?: string,
        skipConnector?: string,
    ): Promise<IEntity<T>> {
        return new Promise<IEntity<T>>(resolve => {
            const c = this.createObjectFromClass(data, id, readDefaultsFromSelectStatement);

            Object.keys(this._connections as any).forEach((k: string) => {
                /* istanbul ignore next */
                if (skipConnector !== k) {
                    this._connections[k].add([c]);
                }
            });

            this._subjects.forEach((subject: QuerySubject<T>) => {
                subject.updateQueryCallbackChanges({dataAdded: true});
            });

            resolve(c);
        });
    }

    /**
     *
     * @param data
     * @param skipConnector
     */
    public remove(
        data: IEntity<T>,
        skipConnector?: string,
    ): Promise<IEntity<T>> {
        return new Promise<IEntity<T>>(resolve => {

            this._tempData.filter((value: any) => value['_uuid'] === data['_uuid']).forEach((remove: any) => {
                remove['__removed'] = true;
            });

            Object.keys(this._connections as any).forEach((k: string) => {
                /* istanbul ignore next */
                if (skipConnector !== k) {
                    // @ts-ignore
                    this._connections[k].remove([data]);
                }
            });

            this._subjects.forEach((subject: QuerySubject<T>) => {
                subject.updateQueryCallbackChanges({dataAdded: true});
            });

            resolve(data);
        });
    }

    /**
     *
     * @param data
     * @param skipConnector
     */
    public update(
        data: IEntity<T>,
        skipConnector?: string,
    ): Promise<IEntity<T>> {
        return new Promise<IEntity<T>>(resolve => {

            Object.keys(this._connections as any).forEach((k: string) => {
                /* istanbul ignore next */
                if (skipConnector !== k) {
                    // @ts-ignore
                    this._connections[k].update([data]);
                }
            });

            this._subjects.forEach((subject: QuerySubject<T>) => {
                subject.updateQueryCallbackChanges({dataUpdated: true});
            });

            resolve(data);
        });
    }

    /**
     *
     * @param data
     * @param skipConnector
     */
    public updateMultiple(
        data: Array<IEntity<T>>,
        skipConnector?: string,
    ): Promise<Array<IEntity<T>>> {
        return new Promise<Array<IEntity<T>>>(resolve => {

            Object.keys(this._connections as any).forEach((k: string) => {
                /* istanbul ignore next */
                if (skipConnector !== k) {
                    // @ts-ignore
                    this._connections[k].update(data);
                }
            });

            this._subjects.forEach((subject: QuerySubject<T>) => {
                subject.updateQueryCallbackChanges({dataUpdated: true});
            });

            resolve(data);
        });
    }

    /**
     *
     * @param data[]
     * @param skipConnector
     */
    public removeMultiple(
        data: Array<IEntity<T>>,
        skipConnector?: string,
    ): Promise<Array<IEntity<T>>> {
        return new Promise<Array<IEntity<T>>>(resolve => {

            data.forEach((value: any) => {
                value['__removed'] = true;
            });

            const ids = data.map((value: any) => value['_uuid']);
            this._tempData.filter((value: any) => ids.indexOf(value['_uuid']) >= 0).forEach((remove: any) => {
                remove['__removed'] = true;
            });

            Object.keys(this._connections as any).forEach((k: string) => {
                /* istanbul ignore next */
                if (skipConnector !== k) {
                    // @ts-ignore
                    this._connections[k].remove(data);
                }
            });

            this._subjects.forEach((subject: QuerySubject<T>) => {
                subject.updateQueryCallbackChanges({dataRemoved: true});
            });

            resolve(data);
        });
    }

    /**
     *
     * @param data
     * @param readDefaultsFromSelectStatement
     * @param skipConnector
     */
    public async createMany(
        data: IRepositoryDataCreate[],
        readDefaultsFromSelectStatement?: string,
        skipConnector?: string,
    ): Promise<Array<IEntity<T>>> {
        const promises: any = [];

        data.forEach(value => {
            promises.push(
                this.createOneFromMany(
                    value,
                    value['__uuid'] === undefined ? undefined : value['__uuid'],
                    readDefaultsFromSelectStatement,
                ),
            );
        });

        this._subjects.forEach((subject: QuerySubject<T>) => {
            subject.updateQueryCallbackChanges({dataAdded: true});
        });

        return new Promise<Array<IEntity<T>>>(resolve => {
            Promise.all(promises).then((c: any) => {
                Object.keys(this._connections as any).forEach((key: string) => {
                    if (skipConnector !== key) {
                        this._connections[key].add(c);
                    }
                });
                resolve(c);
            });
        });
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

        const c = this._constructorArguments.length ? new this._class(...this._constructorArguments) : new this._class();

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
     * count temporary data
     */
    public count(): number {
        return Object.keys(this._tempData).length;
    }

    /**
     *
     * @param id
     */
    public createClassInstance(id?: string | number): IEntity<T> {
        const c = this._constructorArguments.length ? new this._class(...this._constructorArguments) : new this._class();
        const uuid = id === undefined ? Guid.create().toString() : id;

        Object.defineProperty(c, '_uuid', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: uuid,
        });

        Object.defineProperty(c, '_timeoutSave', {
            enumerable: false,
            configurable: false,
            writable: true,
            value: {},
        });

        Object.defineProperty(c, '_lockedProperties', {
            enumerable: false,
            configurable: false,
            writable: true,
            value: {},
        });

        Object.defineProperty(c, '_timeoutSetProperty', {
            enumerable: false,
            configurable: false,
            writable: true,
            value: {},
        });

        Object.defineProperty(c, '_toPlain', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: () => {
                return classToPlain(c, {excludePrefixes: this._excludeSerializeProperties});
            },
        });

        Object.defineProperty(c, 'save', {
            enumerable: false,
            configurable: false,
            writable: true,
            value: (): void => {
                this.update(c).then(() => {
                    c['_lockedProperties'] = {};
                }).catch();
            },
        });

        Object.defineProperty(c, 'setProperty', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: (property: string, value: any) => {

                c['_lockedProperties'][property] = true;

                if (c['_timeoutSetProperty'][property] !== undefined) {
                    clearTimeout(c['_timeoutSetProperty'][property]);
                }
                c['_timeoutSetProperty'][property] = setTimeout(() => {
                    c[property] = value;
                    this._subjects.forEach((subject: QuerySubject<T>) => {
                        subject.updateQueryCallbackChanges({dataUpdated: true});
                    });
                }, 500);

                return {
                    save: (): void => {
                        if (c['_timeoutSave'][property] !== undefined) {
                            clearTimeout(c['_timeoutSave'][property]);
                        }
                        c['_timeoutSave'][property] = setTimeout(() => {
                            this.update(c).then(() => {
                                c['_lockedProperties'][property] = false;
                            }).catch();
                        }, 1000);
                    }
                };
            },
        });

        return c;
    }

    private createObjectFromClass(
        data?: IRepositoryDataCreate,
        id?: string | number,
        readDefaultsFromSelectStatement?: string,
    ) {

        const exdistingId = id ? id : (data && data['__uuid'] ? data['__uuid'] : null);
        const existingItem = this._tempData.filter((item: IRepositoryData) => {
            return item._uuid === exdistingId;
        });

        const c = existingItem.length ? existingItem[0]._ref : this.createClassInstance(id) as any;

        if (data) {

            Object.keys(data).forEach((k: string) => {
                if (!c['_lockedProperties'][k]) {
                    c[k] = data[k];
                }
            });
        }

        c['__owner'] = {};

        if (data && data['__owner']) {
            c['__owner'] = data['__owner'];
        } else if (this.getUserUuid() !== 'null') {
            c['__owner'][this.getUserUuid()] = true;
            if (!this.isPrivateMode) {
                c['__owner']['EVERYBODY'] = true;
            }
        } else if (!this.isPrivateMode()) {
            c['__owner']['EVERYBODY'] = true;
        }

        if (readDefaultsFromSelectStatement) {
            const additionalData = this.getDataFromSelectStatement(readDefaultsFromSelectStatement);
            Object.keys(additionalData).forEach((k: string) => {
                c[k] = additionalData[k];
            });
        }

        if (existingItem.length) {
            existingItem.forEach((item: IRepositoryData) => {
                item._ref = c;
            });
        } else {
            this._tempData.push({
                _ref: c,
                _uuid: c._uuid,
                __removed: false,
                __owners: Object.keys(c.__owner).map(k => (c.__owner[k] ? k : '')),
            });
        }
        return c;
    }

    /**
     *
     * @param data
     * @param id
     */
    private createOneFromMany(
        data: IRepositoryDataCreate,
        id?: string | number,
        readDefaultsFromSelectStatement?: string,
    ): Promise<IEntity<T>> {
        return new Promise<IEntity<T>>(resolve => {
            resolve(this.createObjectFromClass(data, id, readDefaultsFromSelectStatement));
        });
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
     *
     * @param readDefaultsFromSelectStatement
     */
    private getDataFromSelectStatement(readDefaultsFromSelectStatement: string): { [key: string]: any } {
        let where: string = readDefaultsFromSelectStatement;
        const and: string[] = [];
        const data: { [key: string]: any } = {};
        const splitsLeft = [' WHERE '];
        const splitsRight = [' ORDER BY ', ' HAVING ', ' GROUP BY ', ' LIMIT '];

        splitsLeft.forEach((s: string) => {
            where = where.split(s)[1];
        });

        if (!where) {
            return {};
        }

        splitsRight.forEach((s: string) => {
            where = where.split(s)[0];
        });

        where.split(' AND ').forEach((s: string) => {
            if (s.indexOf(' OR ') === -1) {
                const segment = s.replace(/(\))*$/, '').replace(/^(\()*/, '');
                if (and.filter((value: string) => value === segment).length === 0) {
                    and.push(segment);
                }
            }
        });

        and.forEach((s: string) => {
            const match = s.match(/^([A-z]*) (=|LIKE) (.*)/);
            if (match && match[3] !== undefined) {
                data[match[1]] =
                    match[3].indexOf('"') === 0 || match[3].indexOf("'") === 0
                        ? match[3].substr(1, match[3].length - 2)
                        : parseFloat(match[3]);
            }
        });

        return data;
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
