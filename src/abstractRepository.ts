import { Guid } from 'guid-typescript';
import { BehaviorSubject, Observable, Observer } from 'rxjs';
import { Md5 } from 'ts-md5';
import { AbstractModel, IModelProperty } from './abstractModel';

export interface IWhere {
    property: string;
    operation?: '<' | '<=' | '==' | '>=' | '>' | 'array-contains';
    value:
        | string
        | number
        | boolean
        | Observable<string | number | boolean>
        | BehaviorSubject<string | number | boolean>
        | any;
}

export interface IQuery {
    path?: string;
    identifier?: string;
    orderBy?: string | Observable<string> | BehaviorSubject<string> | any;
    where?: IWhere[];
    limit?: number | Observable<number> | BehaviorSubject<number> | any;
    offset?: number | Observable<number> | BehaviorSubject<number> | any;
}

export interface ISubscribeUntil {
    until: 'count' | 'timeout';
    value: number;
}

export interface IStatus {
    isWorking?: boolean;
    target?: AbstractModel | any | string;
    identifier?: string;
    action?:
        | 'update'
        | 'add'
        | 'remove'
        | 'move'
        | 'changeIndex'
        | 'removeAll'
        | 'subscriptionClosedAfterTimeoutOrMaxCount';
    error?: any;
    external?: boolean;
}

/**
 *
 */
export abstract class AbstractRepository {
    public status$: BehaviorSubject<IStatus> = new BehaviorSubject({});
    public path: string = '/undefined';
    public model: any | AbstractModel;
    public isSelectedAll$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    public hasSelected$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    private isReady$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    private _findAllTemporaryArray: any = { reference: {}, result: [], hashes: {}, tmp: {} };
    private _isSelected: any = {};
    private _count: number = 0;
    private _pageIndex: BehaviorSubject<number> = new BehaviorSubject<number>(0);
    private firestore: any;
    private _lastAddedIndex = 0;
    private _modelHashes: any = {};
    private _modelReferences: any = {};
    private parentModel: any = {};
    private jsonData: any = null;
    private instanceName: string = '';
    private isStateIsSynchronizing: boolean = false;
    private _statePropertiesFromInvoker: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
    private _initialStateFromStateProperties: any = {};
    private invoker: any = null;

    /**
     * construct repository with AngularFire.Firestore or Firebase.Firestore argument
     * @param firestore
     */
    constructor(firestore?: any) {

        if (firestore && firestore !== undefined && firestore.getRepository !== undefined && firestore.getRepository()) {
            this.setFirestore(firestore.getRepository().getFirestore());
        } else {
            if (firestore && firestore._settings && firestore._projectId === undefined) {
                throw new Error(
                    'firestore projectId was not set. Please set env variable GOOGLE_APPLICATION_CREDENTIALS=your-service-account.json',
                );
            }
            this.setFirestore(firestore);
        }

        if (this.constructor.name !== 'AbstractRepository' && this.constructor.name.substr(-10) === 'Repository') {
            this.path = this.constructor.name.substr(0, this.constructor.name.length - 10).toLowerCase();
        }

    }


    /**
     * create repository instance
     * @param invoker
     */
    public createInstance(invoker: any) {

        // @ts-ignore
        const instance = new this.constructor(this.firestore);
        instance.synchronizeState(invoker);
        instance.setInvoker(invoker);

        return instance;

    }


    /**
     * toggle selected state of model from current query result
     * @param model
     */
    public toggleSelection(model?: AbstractModel): void {

        if (model) {
            this._isSelected[model.getIdentifier()] = !this._isSelected[model.getIdentifier()];
            model._isSelected = !model._isSelected;
        }

        if (!model) {
            if (this.isSelectedAll$.getValue()) {
                this._isSelected = {};
            } else {
                Object.keys(this._findAllTemporaryArray['tmp']).forEach(key => {
                    if (this._findAllTemporaryArray['reference'][key] === undefined) {
                        const data = this._findAllTemporaryArray['tmp'][key];
                        this.initModelFromData(data, key);
                    }
                    this._findAllTemporaryArray['reference'][key]['_isSelected'] = false;
                });

                Object.keys(this._findAllTemporaryArray['reference']).forEach(key => {
                    this._isSelected[key] = true;
                    this._findAllTemporaryArray['reference'][key]['_isSelected'] = true;
                });
            }
        }

        this.updateIsSelectedAll();
    }

    /**
     * return all model from current result with selected state
     */
    public getSelected(): AbstractModel[] | any {
        const selected: any[] = [];

        if (!this._isSelected) {
            return selected;
        }

        Object.keys(this._isSelected).forEach(key => {
            if (this._isSelected[key] === true && this._findAllTemporaryArray['reference'][key]) {
                selected.push(this._findAllTemporaryArray['reference'][key]);
            }
        });

        return selected;
    }

    /**
     * connect repository with given model
     * @param model
     */
    public setModel(model: any) {
        this.model = model;
        return this;
    }

    /**
     * connect repository with given parent model
     * @param model
     */
    public setParentModel(model: any): AbstractRepository {
        this.parentModel = model;
        return this;
    }

    /**
     * get parent model of this repository
     */
    public getParentModel(): any {
        return this.parentModel;
    }

    /**
     * set firestore (AngularFire.Firestore or Firebase.Firestore)
     * @param firestore
     */
    public setFirestore(firestore: any): AbstractRepository {
        this.firestore = firestore;
        return this;
    }

    /**
     * get firestore (AngularFire.Firestore or Firebase.Firestore)
     */
    public getFirestore(): any {
        return this.firestore;
    }

    /**
     * get firestore batch (AngularFire.Firestore or Firebase.Firestore)
     */
    public getFirestoreBatch(): any {
        return this.firestore.firestore.batch();
    }

    /**
     * set firestore document root path
     * @param path
     */
    public setPath(path: string): AbstractRepository {
        this.path = path;
        return this;
    }

    /**
     * get firestore document root path
     */
    public getPath(): string {
        return this.path;
    }

