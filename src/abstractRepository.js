"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const guid_typescript_1 = require("guid-typescript");
const rxjs_1 = require("rxjs");
const ts_md5_1 = require("ts-md5");
const abstractModel_1 = require("./abstractModel");
class AbstractRepository {
    constructor(firestore) {
        this.status$ = new rxjs_1.BehaviorSubject({});
        this.path = '/undefined';
        this.isSelectedAll$ = new rxjs_1.BehaviorSubject(false);
        this.hasSelected$ = new rxjs_1.BehaviorSubject(false);
        this._findAllTemporaryArray = {};
        this._isSelected = {};
        this._count = {};
        this._orderBy = {};
        this._lastOffset = {};
        this._uuid = guid_typescript_1.Guid.create().toString();
        this._lastAddedIndex = 0;
        this._modelHashes = {};
        this._modelReferences = {};
        this.parentModel = {};
        this.jsonData = null;
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
    toggleSelection(model) {
        if (!this._isSelected[this._uuid]) {
            this._isSelected[this._uuid] = {};
        }
        if (model) {
            this._isSelected[this._uuid][model.getIdentifier()] = !this._isSelected[this._uuid][model.getIdentifier()];
            model._isSelected = !model._isSelected;
        }
        if (!model) {
            if (this.isSelectedAll$.getValue()) {
                this._isSelected[this._uuid] = {};
                Object.keys(this._findAllTemporaryArray[this._uuid]['reference']).forEach((key) => {
                    this._findAllTemporaryArray[this._uuid]['reference'][key]['_isSelected'] = false;
                });
            }
            else {
                Object.keys(this._findAllTemporaryArray[this._uuid]['reference']).forEach((key) => {
                    this._isSelected[this._uuid][key] = true;
                    this._findAllTemporaryArray[this._uuid]['reference'][key]['_isSelected'] = true;
                });
            }
        }
        this.updateIsSelectedAll();
    }
    getSelected() {
        const selected = [];
        if (!this._isSelected[this._uuid]) {
            return selected;
        }
        Object.keys(this._isSelected[this._uuid]).forEach((key) => {
            if (this._isSelected[this._uuid][key] === true && this._findAllTemporaryArray[this._uuid]['reference'][key]) {
                selected.push(this._findAllTemporaryArray[this._uuid]['reference'][key]);
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
                if (data === undefined) {
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
        const model = self._findAllTemporaryArray[this._uuid]
            ? self._findAllTemporaryArray[this._uuid]['reference'][identifier]
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
                this.remove(selected).then(() => {
                    resolve();
                }).catch((e) => {
                    reject(e);
                });
            }
        });
    }
    remove(item) {
        if (typeof item !== 'string' && item instanceof abstractModel_1.AbstractModel === false && typeof item.length !== 'undefined') {
            return new Promise((resolve, reject) => {
                const promises = [];
                item.forEach((i) => {
                    promises.push(this.remove(i));
                });
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
        const self = this;
        let watch;
        return new rxjs_1.Observable((observer) => {
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
                        .subscribe((data) => {
                        let model = null;
                        if (data.exists) {
                            if (self.model && self.model.constructor.name !== 'Function') {
                                model = new self.model.constructor();
                                if (model && typeof model._init !== 'undefined') {
                                    model._init(self, data.data(), identifier);
                                }
                            }
                            else {
                                model = new self.model()._init(self, data.data(), identifier);
                            }
                            this.updateHash(model);
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
                            if (self.model && self.model.constructor.name !== 'Function') {
                                model = new self.model.constructor();
                                if (model && typeof model._init !== 'undefined') {
                                    model._init(self, data, identifier);
                                }
                            }
                            else {
                                model = new self.model()._init(self, data, identifier);
                            }
                            this.updateHash(model);
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
                            let model = null;
                            if (self.model && self.model.constructor.name !== 'Function') {
                                model = new self.model.constructor()._init(self, data.data(), identifier);
                            }
                            else {
                                model = new self.model()._init(self, data.data(), identifier);
                            }
                            observer.next(model);
                            this.updateHash(model);
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
                            let model = null;
                            if (self.model && self.model.constructor.name !== 'Function') {
                                model = new self.model.constructor()._init(self, data.data(), identifier);
                            }
                            else {
                                model = new self.model()._init(self, data.data(), identifier);
                            }
                            observer.next(model);
                            if (data !== undefined) {
                                this.updateHash(model);
                            }
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
        if (this._count[this._uuid] === undefined) {
            this._count[this._uuid] = 0;
        }
        return this._count[this._uuid];
    }
    find(query, watch, subscribeUntil) {
        const self = this;
        const uuid = this._uuid;
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
        const isAngular = this.firestore && this.firestore.constructor.name === 'AngularFirestore';
        if (isAngular) {
            isWatch = typeof watch === 'undefined' ? true : watch;
        }
        else {
            isWatch = typeof watch === 'undefined' ? false : watch;
        }
        let countUsed = 0;
        let subscriber = null;
        let subscriberCount = null;
        let subs = null;
        return new rxjs_1.Observable((observer) => {
            if (isAngular) {
                observer.next([]);
            }
            this._findAllTemporaryArray[uuid] = { reference: {}, result: [], hashes: {} };
            let subLimit;
            let subOffset;
            let subOrderBy;
            const subWhere = {};
            const resolveQuery = new rxjs_1.Observable((observerQuery) => {
                if (!query) {
                    observerQuery.next({});
                }
                if (query) {
                    let hash = '';
                    const getValues = () => new Promise((resolveValues => {
                        const promises = [];
                        if (query.identifier) {
                            promises.push(new Promise((resolve) => {
                                resolve({ identifier: query.identifier });
                            }));
                        }
                        if (query.where) {
                            query.where.forEach((w, i) => {
                                promises.push(new Promise((resolve) => {
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
                            promises.push(new Promise((resolve) => {
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
                            promises.push(new Promise((resolve) => {
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
                            promises.push(new Promise((resolve) => {
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
                                if (d.limit) {
                                    q.limit = d.limit;
                                }
                                if (d.offset) {
                                    q.offset = d.offset;
                                }
                                if (d.where && q.where) {
                                    q.where.push(d.where);
                                }
                                if (d.orderBy) {
                                    q.orderBy = d.orderBy;
                                }
                                if (d.identifier) {
                                    q.identifier = d.identifier;
                                }
                            });
                            resolveValues(q);
                        });
                    }));
                    const changeDetection = new rxjs_1.Observable((changeObserver) => {
                        changeObserver.next();
                        if (query.limit) {
                            if (typeof query.limit.asObservable === 'function') {
                                query.limit.asObservable().subscribe(() => {
                                    changeObserver.next();
                                });
                            }
                            if (typeof query.limit.subscribe === 'function') {
                                query.limit.subscribe(() => {
                                    changeObserver.next();
                                });
                            }
                        }
                        if (query.offset) {
                            if (typeof query.offset.asObservable === 'function') {
                                query.offset.asObservable().subscribe(() => {
                                    changeObserver.next();
                                });
                            }
                            if (typeof query.offset.subscribe === 'function') {
                                query.offset.subscribe(() => {
                                    changeObserver.next();
                                });
                            }
                        }
                        if (query.orderBy) {
                            if (typeof query.orderBy.asObservable === 'function') {
                                query.orderBy.asObservable().subscribe(() => {
                                    changeObserver.next();
                                });
                            }
                            if (typeof query.orderBy.subscribe === 'function') {
                                query.orderBy.subscribe(() => {
                                    changeObserver.next();
                                });
                            }
                        }
                        if (query.where) {
                            query.where.forEach((w) => {
                                if (typeof w.value.asObservable === 'function') {
                                    w.value.asObservable().subscribe(() => {
                                        changeObserver.next();
                                    });
                                }
                                if (typeof w.value.subscribe === 'function') {
                                    w.value.subscribe(() => {
                                        changeObserver.next();
                                    });
                                }
                            });
                        }
                    });
                    changeDetection.subscribe(() => {
                        getValues().then((value) => {
                            const newHash = JSON.stringify(value);
                            if (newHash !== hash) {
                                observerQuery.next(value);
                            }
                            hash = newHash;
                        });
                    });
                }
            });
            resolveQuery.subscribe((q) => {
                this._findAllTemporaryArray[uuid] = { reference: {}, result: [], hashes: {} };
                if (subs) {
                    subs();
                }
                if (subscriber) {
                    subscriber.unsubscribe();
                    subscriber = null;
                }
                if (subscriberCount) {
                    subscriberCount.unsubscribe();
                    subscriberCount = null;
                }
                if (!q.orderBy && this.getPath().lastIndexOf('/') <= 0) {
                    q.orderBy = '_index';
                }
                this._orderBy[this._uuid] = q.orderBy ? q.orderBy : '_index';
                if (this._lastOffset[this._uuid] === undefined) {
                    this._lastOffset[this._uuid] = 0;
                }
                if (q && q.identifier !== undefined) {
                    subscriber = this._findOneByIdentifier(q.identifier, isWatch).subscribe((model) => {
                        if (model) {
                            observer.next([model]);
                        }
                        else {
                            observer.next([]);
                        }
                        if (!isWatch) {
                            subscriber.unsubscribe();
                            observer.complete();
                        }
                    });
                }
                else {
                    if (!this.firestore) {
                        observer.next([]);
                        observer.complete();
                        return;
                    }
                    if (this.firestore.constructor.name === 'AngularFirestore') {
                        subscriberCount = this.firestore
                            .collection(path, (reference) => {
                            let ref = reference;
                            let limitCount = q.limit ? q.limit : 1000;
                            if (q.orderBy) {
                                ref = ref.orderBy(q.orderBy);
                            }
                            if (q.limit) {
                                limitCount = limitCount + 1000;
                                if (q.offset) {
                                    limitCount = limitCount + q.offset;
                                }
                                ref = ref.limit(limitCount);
                            }
                            const refs = [ref];
                            if (q.where) {
                                q.where.forEach((w) => {
                                    refs.push(refs[refs.length - 1].where(w.property, w.operation ? w.operation : '==', w.value));
                                });
                            }
                            return refs[refs.length - 1];
                        })
                            .valueChanges(['added', 'removed']).subscribe((r) => {
                            this._count[this._uuid] = r.length;
                        });
                        subscriber = this.firestore
                            .collection(path, (reference) => {
                            let ref = reference;
                            if (q.orderBy) {
                                ref = ref.orderBy(q.orderBy);
                            }
                            if (q.limit && !q.offset) {
                                ref = ref.limit(q.limit);
                            }
                            if (q.offset) {
                                ref = ref.limit(q.offset + q.limit);
                            }
                            const refs = [ref];
                            if (q.where) {
                                q.where.forEach((w) => {
                                    refs.push(refs[refs.length - 1].where(w.property, w.operation ? w.operation : '==', w.value));
                                });
                            }
                            return refs[refs.length - 1];
                        })
                            .stateChanges()
                            .subscribe((results) => {
                            results.forEach((data) => {
                                switch (data.type) {
                                    case 'added':
                                        if (this._findAllTemporaryArray[uuid]['reference'][data.payload.doc.id] === undefined) {
                                            const model = new self.model()._init(self, data.payload.doc.data(), data.payload.doc.id);
                                            this.updateHash(model);
                                            this._findAllTemporaryArray[uuid]['reference'][data.payload.doc.id] = model;
                                            this._findAllTemporaryArray[uuid]['result'].push(this._findAllTemporaryArray[uuid]['reference'][data.payload.doc.id]);
                                        }
                                        else {
                                            this.updateHash(this._findAllTemporaryArray[uuid]['reference'][data.payload.doc.id].setData(data.payload.doc.data()));
                                        }
                                        break;
                                    case 'modified':
                                        if (this._findAllTemporaryArray[uuid]['reference'][data.payload.doc.id] === undefined) {
                                            const model = new self.model()._init(self, data.payload.doc.data(), data.payload.doc.id);
                                            this.updateHash(model);
                                            this._findAllTemporaryArray[uuid]['reference'][data.payload.doc.id] = model;
                                            this._findAllTemporaryArray[uuid]['result'].push(this._findAllTemporaryArray[uuid]['reference'][data.payload.doc.id]);
                                        }
                                        this.updateHash(this._findAllTemporaryArray[uuid]['reference'][data.payload.doc.id].setData(data.payload.doc.data()));
                                        break;
                                    case 'removed':
                                        delete this._findAllTemporaryArray[uuid]['reference'][data.payload.doc.id];
                                        for (let i = 0; i < this._findAllTemporaryArray[uuid]['result'].length; i++) {
                                            if (this._findAllTemporaryArray[uuid]['result'][i]._identifier === data.payload.doc.id) {
                                                this._findAllTemporaryArray[uuid]['result'].splice(i, 1);
                                                i--;
                                            }
                                        }
                                        break;
                                }
                            });
                            this.updateIsSelectedAll();
                            if (q.offset && q.limit && this._findAllTemporaryArray[uuid]['result'].length > q.limit) {
                                observer.next(this._findAllTemporaryArray[uuid]['result'].slice(q.offset));
                            }
                            else {
                                observer.next(this._findAllTemporaryArray[uuid]['result']);
                            }
                            if (!isWatch) {
                                observer.complete();
                                subscriber.unsubscribe();
                                subscriberCount.unsubscribe();
                            }
                            else {
                                if (subscribeUntil !== undefined) {
                                    if (subscribeUntil.until === 'count' && subscribeUntil.value <= countUsed) {
                                        observer.complete();
                                    }
                                }
                            }
                        });
                        if (isWatch && subscribeUntil && subscribeUntil.until === 'timeout') {
                            setTimeout(() => {
                                observer.complete();
                                subscriber.unsubscribe();
                                subscriberCount.unsubscribe();
                            }, subscribeUntil.value);
                        }
                    }
                    if (this.firestore.constructor.name !== 'AngularFirestore') {
                        let ref = this.firestore.collection(path);
                        if (q.orderBy) {
                            ref = ref.orderBy(q.orderBy);
                        }
                        if (q.limit) {
                            ref = ref.limit(q.limit);
                        }
                        if (q.offset) {
                            ref = ref.startAt(q.offset);
                        }
                        if (q.where) {
                            q.where.forEach((w) => {
                                ref = ref.where(w.property, w.operation ? w.operation : '==', w.value);
                            });
                        }
                        subs = ref.onSnapshot(() => {
                            countUsed = countUsed + 1;
                            ref
                                .get()
                                .then((querySnapshot) => {
                                this._findAllTemporaryArray[uuid]['result'] = [];
                                querySnapshot.forEach((documentSnapshot) => {
                                    const id = documentSnapshot.id;
                                    const docData = documentSnapshot.data();
                                    const model = new self.model()._init(self, docData, id);
                                    this._findAllTemporaryArray[uuid]['result'].push(model);
                                    this.updateHash(model);
                                });
                                this.updateIsSelectedAll();
                                observer.next(this._findAllTemporaryArray[uuid]['result']);
                                if (!isWatch) {
                                    observer.complete();
                                    subs();
                                }
                                else {
                                    if (subscribeUntil !== undefined) {
                                        if (subscribeUntil.until === 'count' && subscribeUntil.value <= countUsed) {
                                            observer.complete();
                                            subs();
                                            this.status$.next({
                                                isWorking: false,
                                                target: self,
                                                action: 'subscriptionClosedAfterTimeoutOrMaxCount',
                                            });
                                        }
                                    }
                                }
                            })
                                .catch((e) => {
                                this.updateIsSelectedAll();
                                observer.next([]);
                                observer.error(e);
                                if (!isWatch) {
                                    observer.complete();
                                    subs();
                                }
                            });
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
                    this._lastOffset[this._uuid] = q.offset ? q.offset : 0;
                }
            });
        });
    }
    add(data, newIdentifier, targetRelation, parentModel) {
        return new Promise((resolve, reject) => {
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
                this._findOneByIdentifier(identifier, false)
                    .toPromise()
                    .then((e) => {
                    resolve(e);
                    clearTimeout(statusTimeout);
                    this.status$.next({
                        isWorking: false,
                        target: e,
                        identifier: identifier,
                        action: 'add',
                    });
                })
                    .catch();
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
        });
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
    updateIsSelectedAll() {
        const selectedCount = this.getSelected().length;
        const isSelectedAll = selectedCount > 0 && Object.keys(this._findAllTemporaryArray[this._uuid]['reference']).length === selectedCount;
        if (this._isSelected[this._uuid]) {
            Object.keys(this._isSelected[this._uuid]).forEach((id) => {
                if (this._isSelected[this._uuid][id] && this._findAllTemporaryArray[this._uuid]['reference'][id]) {
                    this._findAllTemporaryArray[this._uuid]['reference'][id]['_isSelected'] = true;
                }
            });
        }
        this.isSelectedAll$.next(isSelectedAll);
        this.hasSelected$.next(selectedCount > 0);
    }
    getModelReferences() {
        const references = [];
        if (!this._findAllTemporaryArray) {
            return references;
        }
        Object.keys(this._findAllTemporaryArray).forEach((uuid) => {
            if (this._findAllTemporaryArray[uuid].reference) {
                Object.keys(this._findAllTemporaryArray[uuid].reference).forEach((identifier) => {
                    references.push(this._findAllTemporaryArray[uuid].reference[identifier]);
                });
            }
        });
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
                (model[key] && typeof model[key] === 'object' && model[key]._repository)) {
            }
            else {
                initialData[key] = model[key];
            }
        });
        return initialData;
    }
    getData() {
        return this._findAllTemporaryArray[this._uuid] && this._findAllTemporaryArray[this._uuid]['result']
            ? this._findAllTemporaryArray[this._uuid]['result']
            : null;
    }
}
exports.AbstractRepository = AbstractRepository;
