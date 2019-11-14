import * as firesql from 'firesql/firesql.umd.js';
import 'firesql/rx';
import {GeoFireClient, toGeoJSON} from 'geofirex';
import * as geofirex from 'geofirex';
import {Guid} from 'guid-typescript';
import {BehaviorSubject, Observable} from 'rxjs';
import {GeoStatusEnum, IEntity, Repository} from '../Repository';
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

export interface IConnectionFirestore {
    parent?: IParentConnection[];
    dataMode?: ConnectionFirestoreDataMode;
    realtimeMode?: boolean;
    nearBy?: {
        long: BehaviorSubject<number>;
        lat: BehaviorSubject<number>;
        radius: BehaviorSubject<number>;
    };
}

export class FirestoreConnector<T> extends AbstractConnector<T> {
    public readonly options: IConnectionFirestore;
    private readonly db: Firestore;
    private readonly dataMode: ConnectionFirestoreDataMode = 'ALL';
    private readonly realtimeMode: boolean = true;
    private readonly geoFireClient: GeoFireClient;
    private currentUser: User = {uid: null};
    private currentUser$: BehaviorSubject<User> = new BehaviorSubject<User>({uid: null});
    private firesSQL: any;
    private lastSql: string = '';
    private rxQuerySubscriber: any;
    private rxQuerySubscriberGeoLocation: any;
    private lastLat: number = 0;
    private lastLong: number = 0;
    private lastRadius: number = 0;
    private observers: any[] = [];

    constructor(repository: Repository<T>, db: Firestore, options?: IConnectionFirestore) {
        super(repository, options);

        this.options = options ? options : {};

        if (this.options.dataMode) {
            this.dataMode = this.options.dataMode;
        }

        if (this.options.realtimeMode === false) {
            this.realtimeMode = false;
        }

        /* istanbul ignore next */
        this.db = (db as any).firestore ? (db as any).firestore : (db as any);
        const app = (this.db as any).app;
        this.firesSQL = new firesql.FireSQL(this.db);
        this.geoFireClient = geofirex.init((this.db as any).app.firebase_);

        if (typeof app.auth === 'function') {
            app.auth().onAuthStateChanged((state: any) => {
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

    public add(items: Array<IEntity<T>>) {
        items.forEach((item: any) => {
            const data = item._toPlain();

            if (data['__latitude'] !== undefined && data['__longitude'] !== undefined) {
                data['__location'] = this.getGeoPoint(data['__latitude'], data['__longitude']).data;
                delete data['__latitude'];
                delete data['__longitude'];
            }

            data['__uuid'] = item['__uuid'];
            data['__owner'] = {};

            if (this.currentUser.uid && this.currentUser.uid !== 'null') {
                data['__owner'][this.currentUser.uid] = true;
            }

            if (this.dataMode !== 'PRIVATE') {
                data['__owner']['EVERYBODY'] = true;
            }

            const docReference = (this.db as any).doc(this.getPath() + '/' + item.__uuid);
            
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

    public update(items: Array<IEntity<T>>) {
        this.add(items);

        return;
    }

    public remove(items: Array<IEntity<T>>) {
        items.forEach((item: any) => {
            const docReference = (this.db as any).doc(this.getPath() + '/' + item.__uuid);

            docReference
                .delete()
                .then()
                .catch(e => {
                    throw new Error(
                        'error while creating firestore document "' + this.getPath() + '/' + item.__uuid + '": ' + e.message,
                    );
                });
        });

        return;
    }

    public select(sql: string) {
        if (this.options.nearBy) {
            this.observeGeoLocation();
            return;
        }

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
        if (this.rxQuerySubscriberGeoLocation) {
            this.rxQuerySubscriberGeoLocation.unsubscribe();
        }
        if (this.observers.length) {
            this.observers.forEach((o: any) => {
                if (typeof o.unsubscribe === 'function') {
                    o.unsubscribe();
                }
            });
        }
    }

    /**
     *
     *
     * @param latitude
     * @param longitude
     */
    private getGeoPoint(latitude: number, longitude: number): geofirex.GeoFirePoint {
        return this.geoFireClient.point(latitude, longitude);
    }

    private getCurrentGeoPoint(): geofirex.GeoFirePoint | null {
        if (
            this.options.nearBy &&
            this.options.nearBy.lat.getValue() >= -90 &&
            this.options.nearBy.lat.getValue() <= 90 &&
            this.options.nearBy.long.getValue() >= -180 &&
            this.options.nearBy.long.getValue() <= 180
        ) {
            return this.geoFireClient.point(this.options.nearBy.lat.getValue(), this.options.nearBy.long.getValue());
        }

        return null;
    }

    private observeGeoLocation() {
        if (this.options.nearBy) {
            if (
                this.lastLat &&
                this.options.nearBy.lat.getValue() &&
                this.lastLat &&
                this.options.nearBy.long.getValue() &&
                this.lastRadius &&
                this.options.nearBy.radius.getValue()
            ) {
                return;
            }

            const point = this.getCurrentGeoPoint();

            if (!point) {
                return;
            }

            if (this.rxQuerySubscriberGeoLocation) {
                this.rxQuerySubscriberGeoLocation.unsubscribe();
            }

            this.lastLat = this.options.nearBy.lat.getValue();
            this.lastLong = this.options.nearBy.long.getValue();
            this.lastRadius = this.options.nearBy.radius.getValue();

            const query = this.geoFireClient
                .collection(this.getPath(), ref => {
                    return ref.where('__owner.EVERYBODY', '==', true);
                })
                .within(point, this.options.nearBy.radius.getValue(), '__location');

            this.rxQuerySubscriberGeoLocation = query.pipe(toGeoJSON('__location', true)).subscribe((e: any) => {
                this.repository
                    .createMany(e.features.map((d: any) => d.properties), '', 'firestore')
                    .then(() => {
                        this.repository.updateGeoData(
                            e.features.map((d: any) => {
                                return {
                                    lng: d.geometry.coordinates[0],
                                    lat: d.geometry.coordinates[1],
                                    uuid: d.properties['__uuid'],
                                    bearing: d.properties['queryMetadata']['bearing'],
                                    distance: d.properties['queryMetadata']['distance'],
                                    status: GeoStatusEnum.FOUND,
                                };
                            }),
                        );
                    })
                    .catch(error => {
                        throw error;
                    });
            });
        }
    }
}