    /**
     * persist changes from model to repository
     * @param item
     * @param data
     */
    public update(item?: AbstractModel, data?: any): Promise<AbstractModel | any> {
        return new Promise<any>((resolve, reject) => {
            if (!item) {
                const updateAll: any[] = [];

                this.getModelReferences().forEach((model: AbstractModel) => {
                    const currentHash = this.getHash(this.getDataFromModel(model));
                    if (currentHash !== this._modelHashes[model.getIdentifier()]) {
                        updateAll.push(model.save());
                    }
                });

                Promise.all(updateAll)
                    .then(() => {
                        resolve(this.getModelReferences());
                    })
                    .catch(e => {
                        reject(e);
                    });
            } else {
                if (typeof this.model === 'function' && item instanceof this.model === false) {
                    reject(
                        'repository accepts only objects of ' +
                        new this.model().constructor.name +
                        '. ' +
                        item.constructor.name +
                        ' given',
                    );
                    return;
                }

                if (typeof item.getRepository().getFirestore() === 'undefined') {
                    item._init(this);
                }

                const statusTimeout = setTimeout(() => {
                    this.status$.next({
                        isWorking: true,
                        target: item,
                        identifier: item.getIdentifier(),
                        action: 'update',
                    });
                }, 500);

                const updateData: any = data === undefined ? {} : data;
                const promises: any = [];
                updateData['_identifier'] = item.getIdentifier();

                if (data === undefined) {
                    data = {};
                    data['_identifier'] = item.getIdentifier();
                    item
                        .getProperties()
                        .then((properties: IModelProperty[]) => {
                            properties.forEach((property: IModelProperty) => {
                                if (property.type === 'relation') {
                                    property.value.forEach((res: any) => {
                                        if (typeof res.getRepository !== 'undefined') {
                                            promises.push(res.getRepository().update(res));
                                        }
                                    });
                                } else if (property.type === 'relationOneToOne') {
                                    if (typeof property.value.getRepository !== 'undefined') {
                                        promises.push(
                                            new Promise(res => {
                                                const status$ =
                                                    property.value.getRepository().getParentModel() &&
                                                    property.value.getRepository().getParentModel()['_repository']
                                                        ? property.value.getRepository().getParentModel()['_repository'].status$
                                                        : this.status$;

                                                const statusTimeoutOneToOne = setTimeout(() => {
                                                    this.status$.next({
                                                        isWorking: true,
                                                        target: property.value,
                                                        identifier: property.value.getIdentifier(),
                                                        action: 'update',
                                                    });
                                                }, 500);

                                                property.value
                                                    .getRepository()
                                                    .update(property.value)
                                                    .then(() => {
                                                        clearTimeout(statusTimeoutOneToOne);
                                                        status$.next({
                                                            isWorking: false,
                                                            target: property.value,
                                                            identifier: property.value.getIdentifier(),
                                                            action: 'update',
                                                        });
                                                        res();
                                                    });
                                            }),
                                        );
                                    }
                                } else {
                                    updateData[property.key] = property.value;
                                }
                            });
                            if (this._modelHashes[item.getIdentifier()] !== this.getHash(updateData)) {
                                const path =
                                    item.getRepository() &&
                                    item.getRepository().getPath() &&
                                    item.getRepository().getPath() !== '/undefined'
                                        ? item.getRepository().getPath()
                                        : this.getPath();

                                if (item.getRepository() && item.getRepository().getFirestore() === undefined) {
                                    // init model if not done yet
                                    item.getRepository().setPath(this.getPath());
                                    item._init(this, item, item.getIdentifier());
                                }

                                if (this._modelHashes[item.getIdentifier()] === undefined) {
                                    promises.push(this.firestore.doc(path + '/' + item.getIdentifier()).set(updateData));
                                } else {
                                    promises.push(this.firestore.doc(path + '/' + item.getIdentifier()).update(updateData));
                                }
                            }

                            Promise.all(promises)
                                .then(() => {
                                    clearTimeout(statusTimeout);
                                    resolve(item);
                                })
                                .catch((e: any) => {
                                    clearTimeout(statusTimeout);
                                    reject(e);
                                });
                        })
                        .catch((e: any) => {
                            reject(e);
                        });
                } else {
                    const path =
                        item.getRepository() && item.getRepository().getPath() ? item.getRepository().getPath() : this.getPath();
                    this.firestore
                        .doc(path + '/' + item.getIdentifier())
                        .update(data)
                        .then(() => {
                            item.setChanges(false);
                            resolve(item);
                        })
                        .catch((e: any) => {
                            reject(e);
                        });
                }
            }
        });
    }

    /**
     * set ordering index
     * @param item
     * @param indexOrNextItem
     */
    public setIndex(
        item: AbstractModel | string,
        indexOrNextItem?: AbstractModel | number | string | null,
    ): Observable<boolean> {
        const self = this;
        const identifier: string = typeof item === 'string' ? item : item.getIdentifier();
        const model: AbstractModel = self._findAllTemporaryArray
            ? self._findAllTemporaryArray['reference'][identifier]
            : null;

        return new Observable((observer: Observer<any>) => {
            const repo = typeof item !== 'string' && item.getRepository() ? item.getRepository() : this;

            const statusTimeout = setTimeout(() => {
                this.status$.next({
                    isWorking: true,
                    target: model,
                    identifier: identifier,
                    action: 'changeIndex',
                });
            }, 500);

            const promise = new Promise(resolve => {
                const index: number = new Date().getTime();

                if (typeof indexOrNextItem === 'string') {
                    const subscriber = this._findOneByIdentifier(indexOrNextItem).subscribe((nextItem: AbstractModel | null) => {
                        if (nextItem) {
                            resolve(nextItem.getIndex() - 100);
                        } else {
                            resolve(0);
                        }
                        subscriber.unsubscribe();
                    });
                } else if (typeof indexOrNextItem === 'number') {
                    resolve(indexOrNextItem);
                } else {
                    resolve(index);
                }
            });

            promise
                .then((index: any) => {
                    if (model) {
                        model.setIndex(index);
                    }

                    repo
                        .getFirestore()
                        .doc(repo.getPath() + '/' + identifier)
                        .update({ _index: index })
                        .then(() => {
                            clearTimeout(statusTimeout);
                            this.status$.next({
                                isWorking: false,
                                target: model,
                                identifier: identifier,
                                action: 'changeIndex',
                            });
                            observer.next(true);
                        })
                        .catch((e: any) => {
                            clearTimeout(statusTimeout);
                            this.status$.next({
                                isWorking: false,
                                target: model,
                                identifier: identifier,
                                action: 'changeIndex',
                                error: e,
                            });
                            observer.error(e);
                        });
                })
                .catch();
        });
    }

