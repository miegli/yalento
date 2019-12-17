import { classToPlain, deserialize, plainToClassFromExist } from 'class-transformer';
import { Guid } from 'guid-typescript';
import geohash from 'ngeohash';
import 'reflect-metadata';
import { Subject } from 'rxjs';
import { IConnectorInterface } from './connector/ConnectorInterface';
import { Firebase, Firestore, FirestoreConnector, IConnectionFirestore } from './connector/FirestoreConnector';
import { IConnectionLocalStorage, IStorage, LocalStorageConnector } from './connector/LocalStorageConnector';
import { IQueryPaginatorDefaults } from './query/QueryPaginator';
import { IStatement, QuerySubject } from './QuerySubject';
import { Select } from './select/select';

/// <reference path="alasql.d.ts" />
// tslint:disable-next-line:no-var-requires
const alasql = require('alasql');

export interface IRepositoryData {
  _ref: any;
  __removed: boolean;
  __uuid: string;
  __owner: string[];
  __viewer: string[];
}

export interface IConnections<T> {
  [key: string]: IConnectorInterface<T>;
}

export type IRepositoryDataCreate<T> = IBaseIRepositoryDataCreate<T> &
  {
    [P in keyof T]?: T[P];
  };

export interface IClassProperty {
  name: string;
}

interface IBaseEntityInner {
  save(): void;
}

interface IBaseIRepositoryDataCreate<T> {
  __uuid?: any;
}

interface IBaseEntity<T> {
  save(): void;

  remove(): void;

  getUuid(): string;

  getModel(): T;

  setProperty(property: keyof T, value: any): IBaseEntityInner;

  setGeoPoint(latitude: number, longitude: number): IBaseEntityInner;

  getDistance(): number;

  isLoaded(): boolean;

  isRemoved(): boolean;

  getGeoData(): GeoData;

  _toPlain(): {};
}

export type IEntity<T> = IBaseEntity<T> &
  {
    [P in keyof T]?: T[P];
  };

export type IConnectionsKeys = ['firestore'];

class GeoData {
  private readonly geohash: string;
  private readonly latitude: number;
  private readonly longitude: number;

  constructor(hash: string, lat: number, lng: number) {
    this.geohash = hash;
    this.latitude = lat;
    this.longitude = lng;
  }

  public getHash(): string {
    return this.geohash;
  }

  public getLat(): number {
    return this.latitude;
  }

