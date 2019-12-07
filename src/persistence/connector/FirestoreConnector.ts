import * as firesql from 'firesql/firesql.umd.js';
import 'firesql/rx';
import { GeoFireClient, toGeoJSON } from 'geofirex';
import * as geofirex from 'geofirex';
import { Guid } from 'guid-typescript';
import { BehaviorSubject, Observable } from 'rxjs';
import { GeoStatusEnum, IEntity, Repository } from '../Repository';
import { AbstractConnector } from './AbstractConnector';

export class Firestore {}

export class Firebase {}

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
  private readonly db: Firestore;
  private readonly dataMode: ConnectionFirestoreDataMode = 'ALL';
  private readonly realtimeMode: boolean = true;
  private readonly geoFireClient: GeoFireClient;
  private readonly debug: boolean;
  private currentUser: User = { uid: null };
  private currentUser$: BehaviorSubject<User> = new BehaviorSubject<User>({ uid: null });
  private firesSQL: any;
  private lastSql: string = '';
  private rxQuerySubscriber: any;
  private rxQuerySubscriberGeoLocation: any;
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

    this.debug = !!this.options.debug;

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
      this.currentUser$.next({ uid: 'ANONYMOUS_' + Guid.create().toString() });
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

      if (this.options.nearBy !== undefined && data['__latitude'] === undefined && data['__longitude'] === undefined) {
        data['__latitude'] = this.options.nearBy.lat.getValue();
        data['__longitude'] = this.options.nearBy.long.getValue();
      }

      if (data['__latitude'] !== undefined && data['__longitude'] !== undefined) {
        data['__location'] = this.getGeoPoint(data['__latitude'], data['__longitude']).data;
        delete data['__latitude'];
        delete data['__longitude'];
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
        this.debugMessage(`firebase writes to ${this.getPath() + '/' + item.__uuid}`);
      }

      docReference
        .set(data, { merge: true })
        .then(() => {
          if (this.options.parent) {
            const references = {};
            references[this.repository.getClassName()] = {
              name: this.repository.getClassName(),
              lastUpdated: new Date(),
            };

            (this.db as any)
              .doc(this.getParentDocumentPath())
              .set({ __references: references }, { merge: true })
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

  public select(sql: string) {
    if (this.options.nearBy && this.options.nearBy.radius.getValue() > 0) {
      this.observeGeoLocation();
      return;
    }

    const originalSqlParts = sql.split(' WHERE ', 2);
    const finalSql = 'SELECT * FROM ' + this.getPath() + ' WHERE ' + this.replaceSql(originalSqlParts[1]);

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

    if (this.debug) {
      this.debugMessage(`firebase disconnected`);
    }
  }

  /**
   * replace some statements that are working with firebase
   * @param sql
   */
  private replaceSql(sql: string): string {
    let statement = sql;

    statement = statement.replace(new RegExp(/'(.*)' IN \(([^)]*)\)/, 'gm'), '`$2.$1`');

    return statement;
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
      const point = this.getCurrentGeoPoint();
      if (!point) {
        return;
      }

      if (this.rxQuerySubscriberGeoLocation) {
        this.rxQuerySubscriberGeoLocation.unsubscribe();
      }

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

  private debugMessage(message: string) {
    // tslint:disable-next-line:no-console
    console.log(message);
  }
}