    /**
     * remove all model with selected state from repository
     */
    public removeSelected(): Promise<boolean> {
        const selected = this.getSelected();

        return new Promise<boolean>((resolve, reject) => {
            if (selected.length === 0) {
                resolve();
            } else {
                this.remove(selected)
                    .then(() => {
                        resolve();
                    })
                    .catch(e => {
                        reject(e);
                    });
            }
        });
    }

    /**
     * remove one or more models from repository
     * @param item
     */
    public remove(item: AbstractModel | string | any): Promise<boolean> {
        const MAX_BATCH_SIZE = 500;

        // @ts-ignore
        if (
            typeof item !== 'string' &&
            item instanceof AbstractModel === false &&
            typeof item.length !== 'undefined' &&
            item.length > MAX_BATCH_SIZE
        ) {
            const count = item.length;
            return new Promise<boolean>((resolve, reject) => {
                const promises = [];
                for (let i = 1; i <= Math.ceil(count / MAX_BATCH_SIZE); i++) {
                    const c = i * MAX_BATCH_SIZE <= count ? MAX_BATCH_SIZE : count % MAX_BATCH_SIZE;
                    promises.push(this.remove(item.slice(MAX_BATCH_SIZE * (i - 1), MAX_BATCH_SIZE * (i - 1) + c)));
                }
                Promise.all(promises)
                    .then(() => {
                        resolve(true);
                    })
                    .catch(e => {
                        reject(e);
                    });
            });
        }

        // @ts-ignore
        if (typeof item !== 'string' && item instanceof AbstractModel === false && typeof item.length !== 'undefined') {
            return new Promise<boolean>((resolve, reject) => {
                const statusTimeout = setTimeout(() => {
                    this.status$.next({
                        isWorking: true,
                        target: item,
                        identifier: item.map((i: any) => i.getIdentifier()).join(','),
                        action: 'remove',
                    });
                }, 500);

                const repo = typeof item[0] !== 'string' && item[0].getRepository() ? item[0].getRepository() : this;

                const batch = repo.getFirestoreBatch();

                item.forEach((i: any) => {
                    const identifier = typeof i === 'string' ? i : i.getIdentifier();
                    const refs = repo
                        .getFirestore()
                        .collection(repo.getPath())
                        .doc(identifier);
                    batch.delete(refs.ref);
                });

                batch
                    .commit()
                    .then(() => {
                        clearTimeout(statusTimeout);

                        this.status$.next({
                            isWorking: false,
                            target: item,
                            identifier: item.map((i: any) => i.getIdentifier()).join(','),
                            action: 'remove',
                        });
                        resolve(true);
                    })
                    .catch((e: any) => {
                        reject(e);
                    });
            });
        }

        return new Promise<any>((resolve, reject) => {
            const identifier = typeof item === 'string' ? item : item.getIdentifier();
            const target = item ? item : new this.model().setIdentifier(identifier);

            const statusTimeout = setTimeout(() => {
                this.status$.next({
                    isWorking: true,
                    target: target,
                    identifier: identifier,
                    action: 'remove',
                });
            }, 500);

            const repo = typeof item !== 'string' && item.getRepository() ? item.getRepository() : this;

            if (typeof repo.getFirestore() === 'undefined') {
                if (typeof repo.getParentModel().removeItemFromRelationsData !== 'undefined') {
                    repo.getParentModel().removeItemFromRelationsData(identifier);
                }
                clearTimeout(statusTimeout);
                this.status$.next({
                    isWorking: false,
                    target: target,
                    identifier: identifier,
                    action: 'remove',
                });
                resolve(true);
                return;
            }

            repo
                .getFirestore()
                .doc(repo.getPath() + '/' + identifier)
                .delete()
                .then(() => {
                    clearTimeout(statusTimeout);
                    this.status$.next({
                        isWorking: false,
                        target: target,
                        identifier: identifier,
                        action: 'remove',
                    });
                    this.updateIsSelectedAll();
                    resolve(true);
                })
                .catch((e: any) => {
                    clearTimeout(statusTimeout);
                    this.status$.next({
                        isWorking: false,
                        target: target,
                        identifier: identifier,
                        action: 'remove',
                    });
                    this.updateIsSelectedAll();
                    reject(e);
                });
        });
    }

    /**
     * find one model by given identifier
     * @param identifier
     * @param watchForChanges
     * @private
     */
    public _findOneByIdentifier(identifier: string, watchForChanges?: boolean): any {
        const self = this;
        let watch: boolean;

        return new Observable((observer: Observer<any>) => {
            if (!this.firestore) {
                observer.next(null);
                observer.complete();
                return;
            }

            if (this.firestore.constructor.name === 'AngularFirestore') {
                watch = watchForChanges === undefined ? true : watchForChanges;

                if (!watch) {
                    const subscriber = this.firestore
                        .doc(this.getPath() + '/' + identifier)
                        .get()
                        .subscribe((data: any) => {
                            let model = null;
                            if (data.exists) {
                                model = this.initModelFromData(data.data(), identifier);
                            }
                            observer.next(model);
                            observer.complete();
                            subscriber.unsubscribe();
                        });
                }

                if (watch === undefined || watch) {
                    this.firestore
                        .doc(this.getPath() + '/' + identifier)
                        .valueChanges()
                        .subscribe((data: any) => {
                            let model = null;
                            if (data) {
                                model = this.initModelFromData(data, identifier);
                            }
                            observer.next(model);
                        });
                }
            }

            if (this.firestore.constructor.name !== 'AngularFirestore') {
                watch = watchForChanges === undefined ? false : watchForChanges;

                if (watch) {
                    this.firestore.doc(this.getPath() + '/' + identifier).onSnapshot(
                        (data: any) => {
                            if (!data.exists) {
                                observer.next(null);
                            } else {
                                observer.next(this.initModelFromData(data.data(), identifier));
                            }
                        },
                        (e: any) => {
                            observer.error(e);
                        },
                    );
                } else {
                    this.firestore
                        .doc(this.getPath() + '/' + identifier)
                        .get()
                        .then((data: any) => {
                            if (!data.exists) {
                                observer.next(null);
                            } else {
                                observer.next(this.initModelFromData(data.data(), identifier));
                            }
                            if (!watch) {
                                observer.complete();
                            }
                        })
                        .catch((e: any) => {
                            observer.error(e);
                        });
                }
            }
        });
    }

