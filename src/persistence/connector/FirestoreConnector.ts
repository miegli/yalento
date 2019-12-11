import * as firesql from 'firesql/firesql.umd.js';
import 'firesql/rx';
import { GeoFireClient, toGeoJSON } from 'geofirex';
import * as geofirex from 'geofirex';
import { Guid } from 'guid-typescript';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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
  private db: Firestore;
  private app: any;
  private readonly dataMode: ConnectionFirestoreDataMode = 'ALL';
  private readonly realtimeMode: boolean = true;
  private geoFireClient: GeoFireClient;
  private geoFireClientExecutor: any;
  private geoFireClientExecutorApp: any;
  private geoFireClientExecutorFirestore: any;
  private readonly debug: boolean;
  private currentUser: User = { uid: null };
  private currentUser$: BehaviorSubject<User> = new BehaviorSubject<User>({ uid: null });
  private firesSQL: any;
  private lastSql: string = '';
  private rxQuerySubscriber: any;
  private rxQuerySubscriberGeoLocation: any;
  private rxQuerySubscriberGeoLocationQuery: any;
  private rxQuerySubscriberGeoLocationQueryDestroy$: Subject<boolean> = new Subject<boolean>();
  private observers: any[] = [];
  private lastGeoHash: any = '';

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
    this.app = (this.db as any).app;
    this.firesSQL = new firesql.FireSQL(this.db);
    this.geoFireClient = geofirex.init((this.db as any).app.firebase_);

    if (typeof this.app.auth === 'function') {
      this.app.auth().onAuthStateChanged((state: any) => {
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
    this.initializeFirestore();

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
    this.initializeFirestore();

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
    if (this.options.nearBy && this.options.nearBy.radius.getValue() > 0) {
      this.observeGeoLocation().then();
      return;
    }

    const originalSqlParts = sql.split(' WHERE ', 2);
    const finalSql = 'SELECT * FROM ' + this.getPath() + ' WHERE ' + this.replaceSql(originalSqlParts[1]);

    if (this.lastSql !== finalSql) {
      if (this.realtimeMode) {
        const data$ = this.firesSQL.rxQuery(finalSql);

        if (this.rxQuerySubscriber) {
          await this.terminateFirestore();
          this.rxQuerySubscriber.unsubscribe();
        }

        if (this.debug) {
          this.debugMessage(`firebase subscribes to ${finalSql}`);
        }

        await this.initializeFirestore();

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

  public async disconnect() {
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

  public selectOneByIdentifier(identifier: string): Promise<any> {
    return new Promise(resolve => {
      this.initializeFirestore();

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

  private async observeGeoLocation() {
    if (this.options.nearBy) {
      const point = this.getCurrentGeoPoint();
      if (!point) {
        return;
      }

      if (
        JSON.stringify([point.latitude, point.longitude, this.options.nearBy.radius.getValue()]) === this.lastGeoHash
      ) {
        return;
      }

      this.lastGeoHash = JSON.stringify([point.latitude, point.longitude, this.options.nearBy.radius.getValue()]);

      if (this.rxQuerySubscriberGeoLocation) {
        this.rxQuerySubscriberGeoLocation.unsubscribe();
      }

      if (this.geoFireClientExecutorApp) {
        this.rxQuerySubscriberGeoLocationQueryDestroy$.next(true);
        await this.geoFireClientExecutorFirestore.terminate();
      } else {
        this.geoFireClientExecutorApp = (this.db as any).app.firebase_.initializeApp(
          this.app.options,
          'geoFireClientExecutor',
        ) as any;
      }

      this.geoFireClientExecutorFirestore = this.geoFireClientExecutorApp.firestore();
      this.geoFireClientExecutor = geofirex.init(this.geoFireClientExecutorApp);
      this.rxQuerySubscriberGeoLocationQueryDestroy$ = new Subject<boolean>();

      const collectionRef = this.geoFireClientExecutor.collection(this.getPath(), ref => {
        return ref.where('__owner.EVERYBODY', '==', true);
      });

      this.rxQuerySubscriberGeoLocationQuery = collectionRef.within(
        point,
        this.options.nearBy.radius.getValue(),
        '__location',
      );

      this.rxQuerySubscriberGeoLocation = this.rxQuerySubscriberGeoLocationQuery
        .pipe(
          takeUntil(this.rxQuerySubscriberGeoLocationQueryDestroy$),
          toGeoJSON('__location', true),
        )
        .subscribe((e: any) => {
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

  private async terminateFirestore() {
    return new Promise(async resolve => {
      await (this.db as any).waitForPendingWrites();

      (this.db as any)
        .terminate()
        .then(() => {
          resolve();
        })
        .catch(() => {
          resolve();
        });
    });
  }

  private async initializeFirestore() {
    if ((this.db as any)._isTerminated) {
      if (this.geoFireClientExecutorApp) {
        this.db = this.geoFireClientExecutorApp.firestore();
      } else {
        (this.app as any).firestore();
      }
    }
  }

  private debugMessage(message: string) {
    // tslint:disable-next-line:no-console
    console.log(message);
  }
}
