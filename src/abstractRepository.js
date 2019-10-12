"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("firebase/auth");
const guid_typescript_1 = require("guid-typescript");
const rxjs_1 = require("rxjs");
const ts_md5_1 = require("ts-md5");
const abstractModel_1 = require("./abstractModel");
class AbstractRepository {
    constructor(firestore) {
        this.status$ = new rxjs_1.BehaviorSubject({});
        this.path = '/undefined';
        this.parentInstance = null;
        this.isSelectedAll$ = new rxjs_1.BehaviorSubject(false);
        this.hasSelected$ = new rxjs_1.BehaviorSubject(false);
        this.isReady$ = new rxjs_1.BehaviorSubject(false);
        this._tempData = { reference: {}, result: [], hashes: {}, tmp: {}, count: 0, pageIndex: 0 };
        this._temp = {};
        this._isSelected = {};
        this._count = 0;
        this._pageIndex = new rxjs_1.BehaviorSubject(0);
        this._lastAddedIndex = 0;
        this._modelHashes = {};
        this._modelReferences = {};
        this.parentModel = {};
        this.jsonData = null;
        this.instanceName = '';
        this.isStateIsSynchronizing = false;
        this._statePropertiesFromInvoker = new rxjs_1.BehaviorSubject([]);
        this._initialStateFromStateProperties = {};
        this.invoker = null;
        if (firestore && firestore !== undefined && firestore.getRepository !== undefined && firestore.getRepository()) {
            this.setFirestore(firestore.getRepository().getFirestore());
        }
        else {
            if (firestore && firestore._settings && firestore._projectId === undefined) {
                throw new Error('firestore projectId was not set. Please set env variable GOOGLE_APPLICATION_CREDENTIALS=your-service-account.json');
            }
            this.setFirestore(firestore);
        }
        if (this.constructor.name !== 'AbstractRepository' && this.constructor.name.substr(-10) === 'Repository') {
            this.path = this.constructor.name.substr(0, this.constructor.name.length - 10).toLowerCase();
        }
    }
    createInstance(invoker) {
        const instance = new this.constructor(this.firestore);
        instance.synchronizeState(invoker);
        instance.setInvoker(invoker);
        instance.setParentInstance(this);
        return instance;
    }
    toggleSelection(model) {
        if (model) {
            this._isSelected[model.getIdentifier()] = !this._isSelected[model.getIdentifier()];
            model._isSelected = !model._isSelected;
        }
        if (!model) {
            if (this.isSelectedAll$.getValue()) {
                this._isSelected = {};
            }
            else {
                Object.keys(this._tempData['tmp']).forEach(key => {
                    if (this._tempData['reference'][key] === undefined) {
                        const data = this._tempData['tmp'][key];
                        this.initModelFromData(data, key);
                    }
                    this._tempData['reference'][key]['_isSelected'] = false;
                });
                Object.keys(this._tempData['reference']).forEach(key => {
                    this._isSelected[key] = true;
                    this._tempData['reference'][key]['_isSelected'] = true;
                });
            }
        }
        this.updateIsSelectedAll();
    }
    getSelected() {
        const selected = [];
        if (!this._isSelected) {
            return selected;
        }
        Object.keys(this._isSelected).forEach(key => {
            if (this._isSelected[key] === true && this._tempData['reference'][key]) {
                selected.push(this._tempData['reference'][key]);
            }
        });
        return selected;
    }
    setModel(model) {
        this.model = model;
        return this;
    }
    setParentModel(model) {
        this.parentModel = model;
        return this;
    }
    getParentModel() {
        return this.parentModel;
    }
    setFirestore(firestore) {
        this.firestore = firestore;
        return this;
    }
    getFirestore() {
        return this.firestore;
    }
    getFirestoreBatch() {
        return this.firestore.firestore.batch();
    }
    setPath(path) {
        this.path = path;
        return this;
    }
    getPath() {
        return this.path;
    }
    update(item, data) {
        return new Promise((resolve, reject) => {
            if (!item) {
                const updateAll = [];
                this.getModelReferences().forEach((model) => {
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
            }
            else {
                if (typeof this.model === 'function' && item instanceof this.model === false) {
                    reject('repository accepts only objects of ' +
                        new this.model().constructor.name +
                        '. ' +
                        item.constructor.name +
                        ' given');
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
                const updateData = data === undefined ? {} : data;
                const promises = [];
                updateData['_identifier'] = item.getIdentifier();
                if (data === undefined) {
                    data = {};
                    data['_identifier'] = item.getIdentifier();
                    item
                        .getProperties()
                        .then((properties) => {
                        properties.forEach((property) => {
                            if (property.type === 'relation') {
                                property.value.forEach((res) => {
                                    if (typeof res.getRepository !== 'undefined') {
                                        promises.push(res.getRepository().update(res));
                                    }
                                });
                            }
                            else if (property.type === 'relationOneToOne') {
                                if (typeof property.value.getRepository !== 'undefined') {
                                    promises.push(new Promise(res => {
                                        const status$ = property.value.getRepository().getParentModel() &&
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
                                    }));
                                }
                            }
                            else {
                                updateData[property.key] = property.value;
                            }
                        });
                        if (this._modelHashes[item.getIdentifier()] !== this.getHash(updateData)) {
                            const path = item.getRepository() &&
                                item.getRepository().getPath() &&
                                item.getRepository().getPath() !== '/undefined'
                                ? item.getRepository().getPath()
                                : this.getPath();
                            if (item.getRepository() && item.getRepository().getFirestore() === undefined) {
                                item.getRepository().setPath(this.getPath());
                                item._init(this, item, item.getIdentifier());
                            }
                            if (this._modelHashes[item.getIdentifier()] === undefined) {
                                promises.push(this.firestore.doc(path + '/' + item.getIdentifier()).set(updateData));
                            }
                            else {
                                promises.push(this.firestore.doc(path + '/' + item.getIdentifier()).update(updateData));
                            }
                        }
                        Promise.all(promises)
                            .then(() => {
                            clearTimeout(statusTimeout);
                            resolve(item);
                        })
                            .catch((e) => {
                            clearTimeout(statusTimeout);
                            reject(e);
                        });
                    })
                        .catch((e) => {
                        reject(e);
                    });
                }
                else {
                    const path = item.getRepository() && item.getRepository().getPath() ? item.getRepository().getPath() : this.getPath();
                    this.firestore
                        .doc(path + '/' + item.getIdentifier())
                        .update(data)
                        .then(() => {
                        item.setChanges(false);
                        resolve(item);
                    })
                        .catch((e) => {
                        reject(e);
                    });
                }
            }
        });
    }
    setIndex(item, indexOrNextItem) {
        const self = this;
        const identifier = typeof item === 'string' ? item : item.getIdentifier();
        const model = self._tempData
            ? self._tempData['reference'][identifier]
            : null;
        return new rxjs_1.Observable((observer) => {
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
                const index = new Date().getTime();
                if (typeof indexOrNextItem === 'string') {
                    const subscriber = this._findOneByIdentifier(indexOrNextItem).subscribe((nextItem) => {
                        if (nextItem) {
                            resolve(nextItem.getIndex() - 100);
                        }
                        else {
                            resolve(0);
                        }
                        subscriber.unsubscribe();
                    });
                }
                else if (typeof indexOrNextItem === 'number') {
                    resolve(indexOrNextItem);
                }
                else {
                    resolve(index);
                }
            });
            promise
                .then((index) => {
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
                    .catch((e) => {
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
    removeSelected() {
        const selected = this.getSelected();
        return new Promise((resolve, reject) => {
            if (selected.length === 0) {
                resolve();
            }
            else {
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
    remove(item) {
        const MAX_BATCH_SIZE = 500;
        if (typeof item !== 'string' &&
            item instanceof abstractModel_1.AbstractModel === false &&
            typeof item.length !== 'undefined' &&
            item.length > MAX_BATCH_SIZE) {
            const count = item.length;
            return new Promise((resolve, reject) => {
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
        if (typeof item !== 'string' && item instanceof abstractModel_1.AbstractModel === false && typeof item.length !== 'undefined') {
            return new Promise((resolve, reject) => {
                const statusTimeout = setTimeout(() => {
                    this.status$.next({
                        isWorking: true,
                        target: item,
                        identifier: item.map((i) => i.getIdentifier()).join(','),
                        action: 'remove',
                    });
                }, 500);
                const repo = typeof item[0] !== 'string' && item[0].getRepository() ? item[0].getRepository() : this;
                const batch = repo.getFirestoreBatch();
                item.forEach((i) => {
                    const identifier = typeof i === 'string' ? i : i.getIdentifier();
                    repo.removeTempData(identifier);
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
                        identifier: item.map((i) => i.getIdentifier()).join(','),
                        action: 'remove',
                    });
                    resolve(true);
                })
                    .catch((e) => {
                    reject(e);
                });
            });
        }
        return new Promise((resolve, reject) => {
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
                    repo.removeTempData(identifier);
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
            repo.removeTempData(identifier);
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
                .catch((e) => {
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
    _findOneByIdentifier(identifier, watchForChanges) {
        let watch;
        return new rxjs_1.Observable((observer) => {
            if (!this.firestore) {
                observer.next(null);
                observer.complete();
                return;
            }
            if (this._temp) {
                Object.keys(this._temp).forEach((instanceId) => {
                    if (this._temp[instanceId]._tempData && this._temp[instanceId]._tempData.reference && this._temp[instanceId]._tempData.reference[identifier]) {
                        observer.next(this._temp[instanceId]._tempData.reference[identifier]);
                        if (watchForChanges === false) {
                            observer.complete();
                        }
                        return;
                    }
                });
            }
            if (this.firestore.constructor.name === 'AngularFirestore') {
                watch = watchForChanges === undefined ? true : watchForChanges;
                if (!watch) {
                    const subscriber = this.firestore
                        .doc(this.getPath() + '/' + identifier)
                        .get()
                        .subscribe((data) => {
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
                        .subscribe((data) => {
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
                    this.firestore.doc(this.getPath() + '/' + identifier).onSnapshot((data) => {
                        if (!data.exists) {
                            observer.next(null);
                        }
                        else {
                            observer.next(this.initModelFromData(data.data(), identifier));
                        }
                    }, (e) => {
                        observer.error(e);
                    });
                }
                else {
                    this.firestore
                        .doc(this.getPath() + '/' + identifier)
                        .get()
                        .then((data) => {
                        if (!data.exists) {
                            observer.next(null);
                        }
                        else {
                            observer.next(this.initModelFromData(data.data(), identifier));
                        }
                        if (!watch) {
                            observer.complete();
                        }
                    })
                        .catch((e) => {
                        observer.error(e);
                    });
                }
            }
        });
    }
    count() {
        return this._count;
    }
    pageIndex() {
        return this._pageIndex;
    }
    find(query, watch, subscribeUntil) {
        const self = this;
        this.resetTempData();
        const isAngular = this.firestore && this.firestore.constructor.name === 'AngularFirestore';
        return new rxjs_1.Observable((observer) => {
            if (isAngular) {
                observer.next(this._tempData.result);
                this._count = this._tempData.count;
                this._pageIndex.next(this._tempData.pageIndex);
            }
            this.isReady$.subscribe((ready) => {
                if (ready || !this.invoker) {
                    let path = this.getPath() + (query && query.path !== undefined ? '/' + query.path : '');
                    if (query &&
                        query.path !== undefined &&
                        path.length &&
                        path.split('/').length > 1 &&
                        path.split('/').length % 2 > 0) {
                        const pathS = path.split('/');
                        path = pathS.splice(0, pathS.length - 1).join('/');
                        query.identifier = pathS[pathS.length - 1];
                    }
                    let isWatch;
                    if (isAngular) {
                        isWatch = typeof watch === 'undefined' ? true : watch;
                    }
                    else {
                        isWatch = typeof watch === 'undefined' ? false : watch;
                    }
                    let subscriber = null;
                    let subs = null;
                    let subLimit;
                    let subOffset;
                    let subOrderBy;
                    let lastQueryString = '';
                    let lastCollectionHash = '';
                    const subWhere = {};
                    const updateResults = (q, o, isObservableWatching) => {
                        this.updateIsSelectedAll();
                        this._count = Object.keys(this._tempData['tmp']).length;
                        this._tempData['count'] = this._count;
                        this._tempData['result'] = [];
                        let tmpResults = [];
                        if (q.limit !== undefined && q.offset !== undefined) {
                            tmpResults = Object.keys(this._tempData['tmp']).slice(q.offset, q.limit + q.offset);
                        }
                        else {
                            tmpResults = Object.keys(this._tempData['tmp']);
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
                            this._tempData.pageIndex = q.offset / q.limit;
                            this._pageIndex.next(this._tempData.pageIndex);
                        }
                        tmpResults.forEach(id => {
                            const data = this._tempData['tmp'][id];
                            if (this._tempData['reference'][id] === undefined) {
                                this.initModelFromData(data, id);
                            }
                            else {
                                this.updateHash(this._tempData['reference'][id].setData(data));
                            }
                            this._tempData['result'].push(this._tempData['reference'][id]);
                        });
                        o.next(this._tempData['result']);
                        this.setTempData();
                        if (!isObservableWatching) {
                            o.complete();
                        }
                    };
                    const resolveQuery = new rxjs_1.Observable(observerQuery => {
                        if (!query) {
                            observerQuery.next({});
                        }
                        if (query) {
                            const getValues = () => new Promise(resolveValues => {
                                const promises = [];
                                if (query.identifier) {
                                    promises.push(new Promise(resolve => {
                                        resolve({ identifier: query.identifier });
                                    }));
                                }
                                if (query.where) {
                                    query.where.forEach((w, i) => {
                                        promises.push(new Promise(resolve => {
                                            if (typeof w.value.asObservable === 'function') {
                                                resolve({
                                                    where: {
                                                        operation: w.operation ? w.operation : '==',
                                                        property: w.property,
                                                        value: w.value.getValue(),
                                                    },
                                                });
                                            }
                                            else if (typeof w.value.subscribe === 'function') {
                                                subWhere[i] = null;
                                                subWhere[i].w.value.subscribe((v) => {
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
                                            }
                                            else {
                                                resolve({
                                                    where: {
                                                        operation: w.operation ? w.operation : '==',
                                                        property: w.property,
                                                        value: w.value,
                                                    },
                                                });
                                            }
                                        }));
                                    });
                                }
                                if (query.limit) {
                                    promises.push(new Promise(resolve => {
                                        if (typeof query.limit === 'number') {
                                            resolve({ limit: query.limit });
                                        }
                                        if (typeof query.limit.asObservable === 'function') {
                                            resolve({ limit: query.limit.getValue() });
                                        }
                                        if (typeof query.limit.subscribe === 'function') {
                                            subLimit = query.limit.subscribe((limit) => {
                                                resolve({ limit: limit });
                                                if (subLimit) {
                                                    subLimit.unsubscribe();
                                                }
                                            });
                                        }
                                    }));
                                }
                                if (query.offset) {
                                    promises.push(new Promise(resolve => {
                                        if (typeof query.offset === 'number') {
                                            resolve({ offset: query.offset });
                                        }
                                        if (typeof query.offset.asObservable === 'function') {
                                            resolve({ offset: query.offset.getValue() });
                                        }
                                        if (typeof query.offset.subscribe === 'function') {
                                            subOffset = query.offset.subscribe((offset) => {
                                                resolve({ offset: offset });
                                                if (subOffset) {
                                                    subOffset.unsubscribe();
                                                }
                                            });
                                        }
                                    }));
                                }
                                if (query.orderBy) {
                                    promises.push(new Promise(resolve => {
                                        if (typeof query.orderBy === 'string') {
                                            resolve({ orderBy: query.orderBy });
                                        }
                                        if (typeof query.orderBy.asObservable === 'function') {
                                            resolve({ orderBy: query.orderBy.getValue() });
                                        }
                                        if (typeof query.orderBy.subscribe === 'function') {
                                            subOrderBy = query.orderBy.subscribe((orderBy) => {
                                                resolve({ orderBy: orderBy });
                                                if (subOrderBy) {
                                                    subOrderBy.unsubscribe();
                                                }
                                            });
                                        }
                                    }));
                                }
                                Promise.all(promises).then((data) => {
                                    const q = { limit: 0, where: [] };
                                    data.forEach((d) => {
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
                            const changeDetection = new rxjs_1.Observable(changeObserver => {
                                if (query.limit) {
                                    if (typeof query.limit.asObservable === 'function') {
                                        query.limit.asObservable().subscribe(() => {
                                            changeObserver.next();
                                        });
                                    }
                                    else if (typeof query.limit.subscribe === 'function') {
                                        query.limit.subscribe(() => {
                                            changeObserver.next();
                                        });
                                    }
                                    else {
                                        changeObserver.next();
                                    }
                                }
                                if (query.offset) {
                                    if (typeof query.offset.asObservable === 'function') {
                                        query.offset.asObservable().subscribe((offset) => {
                                            getValues().then((value) => {
                                                applyQuery(value);
                                            });
                                        });
                                    }
                                    else if (typeof query.offset.subscribe === 'function') {
                                        query.offset.subscribe((offset) => {
                                            getValues().then((value) => {
                                                applyQuery(value);
                                            });
                                        });
                                    }
                                    else {
                                        applyQuery(query.offset);
                                    }
                                }
                                if (query.orderBy) {
                                    if (typeof query.orderBy.asObservable === 'function') {
                                        query.orderBy.asObservable().subscribe(() => {
                                            changeObserver.next();
                                        });
                                    }
                                    else if (typeof query.orderBy.subscribe === 'function') {
                                        query.orderBy.subscribe(() => {
                                            changeObserver.next();
                                        });
                                    }
                                    else {
                                        changeObserver.next();
                                    }
                                }
                                if (query.where) {
                                    query.where.forEach((w) => {
                                        if (typeof w.value.asObservable === 'function') {
                                            w.value.asObservable().subscribe(() => {
                                                changeObserver.next();
                                            });
                                        }
                                        else if (typeof w.value.subscribe === 'function') {
                                            w.value.subscribe(() => {
                                                changeObserver.next();
                                            });
                                        }
                                        else {
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
                            let appliedQuery = null;
                            let timeout = null;
                            const applyQuery = (q1) => {
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
                                getValues().then((value) => {
                                    applyQuery(value);
                                });
                            });
                        }
                    });
                    resolveQuery.subscribe((q) => {
                        const qForCompare = JSON.parse(JSON.stringify(q));
                        qForCompare.offset = 0;
                        if (JSON.stringify(qForCompare) === lastCollectionHash) {
                            updateResults(q, observer, isWatch);
                        }
                        else {
                            lastCollectionHash = JSON.stringify(qForCompare);
                            if (!q.orderBy && this.getPath().lastIndexOf('/') <= 0) {
                                q.orderBy = '_index';
                            }
                            if (q && q.identifier !== undefined) {
                                this._findOneByIdentifier(q.identifier, isWatch).subscribe((model) => {
                                    this.resetTempData();
                                    if (model) {
                                        this._tempData['reference'][model.getIdentifier()] = model;
                                        this._tempData['tmp'][model.getIdentifier()] = this.getDataFromModel(model);
                                    }
                                    updateResults(q, observer, isWatch);
                                });
                            }
                            else {
                                if (!this.firestore) {
                                    observer.next([]);
                                    observer.complete();
                                    return;
                                }
                                if (this.firestore.constructor.name === 'AngularFirestore') {
                                    if (subscriber) {
                                        subscriber.unsubscribe();
                                    }
                                    subscriber = this.firestore
                                        .collection(path, (reference) => {
                                        let ref = reference;
                                        if (q.orderBy) {
                                            ref = ref.orderBy(q.orderBy);
                                        }
                                        if (q.limit && q.offset === undefined) {
                                            ref = ref.limit(q.limit);
                                        }
                                        const refs = [ref];
                                        if (q.where) {
                                            q.where.forEach((w) => {
                                                refs.push(refs[refs.length - 1].where(w.property, w.operation ? w.operation : '==', w.value));
                                            });
                                        }
                                        return refs[refs.length - 1];
                                    })
                                        .stateChanges(['added', 'removed', 'modified'])
                                        .subscribe((results) => {
                                        results.forEach((data) => {
                                            switch (data.type) {
                                                case 'added':
                                                    this._tempData['tmp'][data.payload.doc.id] = data.payload.doc.data();
                                                    break;
                                                case 'modified':
                                                    this._tempData['tmp'][data.payload.doc.id] = data.payload.doc.data();
                                                    if (this._tempData['reference'][data.payload.doc.id] === undefined) {
                                                        this.initModelFromData(data.payload.doc.data(), data.payload.doc.id);
                                                    }
                                                    else {
                                                        this.updateHash(this._tempData['reference'][data.payload.doc.id].setData(data.payload.doc.data()));
                                                    }
                                                    break;
                                                case 'removed':
                                                    if (this._tempData['reference'][data.payload.doc.id]) {
                                                        delete this._tempData['reference'][data.payload.doc.id];
                                                    }
                                                    if (this._tempData['tmp'][data.payload.doc.id]) {
                                                        delete this._tempData['tmp'][data.payload.doc.id];
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
                                        q.where.forEach((w) => {
                                            ref = ref.where(w.property, w.operation ? w.operation : '==', w.value);
                                        });
                                    }
                                    if (subs) {
                                        subs();
                                    }
                                    subs = ref.onSnapshot((querySnapshot) => {
                                        querySnapshot.forEach((doc) => {
                                            this._tempData['tmp'][doc.id] = doc.data();
                                        });
                                        updateResults(q, observer, isWatch);
                                    }, (e) => {
                                        observer.error(e);
                                        observer.complete();
                                        subs();
                                    });
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
                        }
                    });
                }
            });
        });
    }
    addMultiple(count, data) {
        const MAX_BATCH_SIZE = 500;
        if (count > MAX_BATCH_SIZE) {
            return new Promise((resolve, reject) => {
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
        return new Promise((resolve, reject) => {
            const batch = this.getFirestoreBatch();
            const statusTimeout = setTimeout(() => {
                this.status$.next({
                    isWorking: true,
                    action: 'add',
                });
            }, 500);
            for (let i = 0; i < count; i++) {
                const identifier = guid_typescript_1.Guid.create().toString();
                const targetModel = new this.model();
                targetModel.setIdentifier(identifier);
                const initialData = this.getDataFromModel(targetModel);
                initialData['_index'] = new Date().getTime() + this._lastAddedIndex * 100;
                initialData['_identifier'] = identifier;
                if (data !== undefined) {
                    Object.keys(data).forEach(key => {
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
                .catch((e) => {
                reject(e);
            });
        });
    }
    add(data, newIdentifier, targetRelation, parentModel) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const self = this;
            const identifier = newIdentifier === undefined || newIdentifier === null ? guid_typescript_1.Guid.create().toString() : newIdentifier;
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
                    initialData[key] = data[key];
                });
            }
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
                if (!this._tempData) {
                    this.resetTempData();
                }
                this._tempData['reference'][identifier] = model;
                resolve(this._tempData['reference'][identifier]);
            })
                .catch((e) => {
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
        }));
    }
    getLogger(filter) {
        return new rxjs_1.Observable((observer) => {
            this.status$.subscribe((s) => {
                if (filter === undefined) {
                    observer.next(s);
                }
                else {
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
                    if (match &&
                        filter.target !== undefined &&
                        filter.target &&
                        typeof filter.target === 'object' &&
                        filter.target.constructor &&
                        s.target &&
                        s.target.constructor &&
                        filter.target.constructor.name !== s.target.constructor.name) {
                        match = false;
                    }
                    if (match &&
                        filter.target !== undefined &&
                        typeof filter.target === 'string' &&
                        s.target &&
                        s.target.constructor &&
                        filter.target !== s.target.constructor.name) {
                        match = false;
                    }
                    if (match) {
                        Object.keys(filter).forEach((key) => {
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
    toJson(query) {
        return new Promise((resolve, reject) => {
            if (query === undefined) {
                if (this.jsonData && query === undefined) {
                    resolve(this.jsonData);
                }
                else {
                    const data = this.getData();
                    if (data && data.length > 0 && query === undefined) {
                        this.serialize()
                            .then(json => {
                            resolve(json);
                        })
                            .catch(e => {
                            reject(e);
                        });
                    }
                    else {
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
            }
            else {
                const findOneByIdentifier = query && query.identifier ? query.identifier : null;
                if (findOneByIdentifier) {
                    this._findOneByIdentifier(findOneByIdentifier, false)
                        .toPromise()
                        .then((e) => {
                        if (e) {
                            resolve(e.toJson());
                        }
                        else {
                            resolve(null);
                        }
                    })
                        .catch((e) => {
                        reject(e);
                    });
                }
                else {
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
                        .catch((e) => {
                        reject(e);
                    });
                }
            }
        });
    }
    getState(property, defaultValue) {
        const properties = this._statePropertiesFromInvoker.getValue();
        const tmpData = this.getTempData();
        let initialValue = defaultValue;
        properties.push(property);
        if (tmpData && tmpData.state && tmpData.state[property]) {
            initialValue = tmpData.state[property];
        }
        if (initialValue !== undefined) {
            this._initialStateFromStateProperties[property] = initialValue;
            if (this.invoker[property]) {
                this.invoker[property].next(initialValue);
            }
        }
        this._statePropertiesFromInvoker.next(properties);
        return initialValue ? initialValue : this._initialStateFromStateProperties[property];
    }
    removeTempData(identifier) {
        if (this._tempData.reference[identifier]) {
            delete this._tempData.reference[identifier];
        }
        return;
    }
    updateIsSelectedAll() {
        const selectedCount = this.getSelected().length;
        const isSelectedAll = selectedCount > 0 && Object.keys(this._tempData['reference']).length === selectedCount;
        if (this._isSelected) {
            Object.keys(this._isSelected).forEach((id) => {
                if (this._isSelected[id] && this._tempData['reference'][id]) {
                    this._tempData['reference'][id]['_isSelected'] = true;
                }
            });
        }
        this.isSelectedAll$.next(isSelectedAll);
        this.hasSelected$.next(selectedCount > 0);
    }
    getModelReferences() {
        const references = [];
        if (!this._tempData) {
            return references;
        }
        if (this._tempData.reference) {
            Object.keys(this._tempData.reference).forEach((identifier) => {
                references.push(this._tempData.reference[identifier]);
            });
        }
        return references;
    }
    serialize() {
        return new Promise(resolve => {
            const results = [];
            const resultsSerialized = [];
            const promises = [];
            if (this.jsonData) {
                resolve(this.jsonData);
            }
            else {
                const data = this.getData();
                if (data) {
                    data.forEach((item) => {
                        results.push(item);
                        promises.push(new Promise(res => {
                            item
                                .toJson()
                                .then((e) => {
                                resultsSerialized[item.getIdentifier()] = e;
                                res();
                            })
                                .catch(() => {
                                res();
                            });
                        }));
                    });
                }
                Promise.all(promises)
                    .then(() => {
                    const resultsOrdered = [];
                    results.forEach((r) => {
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
    updateHash(model) {
        const data = this.getDataFromModel(model);
        const hash = this.getHash(data);
        if (this._modelHashes[model.getIdentifier()] !== hash) {
            const status$ = model.getRepository().getParentModel() && model.getRepository().getParentModel()['_repository']
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
    getHash(data) {
        const jsonValue = JSON.stringify(data);
        if (!jsonValue) {
            return '';
        }
        return ts_md5_1.Md5.hashStr(jsonValue).toString();
    }
    getDataFromModel(model) {
        if (!model) {
            return {};
        }
        const initialData = {};
        Object.keys(model).forEach(key => {
            if (key.substr(0, 1) === '_' ||
                (model[key] && model[key].constructor && 'Observable' === model[key].constructor.name) ||
                (model[key] && model[key].constructor && undefined !== model[key]['_firestore$']) ||
                (model[key] && typeof model[key] === 'object' && model[key]._repository)) {
            }
            else {
                initialData[key] = model[key];
            }
        });
        return initialData;
    }
    getData() {
        return this._tempData && this._tempData['result']
            ? this._tempData['result']
            : null;
    }
    resetTempData(initialData) {
        this._tempData = initialData ? initialData : this.getTempData();
    }
    initModelFromData(data, identifier) {
        let model = null;
        if (this.model && this.model.constructor.name !== 'Function') {
            model = new this.model.constructor();
            if (model && typeof model._init !== 'undefined') {
                model._init(this, data, identifier);
            }
        }
        else {
            model = new this.model()._init(this, data, identifier);
        }
        if (data !== undefined) {
            this.updateHash(model);
        }
        if (!this._tempData) {
            this.resetTempData();
        }
        this._tempData['reference'][identifier] = model;
        return model;
    }
    setInstanceName(name) {
        this.instanceName = ts_md5_1.Md5.hashStr(name).toString();
    }
    synchronizeState(invoker) {
        if (this.isStateIsSynchronizing) {
            return;
        }
        if (!this.instanceName) {
            this.setInstanceName(this.constructor.name);
        }
        this.isStateIsSynchronizing = true;
        let initialState = {};
        let pushStateTimeout = null;
        const state = {};
        const identifier = 'test';
        const path = '__state/' + this.instanceName + '/repository';
        const changeDetection = new rxjs_1.Observable(changeObserver => {
            Object.keys(this).forEach((key) => {
                if (key.substr(0, 6) === '_state') {
                    this[key].subscribe((q) => {
                        state[key] = q;
                        changeObserver.next(state);
                    });
                }
            });
        });
        const pushState = () => {
            if (!this.firestore) {
                return;
            }
            if (pushStateTimeout) {
                clearTimeout(pushStateTimeout);
            }
            this._tempData.state = state;
            if (this.isReady$.getValue()) {
                pushStateTimeout = setTimeout(() => {
                    this.firestore
                        .collection(path)
                        .doc(identifier)
                        .set(state).then().catch();
                }, 100);
            }
        };
        const loadState = () => {
            return new Promise((resolve, reject) => {
                if (!this.firestore) {
                    resolve({});
                }
                else {
                    this.firestore
                        .doc(path + '/' + identifier)
                        .get().subscribe((data) => {
                        if (data.exists) {
                            resolve(data.data());
                        }
                        else {
                            resolve({});
                        }
                    });
                }
            });
        };
        loadState().then((s) => {
            initialState = s;
            Object.keys(s).forEach((key) => {
                if (this[key] && this[key].next) {
                    this[key].next(s[key]);
                }
                if (this._initialStateFromStateProperties[key] !== undefined) {
                    this._initialStateFromStateProperties[key] = s[key];
                }
            });
            this._statePropertiesFromInvoker.getValue().forEach((key) => {
                if (initialState[key] !== undefined) {
                    this._initialStateFromStateProperties[key] = initialState[key];
                    invoker[key].next(initialState[key]);
                }
            });
            changeDetection.subscribe((e) => {
                pushState();
            });
            this.setIsReady();
        });
        this._statePropertiesFromInvoker.subscribe((propertyFromInvoker) => {
            propertyFromInvoker.forEach((key) => {
                if (invoker[key] && invoker[key].next !== undefined) {
                    invoker[key].subscribe((v) => {
                        if (v !== undefined) {
                            state[key] = v;
                            pushState();
                        }
                    });
                }
                this._initialStateFromStateProperties[key] = initialState[key];
            });
        });
    }
    setIsReady() {
        if (!this.isReady$.getValue()) {
            this.isReady$.next(true);
        }
    }
    setInvoker(invoker) {
        this.invoker = invoker;
    }
    setParentInstance(parentInstance) {
        this.parentInstance = parentInstance;
    }
    getTempData(instanceName) {
        if (this.parentInstance) {
            return this.parentInstance.getTempData(this.instanceName);
        }
        if (!instanceName || !this._temp[instanceName]) {
            return { reference: {}, result: [], hashes: {}, tmp: {}, count: 0, pageIndex: 0 };
        }
        return this._temp[instanceName]._tempData;
    }
    setTempData(data, instanceName) {
        if (this.parentInstance) {
            this.parentInstance.setTempData(this._tempData, this.instanceName);
            return;
        }
        if (!instanceName || !data) {
            return;
        }
        this._temp[instanceName] = { _tempData: data };
    }
}
exports.AbstractRepository = AbstractRepository;