    /**
     * get length of current query result
     */
    public count() {
        return this._count;
    }

    /**
     * get page index of current query result
     */
    public pageIndex(): BehaviorSubject<number> {
        return this._pageIndex;
    }

    /**
     * perform query on repository
     * @param query
     * @param watch
     * @param subscribeUntil
     */
    public find(query?: IQuery, watch?: boolean, subscribeUntil?: ISubscribeUntil): any | Observable<any[]> {

        const self = this;

        return new Observable((observer: Observer<any>) => {
            this.isReady$.subscribe((ready: boolean) => {


                if (ready || !this.invoker) {

                    let path = this.getPath() + (query && query.path !== undefined ? '/' + query.path : '');

                    if (
                        query &&
                        query.path !== undefined &&
                        path.length &&
                        path.split('/').length > 1 &&
                        path.split('/').length % 2 > 0
                    ) {
                        const pathS = path.split('/');
                        path = pathS.splice(0, pathS.length - 1).join('/');
                        query.identifier = pathS[pathS.length - 1];
                    }

                    let isWatch: boolean;
                    const isAngular: boolean = this.firestore && this.firestore.constructor.name === 'AngularFirestore';
                    if (isAngular) {
                        isWatch = typeof watch === 'undefined' ? true : watch;
                    } else {
                        isWatch = typeof watch === 'undefined' ? false : watch;
                    }

                    let subscriber: any = null;
                    let subs: any = null;

                    if (isAngular) {
                        observer.next([]);
                    }

                    this.resetData();
                    let subLimit: any;
                    let subOffset: any;
                    let subOrderBy: any;
                    let lastQueryString = '';
                    const subWhere: any = {};

                    const updateResults = (q: IQuery, o: Observer<any>, isObservableWatching: boolean) => {
                        this.updateIsSelectedAll();

                        this._count = Object.keys(this._findAllTemporaryArray['tmp']).length;

                        this._findAllTemporaryArray['result'] = [];
                        let tmpResults = [];
                        if (q.limit !== undefined && q.offset !== undefined) {
                            tmpResults = Object.keys(this._findAllTemporaryArray['tmp']).slice(q.offset, q.limit + q.offset);
                        } else {
                            tmpResults = Object.keys(this._findAllTemporaryArray['tmp']);
                        }

                        if (q.offset && q.offset >= this._count) {
                            q.offset = 0;
                            if (query && query.offset && query.offset.next) {
                                query.offset.next(0);
                            }
                            if (query && query.offset && typeof query.offset === 'number') {
                                query.offset = 0;
                            }
                        }

                        if (q.limit && q.offset !== undefined) {
                            this._pageIndex.next(q.offset / q.limit)
                        }

                        tmpResults.forEach(id => {
                            const data = this._findAllTemporaryArray['tmp'][id];

                            if (this._findAllTemporaryArray['reference'][id] === undefined) {
                                this.initModelFromData(data, id);
                            } else {
                                this.updateHash(this._findAllTemporaryArray['reference'][id].setData(data));
                            }

                            this._findAllTemporaryArray['result'].push(this._findAllTemporaryArray['reference'][id]);
                        });


                        o.next(this._findAllTemporaryArray['result']);

                        if (!isObservableWatching) {
                            o.complete();
                        }
                    };

                    const resolveQuery: Observable<IQuery> = new Observable<IQuery>(observerQuery => {

                        if (!query) {
                            observerQuery.next({});
                        }

                        if (query) {

                            const getValues = () =>
                                new Promise<IQuery>(resolveValues => {
                                    const promises = [];

                                    if (query.identifier) {
                                        promises.push(
                                            new Promise(resolve => {
                                                resolve({ identifier: query.identifier });
                                            }),
                                        );
                                    }

                                    if (query.where) {
                                        query.where.forEach((w: IWhere, i: number) => {
                                            promises.push(
                                                new Promise(resolve => {
                                                    if (typeof w.value.asObservable === 'function') {
                                                        resolve({
                                                            where: {
                                                                operation: w.operation ? w.operation : '==',
                                                                property: w.property,
                                                                value: w.value.getValue(),
                                                            },
                                                        });
                                                    } else if (typeof w.value.subscribe === 'function') {
                                                        subWhere[i] = null;
                                                        subWhere[i].w.value.subscribe((v: any) => {
                                                            resolve({
                                                                where: {
                                                                    operation: w.operation ? w.operation : '==',
                                                                    property: w.property,
                                                                    value: v,
                                                                },
                                                            });
                                                            if (subWhere[i]) {
                                                                subWhere[i].unsubsribe();
                                                            }
                                                        });
                                                    } else {
                                                        resolve({
                                                            where: {
                                                                operation: w.operation ? w.operation : '==',
                                                                property: w.property,
                                                                value: w.value,
                                                            },
                                                        });
                                                    }
                                                }),
                                            );
                                        });
                                    }

                                    if (query.limit) {
                                        promises.push(
                                            new Promise(resolve => {
                                                if (typeof query.limit === 'number') {
                                                    resolve({ limit: query.limit });
                                                }

                                                if (typeof query.limit.asObservable === 'function') {
                                                    resolve({ limit: query.limit.getValue() });
                                                }

                                                if (typeof query.limit.subscribe === 'function') {
                                                    subLimit = query.limit.subscribe((limit: any) => {
                                                        resolve({ limit: limit });
                                                        if (subLimit) {
                                                            subLimit.unsubscribe();
                                                        }
                                                    });
                                                }
                                            }),
                                        );
                                    }

                                    if (query.offset) {
                                        promises.push(
                                            new Promise(resolve => {
                                                if (typeof query.offset === 'number') {
                                                    resolve({ offset: query.offset });
                                                }

                                                if (typeof query.offset.asObservable === 'function') {
                                                    resolve({ offset: query.offset.getValue() });
                                                }

                                                if (typeof query.offset.subscribe === 'function') {
                                                    subOffset = query.offset.subscribe((offset: any) => {
                                                        resolve({ offset: offset });
                                                        if (subOffset) {
                                                            subOffset.unsubscribe();
                                                        }
                                                    });
                                                }
                                            }),
                                        );
                                    }

                                    if (query.orderBy) {
                                        promises.push(
                                            new Promise(resolve => {
                                                if (typeof query.orderBy === 'string') {
                                                    resolve({ orderBy: query.orderBy });
                                                }

                                                if (typeof query.orderBy.asObservable === 'function') {
                                                    resolve({ orderBy: query.orderBy.getValue() });
                                                }

                                                if (typeof query.orderBy.subscribe === 'function') {
                                                    subOrderBy = query.orderBy.subscribe((orderBy: any) => {
                                                        resolve({ orderBy: orderBy });
                                                        if (subOrderBy) {
                                                            subOrderBy.unsubscribe();
                                                        }
                                                    });
                                                }
                                            }),
                                        );
                                    }

                                    Promise.all(promises).then((data: any) => {
                                        const q: IQuery = { limit: 0, where: [] };

                                        data.forEach((d: any) => {
                                            if (d.limit !== undefined) {
                                                q.limit = d.limit;
                                            }
                                            if (d.offset !== undefined) {
                                                q.offset = d.offset;
                                            }
                                            if (d.where && q.where) {
                                                q.where.push(d.where);
                                            }
                                            if (d.orderBy !== undefined) {
                                                q.orderBy = d.orderBy;
                                            }
                                            if (d.identifier !== undefined) {
                                                q.identifier = d.identifier;
                                            }
                                        });

                                        resolveValues(q);
                                    });
                                });

                            const changeDetection = new Observable(changeObserver => {

                                if (query.limit) {
                                    if (typeof query.limit.asObservable === 'function') {
                                        query.limit.asObservable().subscribe(() => {
                                            changeObserver.next();
                                        });
                                    } else if (typeof query.limit.subscribe === 'function') {
                                        query.limit.subscribe(() => {
                                            changeObserver.next();
                                        });
                                    } else {
                                        changeObserver.next();
                                    }
                                }

                                if (query.offset) {
                                    if (typeof query.offset.asObservable === 'function') {
                                        query.offset.asObservable().subscribe((offset: number) => {
                                            getValues().then((value: IQuery) => {
                                                applyQuery(value);
                                            });
                                        });
                                    } else if (typeof query.offset.subscribe === 'function') {
                                        query.offset.subscribe((offset: number) => {
                                            getValues().then((value: IQuery) => {
                                                applyQuery(value);
                                            });
                                        });
                                    } else {
                                        applyQuery(query.offset);
                                    }
                                }

                                if (query.orderBy) {
                                    if (typeof query.orderBy.asObservable === 'function') {
                                        query.orderBy.asObservable().subscribe(() => {
                                            changeObserver.next();
                                        });
                                    } else if (typeof query.orderBy.subscribe === 'function') {
                                        query.orderBy.subscribe(() => {
                                            changeObserver.next();
                                        });
                                    } else {
                                        changeObserver.next();
                                    }
                                }

                                if (query.where) {
                                    query.where.forEach((w: IWhere) => {

                                        if (typeof w.value.asObservable === 'function') {
                                            w.value.asObservable().subscribe(() => {
                                                changeObserver.next();
                                            });
                                        } else if (typeof w.value.subscribe === 'function') {
                                            w.value.subscribe(() => {
                                                changeObserver.next();
                                            });
                                        } else {
                                            changeObserver.next();
                                        }
                                    });
                                }

                                if (query.identifier) {
                                    changeObserver.next();
                                }

                                if (query.path) {
                                    changeObserver.next();
                                }

                            });

                            let appliedQuery: any = null;
                            let timeout: any = null;

                            const applyQuery = (q1: IQuery) => {
                                appliedQuery = q1;
                                if (timeout) {
                                    clearTimeout(timeout);
                                }
                                timeout = setTimeout(() => {
                                    if (JSON.stringify(appliedQuery) !== lastQueryString) {
                                        observerQuery.next(appliedQuery);
                                    }
                                    lastQueryString = JSON.stringify(appliedQuery);
                                }, 10);
                            };

                            changeDetection.subscribe(() => {
                                getValues().then((value: IQuery) => {
                                    applyQuery(value);
                                });
                            });
                        }
                    });

                    resolveQuery.subscribe((q: IQuery) => {

                        if (!q.orderBy && this.getPath().lastIndexOf('/') <= 0) {
                            q.orderBy = '_index';
                        }

                        if (q && q.identifier !== undefined) {
                            this._findOneByIdentifier(q.identifier, isWatch).subscribe((model: AbstractModel) => {
                                this.resetData();
                                if (model) {
                                    this._findAllTemporaryArray['reference'][model.getIdentifier()] = model;
                                    this._findAllTemporaryArray['tmp'][model.getIdentifier()] = this.getDataFromModel(model);
                                }
                                updateResults(q, observer, isWatch);
                            });
                        } else {
                            if (!this.firestore) {
                                observer.next([]);
                                observer.complete();
                                return;
                            }

                            if (this.firestore.constructor.name === 'AngularFirestore') {

                                subscriber = this.firestore
                                    .collection(path, (reference: any) => {
                                        let ref = reference;

                                        if (q.orderBy) {
                                            ref = ref.orderBy(q.orderBy);
                                        }

                                        if (q.limit && q.offset === undefined) {
                                            ref = ref.limit(q.limit);
                                        }

                                        const refs = [ref];

                                        if (q.where) {
                                            q.where.forEach((w: IWhere) => {
                                                refs.push(refs[refs.length - 1].where(w.property, w.operation ? w.operation : '==', w.value));
                                            });
                                        }

                                        return refs[refs.length - 1];
                                    })
                                    .stateChanges()
                                    .subscribe((results: any) => {
                                        results.forEach((data: any) => {
                                            switch (data.type) {
                                                case 'added':
                                                    this._findAllTemporaryArray['tmp'][data.payload.doc.id] = data.payload.doc.data();
                                                    break;
                                                case 'modified':
                                                    this._findAllTemporaryArray['tmp'][data.payload.doc.id] = data.payload.doc.data();
                                                    if (this._findAllTemporaryArray['reference'][data.payload.doc.id] === undefined) {
                                                        this.initModelFromData(data.payload.doc.data(), data.payload.doc.id);
                                                    } else {
                                                        this.updateHash(
                                                            this._findAllTemporaryArray['reference'][data.payload.doc.id].setData(
                                                                data.payload.doc.data(),
                                                            ),
                                                        );
                                                    }
                                                    break;
                                                case 'removed':
                                                    if (this._findAllTemporaryArray['reference'][data.payload.doc.id]) {
                                                        delete this._findAllTemporaryArray['reference'][data.payload.doc.id];
                                                    }
                                                    if (this._findAllTemporaryArray['tmp'][data.payload.doc.id]) {
                                                        delete this._findAllTemporaryArray['tmp'][data.payload.doc.id];
                                                    }
                                                    break;
                                            }
                                        });

                                        updateResults(q, observer, isWatch);
                                    });

                                if (isWatch && subscribeUntil && subscribeUntil.until === 'timeout') {
                                    setTimeout(() => {
                                        observer.complete();
                                        subscriber.unsubscribe();
                                    }, subscribeUntil.value);
                                }
                            }

                            if (this.firestore.constructor.name !== 'AngularFirestore') {

                                let ref = this.firestore.collection(path);

                                if (q.orderBy) {
                                    ref = ref.orderBy(q.orderBy);
                                }

                                if (q.limit && q.offset === undefined) {
                                    ref = ref.limit(q.limit);
                                }

                                if (q.where) {
                                    q.where.forEach((w: IWhere) => {
                                        ref = ref.where(w.property, w.operation ? w.operation : '==', w.value);
                                    });
                                }

                                if (subs) {
                                    subs();
                                }
                                subs = ref.onSnapshot(
                                    (querySnapshot: any) => {
                                        querySnapshot.forEach((doc: any) => {
                                            this._findAllTemporaryArray['tmp'][doc.id] = doc.data();
                                        });
                                        updateResults(q, observer, isWatch);
                                    },
                                    (e: any) => {
                                        observer.error(e);
                                        observer.complete();
                                        subs();
                                    },
                                );

                                if (isWatch && subscribeUntil && subscribeUntil.until === 'timeout') {
                                    setTimeout(() => {
                                        observer.complete();
                                        subs();
                                        this.status$.next({
                                            isWorking: false,
                                            target: self,
                                            action: 'subscriptionClosedAfterTimeoutOrMaxCount',
                                        });
                                    }, subscribeUntil.value);
                                }

                            }
                        }

                    });
                }
            });
        });
    }

