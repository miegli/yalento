import * as firesql from 'firesql/firesql.umd.js';
import 'firesql/rx';
import {GeoFireClient, toGeoJSON} from "geofirex";
import * as geofirex from 'geofirex';
import {BehaviorSubject} from "rxjs";
import {GeoStatusEnum, IEntity, Repository} from '../Repository';
import {AbstractConnector} from './AbstractConnector';

export class Firestore {
}

export class Firebase {
}


export declare class User {
    public readonly uid: string | null;

    constructor(uid: string | null);

    public isAuthenticated(): boolean;
}

export type ConnectionFirestoreDataMode = 'PRIVATE' | 'ALL';

export interface IConnectionFirestore {
    path?: string;
    dataMode?: ConnectionFirestoreDataMode;
    realtimeMode?: boolean;
    nearBy?: {
        long: BehaviorSubject<number>;
        lat: BehaviorSubject<number>;
        radius: BehaviorSubject<number>;
    }
}

export class FirestoreConnector<T> extends AbstractConnector<T> {
    public readonly options: IConnectionFirestore;
    private readonly db: Firestore;
    private readonly currentUser: User;
    private readonly dataMode: ConnectionFirestoreDataMode = 'ALL';
    private readonly realtimeMode: boolean = true;
    private readonly geoFireClient: GeoFireClient;
    private firesSQL: any;
    private lastSql: string = '';
    private rxQuerySubscriber: any;
    private rxQuerySubscriberGeoLocation: any;

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
        if (db.constructor.name !== 'AngularFirestore') {
            this.db = (db as any).firestore();
        } else {
            this.db = (db as any).firestore;
        }

        this.geoFireClient = geofirex.init((this.db as any).app.firebase_);

        this.currentUser = (this.db as any)._credentials ? (this.db as any)._credentials.currentUser : null;
        if (!this.currentUser) {
            this.currentUser = {
                uid: 'null',
                isAuthenticated(): boolean {
                    return false;
                },
            };
        }

        this.firesSQL = new firesql.FireSQL(this.db);
    }

    public getUserUuid(): string {
        return this.currentUser.uid || 'null';
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

            data['__uuid'] = item['_uuid'];
            data['__owner'] = {};

            if (this.currentUser.uid && this.currentUser.uid !== 'null') {
                data['__owner'][this.currentUser.uid] = true;
            }

            if (this.dataMode !== 'PRIVATE') {
                data['__owner']['EVERYBODY'] = true;
            }


            (this.db as any)
                .doc(this.getPath() + '/' + item._uuid)
                .set(data, {merge: true})
                .then()
                .catch(e => {
                    throw new Error(
                        'error while creating firestore document "' + this.getPath() + '/' + item._uuid + '": ' + e.message,
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
            (this.db as any)
                .doc(this.getPath() + '/' + item._uuid)
                .delete()
                .then()
                .catch(e => {
                    throw new Error(
                        'error while creating firestore document "' + this.getPath() + '/' + item._uuid + '": ' + e.message,
                    );
                });
        });

        return;
    }

    public select(sql: string) {
        const originalSqlParts = sql.split(' WHERE ', 2);
        const finalSql = 'SELECT * FROM ' + this.getPath() + ' WHERE ' + originalSqlParts[1];

        this.observeGeoLocation();

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

        if (this.options.nearBy && this.options.nearBy.lat.getValue() >= -90 && this.options.nearBy.lat.getValue() <= 90 && this.options.nearBy.long.getValue() >= -180 && this.options.nearBy.long.getValue() <= 180) {
            return this.geoFireClient.point(this.options.nearBy.lat.getValue(), this.options.nearBy.long.getValue());
        }

        return null;

    }

    private observeGeoLocation() {

        if (this.options.nearBy) {
            const point = this.getCurrentGeoPoint();

            if (!point) {
                return;
            }

            const query = this.geoFireClient.collection(this.getPath(), ref => {
                return ref.where('__owner.EVERYBODY', '==', true);
            }).within(point, this.options.nearBy.radius.getValue(), '__location');

            this.rxQuerySubscriberGeoLocation = query.pipe(toGeoJSON('__location', true)).subscribe((e: any) => {

                this.repository.updateGeoData(e.features.map((d: any) => {
                    return {
                        geometry: d.geometry,
                        uuid: d.properties['__uuid'],
                        bearing: d.properties['queryMetadata']['bearing'],
                        distance: d.properties['queryMetadata']['distance'],
                        status: GeoStatusEnum.FOUND
                    }
                }));

            });
        }

    }
}
