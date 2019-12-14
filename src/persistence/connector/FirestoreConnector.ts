import * as firesql from 'firesql/firesql.umd.js';
import 'firesql/rx';
import {Guid} from 'guid-typescript';
import geohash from 'ngeohash';
import {BehaviorSubject, Observable} from 'rxjs';
import {IEntity, Repository} from '../Repository';
import {AbstractConnector} from './AbstractConnector';

export class Firestore {
}

export class Firebase {
}

export declare class User {
    public readonly uid: string | null;

    constructor(uid: string | null);
}

export type ConnectionFirestoreDataMode = 'PRIVATE' | 'ALL';

export interface IParentConnection {
    modelName: string;
    documentId: string;
}

export interface IConnectionFirestoreNearBy {
    long: BehaviorSubject<number>;
    lat: BehaviorSubject<number>;
    radius: BehaviorSubject<number>;
}

export interface IConnectionFirestore {
    parent?: IParentConnection[];
    dataMode?: ConnectionFirestoreDataMode;
    realtimeMode?: boolean;
    nearBy?: IConnectionFirestoreNearBy;
    debug?: boolean;
}

export class FirestoreConnector<T> extends AbstractConnector<T> {
    public readonly options: IConnectionFirestore;
    private db: Firestore;
    private app: any;
    private readonly dataMode: ConnectionFirestoreDataMode = 'ALL';
    private readonly realtimeMode: boolean = true;
    private readonly debug: boolean;
    private currentUser: User = {uid: null};
    private currentUser$: BehaviorSubject<User> = new BehaviorSubject<User>({uid: null});
    private firesSQL: any;
    private lastSql: string = '';
    private rxQuerySubscriber: any;
    private observers: any[] = [];

    constructor(repository: Repository<T>, db: Firestore, options?: IConnectionFirestore) {
        super(repository);

        this.options = options ? options : {};

        if (this.options.dataMode) {
            this.dataMode = this.options.dataMode;
        }

        if (this.options.realtimeMode === false) {
            this.realtimeMode = false;
        }

        this.debug = !!this.options.debug;

        /* istanbul ignore next */
        this.db = (db as any).firestore ? (db as any).firestore : (db as any);
        this.app = (this.db as any).app;
        this.firesSQL = new firesql.FireSQL(this.db);

        if (typeof this.app.auth === 'function') {
            this.app.auth().onAuthStateChanged((state: any) => {
                this.currentUser = {
                    uid: state ? state.uid : null,
                };
                this.currentUser$.next(this.currentUser);
            });
        } else {
            this.currentUser$.next({uid: 'ANONYMOUS_' + Guid.create().toString()});
        }
    }

    public getUserUuid(): Observable<string> {
        const o = new Observable<string>(observer => {
            this.currentUser$.subscribe((u: User) => {
                if (u && u.uid !== undefined) {
                    observer.next(u.uid ? u.uid : '');
                }
            });
        });

        this.observers.push(o);
        return o;
    }

    public isPrivateMode(): boolean {
        return this.dataMode === 'PRIVATE';
    }

    public async add(items: Array<IEntity<T>>) {
        items.forEach((item: any) => {
            const data = item._toPlain();
            if (this.options.nearBy !== undefined) {
                data['__geohash'] = geohash.encode(this.options.nearBy.lat.getValue(), this.options.nearBy.long.getValue());
                data['__latitude'] = this.options.nearBy.lat.getValue();
                data['__longitude'] = this.options.nearBy.long.getValue();
                data['__geopoint'] = new this.app.firebase_.firestore.GeoPoint(
                    this.options.nearBy.lat.getValue(),
                    this.options.nearBy.long.getValue(),
                );
            }

            data['__uuid'] = item['__uuid'];
            data['__owner'] = item['__owner'] ? item['__owner'] : {};

            if (this.currentUser.uid && this.currentUser.uid !== 'null') {
                data['__owner'][this.currentUser.uid] = true;
            }

            if (this.dataMode !== 'PRIVATE') {
                data['__owner']['EVERYBODY'] = true;
            }

            if (data['__references'] !== undefined) {
                delete data['__references'];
            }

            const docReference = (this.db as any).doc(this.getPath() + '/' + item.__uuid);

            if (this.debug) {
                this.debugMessage(`firebase writes to ${this.getPath() + '/' + item.__uuid}`, data);
            }

            docReference
                .set(data, {merge: true})
                .then(() => {
                    if (this.options.parent) {
                        const references = {};
                        references[this.repository.getClassName()] = {
                            name: this.repository.getClassName(),
                            lastUpdated: new Date(),
                        };

                        (this.db as any)
                            .doc(this.getParentDocumentPath())
                            .set({__references: references}, {merge: true})
                            .then()
                            .catch();
                    }
                })
                .catch(e => {
                    throw new Error(
                        'error while creating firestore document "' + this.getPath() + '/' + item.__uuid + '": ' + e.message,
                    );
                });
        });

        return;
    }

    public async update(items: Array<IEntity<T>>) {
        await this.add(items);
        return;
    }

    public async remove(items: Array<IEntity<T>>) {
        if (this.rxQuerySubscriber) {
            this.rxQuerySubscriber.unsubscribe();
            this.lastSql = '';
        }

        const promises: any = [];

        items.forEach((item: any) => {
            const docReference = (this.db as any).doc(this.getPath() + '/' + item.__uuid);
            promises.push(docReference.delete());
        });

        await Promise.all(promises);
    }