    public addMultiple(count: number, data?: { [key: string]: any }): Promise<boolean> {
        const MAX_BATCH_SIZE = 500;

        if (count > MAX_BATCH_SIZE) {
            return new Promise<boolean>((resolve, reject) => {
                const promises = [];
                for (let i = 1; i <= Math.ceil(count / MAX_BATCH_SIZE); i++) {
                    const c = i * MAX_BATCH_SIZE <= count ? MAX_BATCH_SIZE : count % MAX_BATCH_SIZE;
                    promises.push(this.addMultiple(c, data));
                }

                Promise.all(promises)
                    .then(() => {
                        resolve(true);
                    })
                    .catch(e => {
                        reject(e);
                    });
            });
        }

        return new Promise<boolean>((resolve, reject) => {
            const batch = this.getFirestoreBatch();

            const statusTimeout = setTimeout(() => {
                this.status$.next({
                    isWorking: true,
                    action: 'add',
                });
            }, 500);

            for (let i = 0; i < count; i++) {
                const identifier = Guid.create().toString();
                const targetModel = new this.model();
                targetModel.setIdentifier(identifier);
                const initialData = this.getDataFromModel(targetModel);
                initialData['_index'] = new Date().getTime() + this._lastAddedIndex * 100;
                initialData['_identifier'] = identifier;

                if (data !== undefined) {
                    Object.keys(data).forEach(key => {
                        // @ts-ignore
                        initialData[key] = data[key];
                    });
                }

                const refs = this.getFirestore()
                    .collection(this.getPath())
                    .doc(identifier);
                batch.set(refs.ref, initialData);
            }

            batch
                .commit()
                .then(() => {
                    clearTimeout(statusTimeout);
                    this.status$.next({
                        isWorking: false,
                        action: 'add',
                    });
                    resolve(true);
                })
                .catch((e: any) => {
                    reject(e);
                });
        });
    }