  public getLng(): number {
    return this.longitude;
  }
}

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

  public cachedByIdentifier: { [uuid: string]: boolean } = {};
  private readonly _instanceIdentifier: string;
  private readonly _class: any;
  private readonly _classProperties: IClassProperty[] = [];
  private readonly _constructorArguments: any;
  private readonly _subjects: Array<QuerySubject<T>> = [];
  private readonly _selects: Array<Select<T>> = [];
  private _subscriptions: any[] = [];
  private _tempData: IRepositoryData[] = [];
  private _excludeSerializeProperties: string[] = ['__owner', '__distance'];
  private _connections: IConnections<IEntity<T>> = {};
  private _className: string = '';
  private userUuid: any = null;
  private userUuid$: Subject<any> = new Subject();
  private privateMode: boolean = false;
  private geoQuery: string = '';

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

  public getUserUuidObservable(): Subject<any> {
    return this.userUuid$;
  }

  public isPrivateMode(): boolean {
    return this.privateMode;
  }

  /**
   *
   * @param storage
   * @param options
   */
  public connectLocalStorage(storage: IStorage, options?: IConnectionLocalStorage) {
    this._connections.localStorage = new LocalStorageConnector<T>(this, storage, options);
  }

  /**
   *
   * @param firestore
   * @param options
   */
  public connectFirestore(firestore: Firestore | Firebase, options?: IConnectionFirestore): Repository<T> {
    this._connections.firestore = new FirestoreConnector<T>(this, firestore, options);
    this._connections.firestore.getUserUuid().subscribe((u: any) => {
      if (u) {
        this.userUuid$.next(u);
        this.userUuid = u;
      }
    });

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
              subject.updateQueryCallbackChanges({ geoLocationChanged: true });
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
              subject.updateQueryCallbackChanges({ geoLocationChanged: true });
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
              subject.updateQueryCallbackChanges({ geoLocationChanged: true });
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
  public loadQueryFromConnectors(query: string) {
    (Object.keys(this._connections) as IConnectionsKeys).forEach((key: string) => {
      this._connections[key].select(query);
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
    subject.execStatement(subject.getSql()).then();
    const select = new Select<T>(subject);
    this._selects.push(select);
    return select;
  }

  public getOneByIdentifier(identifier: string): Promise<IEntity<T>> {
    return new Promise<IEntity<T>>(async (resolve, reject) => {
      if (!identifier) {
        reject('getOneByIdentifier identifier is null for ' + this.getClassName());
      } else {
        if (!this.cachedByIdentifier[identifier]) {
          const existingData = await this.exec(
            {
              where: '__uuid LIKE ?',
              params: [identifier],
            },
            true,
          ).then();
          if (existingData.length) {
            resolve(existingData[0]);
            return;
          }
        }

        const promises: any = [];
        (Object.keys(this._connections) as IConnectionsKeys).forEach((key: string) => {
          promises.push(this._connections[key].selectOneByIdentifier(identifier));
        });

        if (promises.length === 0) {
          resolve(undefined);
        }

        Promise.all(promises).then(() => {
          this.exec({ where: '__uuid LIKE ?', params: [identifier] }, true).then(data => {
            resolve(data.length ? data[0] : undefined);
            this.cachedByIdentifier[identifier] = true;
          });
        });
      }
    });
  }

  public exec(sql: IStatement, skipGeolocation?: boolean): Promise<Array<IEntity<T>>> {
    return new Promise<Array<IEntity<T>>>(resolve => {
      const subject = new QuerySubject<T>(this, sql);
      subject.execStatement(sql, true, skipGeolocation).then((results: any) => {
        resolve(results);
      });
    });
  }

  /**
   *
   * @param data
   * @param id
   * @param readDefaultsFromSelectStatement
   * @param skipConnector
   * @param owners
   */
  public create(
    data?: IRepositoryDataCreate<T>,
    id?: string | number,
    readDefaultsFromSelectStatement?: string,
    skipConnector?: string,
    owners?: string[],
  ): Promise<IEntity<T>> {
    return new Promise<IEntity<T>>(async resolve => {
      const c = this.createObjectFromClass(data, id, readDefaultsFromSelectStatement, owners);

      Object.keys(this._connections as any).forEach((k: string) => {
        /* istanbul ignore next */
        if (skipConnector !== k) {
          this._connections[k].add([c]);
        }
      });

      this._subjects.forEach((subject: QuerySubject<T>) => {
        subject.updateQueryCallbackChanges({ dataAdded: true });
      });

      resolve(c);
    });
  }

  /**
   *
   * @param data
   * @param skipConnector
   */
  public remove(data: IEntity<T> | T, skipConnector?: string): Promise<IEntity<T>> {
    return new Promise<IEntity<T>>(resolve => {
      this._tempData
        .filter((value: any) => value['__uuid'] === data['__uuid'])
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
        subject.updateQueryCallbackChanges({ dataRemoved: true });
      });

      resolve(data as any);
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
        subject.updateQueryCallbackChanges({ dataUpdated: true });
      });

      this._tempData
        .filter((item: IRepositoryData) => {
          return item.__uuid === data.getUuid();
        })
        .forEach(item => {
          item['_ref'] = data;
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
        subject.updateQueryCallbackChanges({ dataUpdated: true });
      });

      resolve(data);
    });
  }

  /**
   *
   * @param data
   * @param skipConnector
   */
  public removeMultiple(data: Array<IEntity<T>> | T[], skipConnector?: string): Promise<Array<IEntity<T>>> | T[] {
    return new Promise<Array<IEntity<T>>>(resolve => {
      data.forEach((value: any) => {
        value['__removed'] = true;
      });

      const ids = (data as any).map((value: any) => value['__uuid']);
      this._tempData
        .filter((value: any) => ids.indexOf(value['__uuid']) >= 0)
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
        subject.updateQueryCallbackChanges({ dataRemoved: true });
      });

      resolve(data as any);
    });
  }

  /**
   *
   * @param data
   * @param readDefaultsFromSelectStatement
   * @param skipConnector
   */
  public async createMany(
    data: Array<IRepositoryDataCreate<T>>,
    readDefaultsFromSelectStatement?: string,
    skipConnector?: string,
  ): Promise<Array<IEntity<T>>> {
    return new Promise<Array<IEntity<T>>>(async resolve => {
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
        subject.updateQueryCallbackChanges({ dataAdded: true });
      });

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

  public updateGeoLocations(nearByFound: T[], currentLat: number, currentLng: number) {
    const idGeoHashMap = {};
    nearByFound.forEach((item: T) => {
      idGeoHashMap[item['__uuid']] = {
        hash: item['__geohash'],
        distance: this.distance(item['__latitude'], item['__longitude'], currentLat, currentLng),
      };
    });

    this._tempData.map((item: IRepositoryData) => {
      item['__geohash'] = idGeoHashMap[item.__uuid] ? idGeoHashMap[item.__uuid].hash : null;
      item['_ref']['__distance'] = idGeoHashMap[item.__uuid] ? idGeoHashMap[item.__uuid].distance : 0;
    });

    this._subjects.forEach((subject: QuerySubject<T>) => {
      subject.updateQueryCallbackChanges({ dataUpdated: true });
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

    if (this._tempData.length) {
      Object.keys(this._tempData[0]['_ref']).forEach((property: string) => {
        if (property !== '__geohash' && property !== '__owner' && property !== '__viewer') {
          this._classProperties.push({ name: property });
        }
      });
    } else {
      const c = this._constructorArguments.length ? new this._class(...this._constructorArguments) : new this._class();
      Object.keys(c).forEach((property: string) => {
        if (property !== '__owner' && property !== '__viewer') {
          this._classProperties.push({ name: property });
        }
      });
    }

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

  public setGeoQuery(geoQuery?: string) {
    this.geoQuery = geoQuery ? geoQuery : '';
  }

  public getGeoQuery(): string {
    return this.geoQuery;
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

    Object.defineProperty(c, '__uuid', {
      enumerable: true,
      configurable: false,
      writable: false,
      value: uuid,
    });

    Object.defineProperty(c, 'isLoaded', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: () => true,
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
        return deserialize(this._class, JSON.stringify(plain));
      },
    });

    Object.defineProperty(c, 'isRemoved', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: (): boolean => {
        return c['__removed'];
      },
    });

    Object.defineProperty(c, 'getDistance', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: (): number => {
        return c['__distance'] ? c['__distance'] : 0;
      },
    });

    Object.defineProperty(c, 'toJson', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: (): GeoData => {
        return new GeoData(c['__geohash'], c['__latitude'], c['__longitude']);
      },
    });

    Object.defineProperty(c, '_toPlain', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: () => {
        return classToPlain(o, {
          excludePrefixes: this._excludeSerializeProperties,
          enableImplicitConversion: true,
        });
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
        return c.__uuid;
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
            subject.updateQueryCallbackChanges({ dataUpdated: true });
          });
        }, 500);

        return {
          save: (): void => {
            if (c['_timeoutSave'][property] !== undefined) {
              clearTimeout(c['_timeoutSave'][property]);
            }
            c['_timeoutSave'][property] = setTimeout(() => {
              const d = {};
              d[property] = value;
              this.create(d, c.__uuid)
                .then(() => {
                  c['_lockedProperties'][property] = false;
                })
                .catch();
            }, 100);
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
          c['__geohash'] = geohash.encode(latitude, longitude);
        } else {
          throw new Error('latitude must be between -90 and 90. longitude must be between -180 and 180');
        }
        return {
          save: (): void => {
            this.updateProperties(
              {
                __latitude: c['__latitude'],
                __longitude: c['__longitude'],
                __geohash: c['__geohash'],
              } as any,
              c.__uuid,
            )
              .then()
              .catch();
          },
        };
      },
    });

    return c;
  }

  private createObjectFromClass(
    data?: IRepositoryDataCreate<T>,
    id?: string | number,
    readDefaultsFromSelectStatement?: string,
    owners?: string[],
  ) {
    const exdistingId = id ? id : data && data['__uuid'] ? data['__uuid'] : null;
    const existingItem = this._tempData.filter((item: IRepositoryData) => {
      return item.__uuid === exdistingId;
    });

    const c = existingItem.length ? existingItem[0]._ref : (this.createClassInstance(id) as any);

    if (data) {
      Object.keys(data).forEach((k: string) => {
        if (
          (!c['_lockedProperties'][k] && k.substr(0, 1) !== '_') ||
          k === '__references' ||
          k === '__geohash' ||
          k === '__viewer'
        ) {
          if (data[k] && data[k].constructor.name === 'Timestamp') {
            c[k] = new Date();
            c[k].setTime(data[k].seconds * 1000);
          } else {
            c[k] = data[k];
          }
        }
      });
    }

    c['__owner'] = {};

    if (owners) {
      owners.forEach((o: string) => {
        c['__owner'][o] = true;
      });
    } else {
      if (data && data['__owner']) {
        c['__owner'] = data['__owner'];
      } else if (this.getUserUuid() && this.getUserUuid().substr(0, 10) !== 'ANONYMOUS_') {
        c['__owner'][this.getUserUuid()] = true;
        if (!this.isPrivateMode) {
          c['__owner']['EVERYBODY'] = true;
        }
      } else if (!this.isPrivateMode()) {
        c['__owner']['EVERYBODY'] = true;
      }
    }

    if (data && data['__viewer']) {
      c['__viewer'] = data['__viewer'];
    } else if (!this.isPrivateMode) {
      c['__viewer'] = { EVERYBODY: true };
    } else {
      c['__viewer'] = {};
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
        __uuid: c.__uuid,
        __removed: false,
        __owner: Object.keys(c.__owner).map(k => (c.__owner[k] ? k : '')),
        __viewer: Object.keys(c.__viewer).map(k => (c.__viewer[k] ? k : '')),
      });
    }

    return c;
  }

  /**
   *
   * @param data
   * @param id
   * @param readDefaultsFromSelectStatement
   */
  private createOneFromMany(
    data: IRepositoryDataCreate<T>,
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

  private createEmptyEntity(): IEntity<T> {
    const o = this._constructorArguments.length ? new this._class(...this._constructorArguments) : new this._class();

    Object.defineProperty(o, 'isLoaded', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: () => false,
    });

    Object.defineProperty(o, 'getModel', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: (): T => {
        return o;
      },
    });

    Object.defineProperty(o, 'isRemoved', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: (): boolean => {
        return false;
      },
    });

    Object.defineProperty(o, 'getDistance', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: (): number => 0,
    });

    Object.defineProperty(o, 'save', {
      enumerable: false,
      configurable: false,
      writable: true,
      value: (): void => {
        return;
      },
    });

    Object.defineProperty(o, 'remove', {
      enumerable: false,
      configurable: false,
      writable: true,
      value: (): void => {
        return;
      },
    });

    Object.defineProperty(o, 'getUuid', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: (): string => {
        return '';
      },
    });

    Object.defineProperty(o, 'setProperty', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: (property: string, value: any) => {
        o[property] = value;
      },
    });

    Object.defineProperty(o, 'setGeoPoint', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: () => {
        return o;
      },
    });

    return o;
  }

  /**
   *
   * @param data
   * @param id
   */
  private updateProperties(data: IRepositoryDataCreate<T>, id: string | number): Promise<void> {
    return new Promise<void>(async resolve => {
      Object.keys(this._connections as any).forEach((k: string) => {
        /* istanbul ignore next */
        data['__uuid'] = id;

        Object.defineProperty(data, '_toPlain', {
          enumerable: false,
          configurable: false,
          writable: false,
          value: () => {
            return classToPlain(data, {
              excludePrefixes: this._excludeSerializeProperties,
              enableImplicitConversion: true,
            });
          },
        });
        this._connections[k].add([data as any]);
      });

      this._subjects.forEach((subject: QuerySubject<T>) => {
        subject.updateQueryCallbackChanges({ dataAdded: true });
      });
      resolve();
    });
  }

  /**
   *
   * @param lat1
   * @param lon1
   * @param lat2
   * @param lon2
   */
  private distance(lat1, lon1, lat2, lon2) {
    if (lat1 === lat2 && lon1 === lon2) {
      return 0;
    } else {
      const radlat1 = (Math.PI * lat1) / 180;
      const radlat2 = (Math.PI * lat2) / 180;
      const theta = lon1 - lon2;
      const radtheta = (Math.PI * theta) / 180;
      let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
      if (dist > 1) {
        dist = 1;
      }
      dist = Math.acos(dist);
      dist = (dist * 180) / Math.PI;
      dist = dist * 60 * 1.1515;
      return dist * 1.609344;
    }
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