    public async select(sql: string) {
        let hasGeoLocations = false;
        const originalSqlParts = sql.split(' WHERE ', 2);
        let finalSql =
            'SELECT * FROM ' +
            this.getPath() +
            ' WHERE ' +
            this.replaceSql(originalSqlParts[1], !!(this.options.nearBy && this.options.nearBy.radius.getValue() > 0));

        if (this.options.nearBy && this.options.nearBy.radius.getValue() > 0) {
            hasGeoLocations = true;
            const range = this.getGeohashRange(
                this.options.nearBy.lat.getValue(),
                this.options.nearBy.long.getValue(),
                this.options.nearBy.radius.getValue(),
            );
            const geoquery = ' AND __geohash >= "' + range.lower + '" AND __geohash <= "' + range.upper + '" ';
            finalSql += geoquery;
            this.repository.setGeoQuery(geoquery + ' AND __distance <= ' + this.options.nearBy.radius.getValue());
        } else {
            this.repository.setGeoQuery();
        }

        if (this.lastSql !== finalSql) {
            if (this.realtimeMode) {
                const data$ = this.firesSQL.rxQuery(finalSql);

                if (this.rxQuerySubscriber) {
                    this.rxQuerySubscriber.unsubscribe();
                }

                if (this.debug) {
                    this.debugMessage(`firebase subscribes to ${finalSql}`);
                }

                this.rxQuerySubscriber = data$.subscribe((results: any) => {
                    if (results.length) {
                        this.repository
                            .createMany(results, '', 'firestore')
                            .then()
                            .catch(e => {
                                throw e;
                            });
                    }
                    if (hasGeoLocations && this.options.nearBy) {
                        this.repository.updateGeoLocations(
                            results,
                            this.options.nearBy.lat.getValue(),
                            this.options.nearBy.long.getValue(),
                        );
                    }
                });
            } else {
                if (this.debug) {
                    this.debugMessage(`firebase reads once from ${finalSql}`);
                }

                this.firesSQL
                    .query(finalSql)
                    .then((results: any) => {
                        if (results.length) {
                            this.repository
                                .createMany(results, '', 'firestore')
                                .then()
                                .catch();
                        }
                        if (hasGeoLocations && this.options.nearBy) {
                            this.repository.updateGeoLocations(
                                results,
                                this.options.nearBy.lat.getValue(),
                                this.options.nearBy.long.getValue(),
                            );
                        }
                    })
                    .catch(e => {
                        throw e;
                    });
            }

            this.lastSql = finalSql;
        }
        return;
    }

    public async disconnect() {
        if (this.rxQuerySubscriber) {
            this.rxQuerySubscriber.unsubscribe();
        }

        if (this.observers.length) {
            this.observers.forEach((o: any) => {
                if (typeof o.unsubscribe === 'function') {
                    o.unsubscribe();
                }
            });
        }

        if (this.debug) {
            this.debugMessage(`firebase disconnected`);
        }
    }

    public selectOneByIdentifier(identifier: string): Promise<any> {
        return new Promise(async resolve => {
            if (this.debug) {
                this.debugMessage(`firebase read once ${this.getPath() + '/' + identifier}`);
            }
            (this.db as any)
                .doc(this.getPath() + '/' + identifier)
                .get()
                .then(data => {
                    if (!data.exists) {
                        resolve(null);
                    } else {
                        this.repository
                            .create(data.data(), identifier, undefined, 'firestore')
                            .then(e => {
                                resolve(e);
                            })
                            .catch(() => {
                                resolve(null);
                            });
                    }
                });
        });
    }

    /**
     *
     * @param sql
     * @param hasGeoCondition
     */
    private replaceSql(sql: string, hasGeoCondition: boolean): string {
        let statement = sql;

        statement = statement.replace(new RegExp(/'(.*)' IN \(([^)]*)\)/, 'gm'), '`$2.$1`');

        const inequalityMatch = statement.match(/( < | <= | > | >= | != )/g);

        if (inequalityMatch && inequalityMatch.length >= (hasGeoCondition ? 0 : 2)) {
            let replacedStatement = '';
            statement.split(/( AND | OR )/g).forEach((part: string) => {
                if (!part.match(/( < | <= | > | >= | != )/g)) {
                    replacedStatement += part;
                } else {
                    replacedStatement += '1==1';
                }
            });
            statement = replacedStatement.replace(/OR 1==1/g, '').replace(/AND 1==1/g, '');
        }

        return statement;
    }

    private debugMessage(message: string, data?: any) {
        // tslint:disable-next-line:no-console
        console.log(message, data ? data : '');
    }

    private getGeohashRange(
        latitude: number,
        longitude: number,
        distance: number, // miles
    ) {
        const lat = 0.0144927536231884; // degrees latitude per mile
        const lon = 0.0181818181818182; // degrees longitude per mile

        const lowerLat = latitude - lat * distance;
        const lowerLon = longitude - lon * distance;

        const upperLat = latitude + lat * distance;
        const upperLon = longitude + lon * distance;

        const lower = geohash.encode(lowerLat, lowerLon);
        const upper = geohash.encode(upperLat, upperLon);

        return {
            lower,
            upper,
        };
    }

    private getPath(): string {
        if (!this.options || !this.options.parent) {
            return this.repository.getClassName() + '/data/' + this.repository.getClassName().toLowerCase() + 's';
        }

        let path = '';

        this.options.parent.forEach((p: IParentConnection) => {
            const parentClassName = p.modelName.toUpperCase().substr(0, 1) + p.modelName.toLowerCase().substr(1);
            path += parentClassName + '/data/' + parentClassName.toLowerCase() + 's' + '/';
            path += p.documentId + '/';
            path += this.repository.getClassName() + '/data/' + this.repository.getClassName().toLowerCase() + 's';
        });

        return path;
    }

    private getParentDocumentPath(): string {
        const pathSegments = this.getPath().split('/');
        return pathSegments.slice(0, pathSegments.length - 3).join('/');
    }
}