    /**
     * add new model, persist it to repository and return newly created model
     * @param data
     * @param newIdentifier
     * @param targetRelation
     * @param parentModel
     */
    public add(
        data?: { [key: string]: any },
        newIdentifier?: string,
        targetRelation?: string,
        parentModel?: any,
    ): Promise<any> {
        return new Promise(async (resolve, reject) => {
            const self = this;
            const identifier =
                newIdentifier === undefined || newIdentifier === null ? Guid.create().toString() : newIdentifier;
            const targetModel = new this.model();
            targetModel.setIdentifier(identifier);
            const initialData = this.getDataFromModel(targetModel);

            const statusTimeout = setTimeout(() => {
                this.status$.next({
                    isWorking: true,
                    action: 'add',
                });
            }, 500);

            if (data !== undefined) {
                Object.keys(data).forEach(key => {
                    // @ts-ignore
                    initialData[key] = data[key];
                });
            }

            // @ts-ignore
            this._lastAddedIndex = this._lastAddedIndex + 1;
            initialData['_index'] = new Date().getTime() + this._lastAddedIndex * 100;
            initialData['_identifier'] = identifier;

            if (!this.firestore) {
                const tmpModel = new this.model().setIdentifier(identifier);
                tmpModel._init(tmpModel.getRepository(), data, identifier);

                if (targetRelation && parentModel) {
                    parentModel.setRelationsRepo(targetRelation, tmpModel.getRepository());
                    parentModel.setRelationName(targetRelation);
                    parentModel.setRelationData([tmpModel, ...parentModel.getRelationData(targetRelation)]);
                    tmpModel.getRepository().setParentModel(parentModel);
                }

                resolve(tmpModel);
                clearTimeout(statusTimeout);
                this.status$.next({
                    isWorking: false,
                    target: tmpModel,
                    identifier: identifier,
                    action: 'add',
                });
                return;
            }

            this.firestore
                .collection(this.getPath())
                .doc(identifier)
                .set(initialData)
                .then(() => {
                    const model = new self.model()._init(self, initialData, identifier);
                    this.updateHash(model);

                    if (!this._findAllTemporaryArray) {
                        this.resetData();
                    }
                    this._findAllTemporaryArray['reference'][identifier] = model;
                    resolve(this._findAllTemporaryArray['reference'][identifier]);
                })
                .catch((e: any) => {
                    reject(e);
                    clearTimeout(statusTimeout);
                    this.status$.next({
                        isWorking: false,
                        target: targetModel,
                        identifier: identifier,
                        action: 'add',
                        error: e,
                    });
                });
        });
    }

