import {classToPlain, deserialize, plainToClassFromExist} from 'class-transformer';
import 'es6-shim';
import {FeatureCollection} from 'geofirex';
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

export enum GeoStatusEnum {
    NOT_SET = 0,
    FOUND = 1,
    NOT_FOUND = 2,
}

export interface IGeoData {
    status: number;
    radius: number;
    distance: number;
    bearing: number;
    lng: number;
    lat: number;
    features: FeatureCollection | null;
    uuid: string;
}

export interface IRepositoryData {
    _ref: any;
    __removed: boolean;
    _uuid: string;
    __owners: string[];
    geo: IGeoData;
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

interface IBaseEntity<T> {
    save(): void;

    remove(): void;

    remove(): void;

    getUuid(): string;

    getModel(): T;

    setProperty(property: keyof T, value: any): IBaseEntityInner;

    setGeoPoint(latitude: number, longitude: number): IBaseEntityInner;

    getGeoData(): IGeoData;
}

export type IEntity<T> = IBaseEntity<T> &
    {
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
    private _tempGeoDataUuidMap: { [uuid: string]: IGeoData } = {};
    private _excludeSerializeProperties: string[] = ['__owner', '__uuid', '__geo'];
    private _connections: IConnections<IEntity<T>> = {};
    private _className: string = '';
    private userUuid: string = '';
    private userUuid$: Observable<string> = new Observable<string>();
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

    public getUserUuidObservable(): Observable<string> {
        return this.userUuid$;
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

        this._connections.firestore.getUserUuid().subscribe((uid: string) => {
            this.userUuid = uid;
        });
        this.userUuid$ = this._connections.firestore.getUserUuid();

        this.privateMode = this._connections.firestore.isPrivateMode();

        if (options && options.nearBy) {
            let timeout;
            this._subscriptions.push(
                options.nearBy.lat.subscribe(() => {
                    if (timeout) {
                        clearTimeout(timeout);
                    }
                    timeout = setTimeout(() => {
                        this._subjects.forEach((subject: QuerySubject<T>) => {
                            subject.updateQueryCallbackChanges({geoLocationChanged: true});
                        });
                    }, 10);
                }),
            );
            this._subscriptions.push(
                options.nearBy.long.subscribe(() => {
                    if (timeout) {
                        clearTimeout(timeout);
                    }
                    timeout = setTimeout(() => {
                        this._subjects.forEach((subject: QuerySubject<T>) => {
                            subject.updateQueryCallbackChanges({geoLocationChanged: true});
                        });
                    }, 10);
                }),
            );
            this._subscriptions.push(
                options.nearBy.radius.subscribe(() => {
                    if (timeout) {
                        clearTimeout(timeout);
                    }
                    timeout = setTimeout(() => {
                        this._subjects.forEach((subject: QuerySubject<T>) => {
                            subject.updateQueryCallbackChanges({geoLocationChanged: true});
                        });
                    }, 10);
                }),
            );
        }

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
    public loadQueryFromConnectors(query: string, uuid?: string) {
        (Object.keys(this._connections) as IConnectionsKeys).forEach((key: string) => {
            this._connections[key].select(query, uuid);
        });
    }

    /**
     *
     * @param sql
     * @param paginatorDefaults
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
                if (sql.uuid && !sql.where) {
                    sql.where = '__uuid = ' + sql.uuid;
                }
                if (sql.uuid && sql.where) {
                    sql.where = '(' + sql.where + ' ) AND __uuid = ' + sql.uuid;
                }
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
    public remove(data: IEntity<T>, skipConnector?: string): Promise<IEntity<T>> {
        return new Promise<IEntity<T>>(resolve => {
            this._tempData
                .filter((value: any) => value['_uuid'] === data['_uuid'])
                .forEach((remove: any) => {
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
    public update(data: IEntity<T>, skipConnector?: string): Promise<IEntity<T>> {
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
    public updateMultiple(data: Array<IEntity<T>>, skipConnector?: string): Promise<Array<IEntity<T>>> {
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
    public removeMultiple(data: Array<IEntity<T>>, skipConnector?: string): Promise<Array<IEntity<T>>> {
        return new Promise<Array<IEntity<T>>>(resolve => {
            data.forEach((value: any) => {
                value['__removed'] = true;
            });

            const ids = data.map((value: any) => value['_uuid']);
            this._tempData
                .filter((value: any) => ids.indexOf(value['_uuid']) >= 0)
                .forEach((remove: any) => {
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
     * @param data
     */
    public updateGeoData(data: IGeoData[]) {
        this._tempGeoDataUuidMap = {};
        data.forEach((r: IGeoData) => {
            this._tempGeoDataUuidMap[r.uuid] = r;
        });

        this._tempData.forEach((d: IRepositoryData) => {
            if (this._tempGeoDataUuidMap[d._uuid] !== undefined) {
                d.geo = this._tempGeoDataUuidMap[d._uuid];
            } else {
                d.geo.status = GeoStatusEnum.NOT_FOUND;
            }
        });

        this._subjects.forEach((subject: QuerySubject<T>) => {
            subject.updateQueryCallbackChanges({dataUpdated: true});
        });
    }

    /**
     *
     * @param id
     * @param data
     */
    public createClassInstance(id?: string | number, data?: any): IEntity<T> {
        const o = this._constructorArguments.length ? new this._class(...this._constructorArguments) : new this._class();
        const c = plainToClassFromExist(o, data ? data : {}) as any;

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

        Object.defineProperty(c, 'getModel', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: (): T => {
                const plain = c['_toPlain']();
                plain['geoData'] = this._tempGeoDataUuidMap[c._uuid] ? this._tempGeoDataUuidMap[c._uuid] : {};
                return deserialize(this._class, JSON.stringify(plain), {excludePrefixes: ['__']});
            },
        });

        Object.defineProperty(c, 'getGeoData', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: (): IGeoData => {
                return this._tempGeoDataUuidMap[c._uuid];
            },
        });

        Object.defineProperty(c, '_toPlain', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: () => {
                return classToPlain(o, {excludePrefixes: this._excludeSerializeProperties});
            },
        });