    /**
     * get logger
     * @param filter
     */
    public getLogger(filter?: IStatus): Observable<IStatus> {
        return new Observable((observer: Observer<IStatus>) => {
            this.status$.subscribe((s: IStatus) => {
                if (filter === undefined) {
                    observer.next(s);
                } else {
                    let match = true;

                    if (match && filter.error !== undefined && s.error === undefined) {
                        match = false;
                    }

                    if (match && filter.isWorking !== undefined && filter.isWorking !== s.isWorking) {
                        match = false;
                    }

                    if (match && filter.identifier !== undefined && filter.identifier !== s.identifier) {
                        match = false;
                    }

                    if (match && filter.action !== undefined && filter.action !== s.action) {
                        match = false;
                    }

                    if (match && filter.external !== undefined && filter.external !== s.external) {
                        match = false;
                    }

                    if (
                        match &&
                        filter.target !== undefined &&
                        filter.target &&
                        typeof filter.target === 'object' &&
                        filter.target.constructor &&
                        s.target &&
                        s.target.constructor &&
                        filter.target.constructor.name !== s.target.constructor.name
                    ) {
                        match = false;
                    }

                    if (
                        match &&
                        filter.target !== undefined &&
                        typeof filter.target === 'string' &&
                        s.target &&
                        s.target.constructor &&
                        filter.target !== s.target.constructor.name
                    ) {
                        match = false;
                    }

                    if (match) {
                        Object.keys(filter).forEach((key: any) => {
                            // @ts-ignore
                            if (match && s[key] === undefined) {
                                match = false;
                            }
                        });
                    }

                    if (match) {
                        observer.next(s);
                    }
                }
            });
        });
    }

    /**
     * perform query operation and return json of result
     * @param query
     */
    public toJson(query?: IQuery): Promise<any> {
        return new Promise((resolve, reject) => {
            if (query === undefined) {
                if (this.jsonData && query === undefined) {
                    resolve(this.jsonData);
                } else {
                    const data = this.getData();
                    if (data && data.length > 0 && query === undefined) {
                        this.serialize()
                            .then(json => {
                                resolve(json);
                            })
                            .catch(e => {
                                reject(e);
                            });
                    } else {
                        this.find(query, false)
                            .toPromise()
                            .then(() => {
                                this.serialize()
                                    .then(json => {
                                        resolve(json);
                                    })
                                    .catch(() => {
                                        reject({});
                                    });
                            })
                            .catch(() => {
                                resolve({});
                            });
                    }
                }
            } else {
                const findOneByIdentifier = query && query.identifier ? query.identifier : null;

                if (findOneByIdentifier) {
                    this._findOneByIdentifier(findOneByIdentifier, false)
                        .toPromise()
                        .then((e: any) => {
                            if (e) {
                                resolve(e.toJson());
                            } else {
                                resolve(null);
                            }
                        })
                        .catch((e: any) => {
                            reject(e);
                        });
                } else {
                    this.find(query, false)
                        .toPromise()
                        .then(() => {
                            this.serialize()
                                .then(json => {
                                    resolve(json);
                                })
                                .catch(e => {
                                    reject(e);
                                });
                        })
                        .catch((e: any) => {
                            reject(e);
                        });
                }
            }
        });
    }

    /**
     *
     * @param property
     */
    public getState(property: string, defaultValue: any) {

        const properties = this._statePropertiesFromInvoker.getValue();
        properties.push(property);

        if (defaultValue !== undefined) {
            this._initialStateFromStateProperties[property] = defaultValue;
            if (this.invoker[property]) {
                this.invoker[property].next(defaultValue);
            }
        }

        this._statePropertiesFromInvoker.next(properties);

        return this._initialStateFromStateProperties[property];

    }

    /**
     * internal use only: update select all state
     */
    private updateIsSelectedAll() {
        const selectedCount = this.getSelected().length;
        const isSelectedAll =
            selectedCount > 0 && Object.keys(this._findAllTemporaryArray['reference']).length === selectedCount;

        if (this._isSelected) {
            Object.keys(this._isSelected).forEach((id: string) => {
                if (this._isSelected[id] && this._findAllTemporaryArray['reference'][id]) {
                    this._findAllTemporaryArray['reference'][id]['_isSelected'] = true;
                }
            });
        }

        this.isSelectedAll$.next(isSelectedAll);
        this.hasSelected$.next(selectedCount > 0);
    }

    /**
     * internal use only: get model references
     */
    private getModelReferences(): AbstractModel[] {
        const references: any[] = [];

        if (!this._findAllTemporaryArray) {
            return references;
        }

        if (this._findAllTemporaryArray.reference) {
            Object.keys(this._findAllTemporaryArray.reference).forEach((identifier: string) => {
                references.push(this._findAllTemporaryArray.reference[identifier]);
            });
        }


        return references;
    }

    /**
     * internal use only: serialize current result
     */
    private serialize(): Promise<any> {
        return new Promise(resolve => {
            const results: any = [];
            const resultsSerialized: any = [];
            const promises: any = [];

            if (this.jsonData) {
                resolve(this.jsonData);
            } else {
                const data = this.getData();

                if (data) {
                    data.forEach((item: AbstractModel) => {
                        results.push(item);
                        promises.push(
                            new Promise(res => {
                                item
                                    .toJson()
                                    .then((e: any) => {
                                        resultsSerialized[item.getIdentifier()] = e;
                                        res();
                                    })
                                    .catch(() => {
                                        res();
                                    });
                            }),
                        );
                    });
                }

                Promise.all(promises)
                    .then(() => {
                        const resultsOrdered: any = [];
                        results.forEach((r: AbstractModel) => {
                            resultsOrdered.push(resultsSerialized[r.getIdentifier()]);
                        });
                        resolve(resultsOrdered);
                    })
                    .catch(() => {
                        resolve([]);
                    });
            }
        });
    }

    /**
     * internal use only: update model hash for change detection
     * @param model
     */
    private updateHash(model: any): void {
        const data = this.getDataFromModel(model);
        const hash = this.getHash(data);

        if (this._modelHashes[model.getIdentifier()] !== hash) {
            const status$ =
                model.getRepository().getParentModel() && model.getRepository().getParentModel()['_repository']
                    ? model.getRepository().getParentModel()['_repository'].status$
                    : this.status$;

            if (this._modelHashes[model.getIdentifier()]) {
                status$.next({
                    isWorking: false,
                    target: model,
                    identifier: model.getIdentifier(),
                    action: 'update',
                });
            }
        }

        this._modelHashes[model.getIdentifier()] = hash;
        this._modelReferences[model.getIdentifier()] = model;
    }

    /**
     * internal use only: get hash from given data object
     * @param data
     */
    private getHash(data: { [key: string]: any }): string {
        const jsonValue = JSON.stringify(data);
        if (!jsonValue) {
            return '';
        }
        return Md5.hashStr(jsonValue).toString();
    }

    /**
     * internal use only: get data object from model
     * @param model
     */
    private getDataFromModel(model: any): any {
        if (!model) {
            return {};
        }
        const initialData = {};
        Object.keys(model).forEach(key => {
            if (
                key.substr(0, 1) === '_' ||
                (model[key] && model[key].constructor && 'Observable' === model[key].constructor.name) ||
                (model[key] && model[key].constructor && undefined !== model[key]['_firestore$']) ||
                (model[key] && typeof model[key] === 'object' && model[key]._repository)
            ) {
                // skip
            } else {
                // @ts-ignore
                initialData[key] = model[key];
            }
        });

        return initialData;
    }

    /**
     * internal use only: get temporary data
     */
    private getData() {
        return this._findAllTemporaryArray && this._findAllTemporaryArray['result']
            ? this._findAllTemporaryArray['result']
            : null;
    }

    /**
     * internal use only: reset tmp data
     */
    private resetData() {
        this._findAllTemporaryArray = { reference: {}, result: [], hashes: {}, tmp: {} };
    }

    /**
     * internal use only: init model from data
     * @param data
     * @param identifier
     */
    private initModelFromData(data: any, identifier: string): AbstractModel {

        let model = null;

        if (this.model && this.model.constructor.name !== 'Function') {
            model = new this.model.constructor();
            if (model && typeof model._init !== 'undefined') {
                model._init(this, data, identifier);
            }
        } else {
            model = new this.model()._init(this, data, identifier);
        }

        if (data !== undefined) {
            this.updateHash(model);
        }


        if (!this._findAllTemporaryArray) {
            this.resetData();
        }
        this._findAllTemporaryArray['reference'][identifier] = model;

        return model;
    }

    /**
     * set intance name
     * @param name
     */
    private setInstanceName(name: string) {
        this.instanceName = Md5.hashStr(name).toString();
    }

    /**
     * synchronize states from app to backend and vice versa
     * @param invoker
     */
    private synchronizeState(invoker: any) {

        if (this.isStateIsSynchronizing) {
            return;
        }

        if (!this.instanceName) {
            this.setInstanceName(this.constructor.name);
        }

        this.isStateIsSynchronizing = true;

        let initialState: any = {};
        const state: any = {};
        const identifier = 'test';
        const path = '__state/' + this.instanceName + '/repository';

        /**
         * watch for state changes in this repository
         */
        const changeDetection = new Observable(changeObserver => {

            Object.keys(this).forEach((key: string) => {
                if (key.substr(0, 6) === '_state') {
                    // @ts-ignore
                    this[key].subscribe((q: any) => {
                        state[key] = q;
                        changeObserver.next(state);
                    });
                }
            })


        });

        /**
         * push statee to backend method
         * @param s
         */
        const pushState = (s: any) => {
            if (!this.firestore) {
                return;
            }

            this.firestore
                .collection(path)
                .doc(identifier)
                .set(s).then().catch()
        };

        /**
         * load state from backend method
         */
        const loadState = () => {
            return new Promise<any>((resolve, reject) => {

                if (!this.firestore) {
                    resolve({});
                } else {
                    this.firestore
                        .doc(path + '/' + identifier)
                        .get().subscribe((data: any) => {
                        if (data.exists) {
                            resolve(data.data());
                        } else {
                            resolve({});
                        }

                    });
                }

            });
        };

        /**
         * load state from backend
         */
        loadState().then((s) => {
            initialState = s;
            Object.keys(s).forEach((key: string) => {
                // @ts-ignore
                if (this[key] && this[key].next) {
                    // @ts-ignore
                    this[key].next(s[key]);
                }
                if (this._initialStateFromStateProperties[key] !== undefined) {
                    this._initialStateFromStateProperties[key] = s[key];
                }
            });

            this._statePropertiesFromInvoker.getValue().forEach((key: string) => {
                if (initialState[key] !== undefined) {
                    this._initialStateFromStateProperties[key] = initialState[key];
                    invoker[key].next(initialState[key]);
                }
            });

            changeDetection.subscribe((e: any) => {
                pushState(e);
            });
            this.setIsReady();
        });

        /**
         * observe state changes from invoker
         */
        this._statePropertiesFromInvoker.subscribe((propertyFromInvoker: string[]) => {
            propertyFromInvoker.forEach((key) => {
                if (invoker[key] && invoker[key].next !== undefined) {
                    invoker[key].subscribe((v: any) => {
                        if (v !== undefined) {
                            state[key] = v;
                            pushState(state);
                        }
                    })
                }
                this._initialStateFromStateProperties[key] = initialState[key];
            });
        });

    }

    /**
     * set is ready state
     */
    private setIsReady() {
        if (!this.isReady$.getValue()) {
            this.isReady$.next(true);
        }
    }

    private setInvoker(invoker: any) {
        this.invoker = invoker;
    }

}