        Object.defineProperty(c, 'save', {
            enumerable: false,
            configurable: false,
            writable: true,
            value: (): void => {
                this.update(c)
                    .then(() => {
                        c['_lockedProperties'] = {};
                    })
                    .catch();
            },
        });

        Object.defineProperty(c, 'remove', {
            enumerable: false,
            configurable: false,
            writable: true,
            value: (): void => {
                this.remove(c)
                    .then()
                    .catch();
            },
        });

        Object.defineProperty(c, 'getUuid', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: (): string => {
                return c._uuid;
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
                            this.update(c)
                                .then(() => {
                                    c['_lockedProperties'][property] = false;
                                })
                                .catch();
                        }, 1000);
                    },
                };
            },
        });

        Object.defineProperty(c, 'setGeoPoint', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: (latitude: number, longitude: number) => {
                if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
                    c['__latitude'] = latitude;
                    c['__longitude'] = longitude;
                } else {
                    throw new Error('latitude must be between -90 and 90. longitude must be between -180 and 180');
                }
                return {
                    save: (): void => {
                        this.update(c)
                            .then()
                            .catch();
                    },
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
        const exdistingId = id ? id : data && data['__uuid'] ? data['__uuid'] : null;
        const existingItem = this._tempData.filter((item: IRepositoryData) => {
            return item._uuid === exdistingId;
        });

        const c = existingItem.length ? existingItem[0]._ref : (this.createClassInstance(id) as any);

        if (data) {
            Object.keys(data).forEach((k: string) => {
                if (!c['_lockedProperties'][k] && k.substr(0, 1) !== '_') {
                    c[k] = data[k];
                }
            });
        }

        c['__owner'] = {};

        if (data && data['__owner']) {
            c['__owner'] = data['__owner'];
        } else if (this.getUserUuid() !== 'null' && this.getUserUuid() !== '') {
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
                if (data && data['__location']) {
                    item.geo.lat = data['__location']['geopoint']['_lat'];
                    item.geo.lng = data['__location']['geopoint']['_long'];
                    this._tempGeoDataUuidMap[item.geo.uuid] = item.geo;
                }
            });
        } else {
            const geo = {
                uuid: c._uuid,
                status: 0,
                radius: 0,
                distance: 0,
                bearing: 0,
                lat: data && data['__location'] ? data['__location']['geopoint']['_lat'] : 0,
                lng: data && data['__location'] ? data['__location']['geopoint']['_long'] : 0,
                features: null,
            };
            this._tempData.push({
                geo: geo,
                _ref: c,
                _uuid: c._uuid,
                __removed: false,
                __owners: Object.keys(c.__owner).map(k => (c.__owner[k] ? k : '')),
            });

            this._tempGeoDataUuidMap[c._uuid] = geo;
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
