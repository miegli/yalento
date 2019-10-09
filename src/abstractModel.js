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
const guid_typescript_1 = require("guid-typescript");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const abstractRepository_1 = require("./abstractRepository");
class AbstractModel {
    constructor() {
        this._isSelected = false;
        this._hasChanges = false;
        this._index = 0;
        this._identifier = '';
        this._repository = new (class extends abstractRepository_1.AbstractRepository {
        })();
        this._firestore$ = new rxjs_1.BehaviorSubject(null);
        this._relationsDataObserver = {};
        this._relationsData = {};
        this._relationsRepo = {};
        this._relationsWhere = {};
        this._relationsModel = {};
        this._relationName = '';
        this._dataSubject = new rxjs_1.BehaviorSubject(null);
    }
    _init(repository, data, identifier) {
        const self = this;
        this.setRepository(repository);
        this.setData(data);
        this.setIdentifier(identifier ? identifier : guid_typescript_1.Guid.create().toString());
        Object.keys(this).forEach((key) => {
            if (key.substr(0, 2) === '__') {
                if (self[key].constructor.name.substr(-10) === 'Repository') {
                    self[key].setPath(self.getRepository().getPath() + '/' + self.getIdentifier() + self[key].getPath());
                    self[key].setFirestore(self.getRepository().getFirestore());
                }
            }
            else {
                if (key.substr(0, 1) === '_') {
                }
                else if (self[key] && typeof self[key] === 'object' && self[key]._repository) {
                    self[key].createOneToOneRelation(self.getRepository().getFirestore(), self, key).subscribe((r) => {
                        const d = repository.getDataFromModel(r);
                        Object.keys(d).forEach((k) => {
                            self[key][k] = d[k];
                        });
                        self[key]._dataSubject.next(d);
                    });
                }
                else {
                }
            }
        });
        return this;
    }
    toggleSelection() {
        this.getRepository().toggleSelection(this);
    }
    setChanges(hasChanges) {
        this._hasChanges = hasChanges ? hasChanges : true;
    }
    hasChanges() {
        return this._hasChanges;
    }
    isSelected() {
        return this._isSelected;
    }
    getProperty(property) {
        return new Promise((resolve, reject) => {
            this.getProperties(property)
                .then(data => {
                if (data.length === 0) {
                    resolve([]);
                    return;
                }
                if (data[0].value &&
                    data[0].value.constructor &&
                    ('BehaviorSubject' === data[0].value.constructor.name || 'Observable' === data[0].value.constructor.name)) {
                    data[0].value.pipe(operators_1.take(1)).subscribe((d) => {
                        resolve(d);
                    });
                }
                else {
                    resolve(data[0].value);
                }
            })
                .catch(e => {
                reject(e);
            });
        });
    }
    getDataSubject() {
        return this._dataSubject;
    }
    getRelationData(property) {
        return this._relationsData[property ? property : this._relationName];
    }
    getRelationWhere(property) {
        return this._relationsWhere[property];
    }
    setRelationsRepo(targetName, repo) {
        this._relationsRepo[targetName] = repo;
    }
    getIndex() {
        return this._index;
    }
    manyToOne(model, name, query) {
        const self = this;
        const where = query && query.where ? query.where : undefined;
        this._relationsWhere[name] = where;
        this._relationsModel[name] = model;
        return new rxjs_1.Observable((observer) => {
            self._relationsDataObserver[name] = observer;
            this._firestore$.pipe(operators_1.take(1)).subscribe((firestore) => {
                const repo = this.initRelationRepository(firestore, name);
                repo.find(query, true).subscribe((result) => {
                    self._relationsData[name] = result;
                    observer.next(self._relationsData[name]);
                });
            });
        });
    }
    setRelationData(data) {
        this._relationsData[this._relationName] = data;
        this._relationsDataObserver[this._relationName].next(this._relationsData[this._relationName]);
    }
    setRelationName(name) {
        this._relationName = name;
    }
    removeItemFromRelationsData(identifier) {
        const tmp = [];
        this._relationsData[this._relationName].forEach((item) => {
            if (item.getIdentifier() !== identifier) {
                tmp.push(item);
            }
        });
        this._relationsData[this._relationName] = tmp;
        this._relationsDataObserver[this._relationName].next(this._relationsData[this._relationName]);
    }
    createOneToOneRelation(firestore, model, property) {
        const repo = new this._repository.constructor(firestore);
        repo.setModel(model[property]);
        repo.setPath(model.getRepository().getPath() +
            '/' +
            model.getIdentifier() +
            '/' +
            model[property].constructor.name.toLowerCase());
        const data = repo.getDataFromModel(model[property]);
        model[property]._init(repo, data, property);
        return new rxjs_1.Observable((observer) => {
            repo._findOneByIdentifier(property).subscribe((r) => {
                observer.next(r);
            });
        });
    }
    move(targetRelation) {
        return this.add(targetRelation, {}, this.getIdentifier(), this.getRepository(), this.getRepository()
            .getParentModel()
            .getRelationWhere(targetRelation), 'move');
    }
    add(target, data, identifier, parentRepo, parentRelationsWhere, statusAction) {
        if (target === undefined) {
            return this._repository.add(data);
        }
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            if (target && !(parentRepo === undefined ? this._relationsRepo[target] : parentRepo)) {
                this.initRelationRepository(this._firestore$.getValue(), target);
            }
            const statusActionName = statusAction === undefined ? 'add' : statusAction;
            const repo = parentRepo === undefined ? this._relationsRepo[target] : parentRepo;
            const relationsWhere = parentRelationsWhere !== undefined ? parentRelationsWhere : this._relationsWhere[target];
            const initialData = {};
            const status$ = repo.getParentModel() ? repo.getParentModel().getRepository().status$ : repo.status$;
            const statusTarget = target ? target : this;
            const promises = [];
            let statusTimeout = null;
            statusTimeout = setTimeout(() => {
                status$.next({
                    isWorking: true,
                    action: statusActionName,
                });
            }, 500);
            if (data) {
                Object.keys(data).forEach((key) => {
                    initialData[key] = data[key];
                });
            }
            if (repo) {
                if (relationsWhere !== undefined) {
                    relationsWhere.forEach((where) => {
                        if (!where.operation) {
                            where.operation = '==';
                        }
                        promises.push(new Promise(res => {
                            if (typeof where.value === 'object') {
                                where.value.pipe(operators_1.take(1)).subscribe((value) => {
                                    if (where.operation === '==') {
                                        initialData[where.property] = value;
                                    }
                                    if (where.operation === 'array-contains') {
                                        initialData[where.property] = [value];
                                    }
                                    res(value);
                                });
                            }
                            else {
                                if (where.operation === '==') {
                                    initialData[where.property] = where.value;
                                }
                                if (where.operation === 'array-contains') {
                                    initialData[where.property] = [where.value];
                                }
                                res(where.value);
                            }
                        }));
                    });
                }
                Promise.all(promises)
                    .then(() => {
                    if (identifier === undefined) {
                        repo.add(initialData, undefined, target, this).then((result) => {
                            clearTimeout(statusTimeout);
                            status$.next({
                                isWorking: false,
                                identifier: result.getIdentifier(),
                                target: result,
                                action: statusActionName,
                            });
                            resolve(result);
                        });
                    }
                    else {
                        repo
                            .update(this, initialData)
                            .then((result) => {
                            clearTimeout(statusTimeout);
                            status$.next({
                                isWorking: false,
                                identifier: result.getIdentifier(),
                                target: result,
                                action: statusActionName,
                            });
                            resolve(result);
                        })
                            .catch((e) => {
                            reject(e);
                        });
                    }
                })
                    .catch(e => {
                    clearTimeout(statusTimeout);
                    status$.next({
                        isWorking: false,
                        target: statusTarget,
                        action: statusActionName,
                        error: e,
                    });
                    reject(e);
                });
            }
            else {
                clearTimeout(statusTimeout);
                status$.next({
                    isWorking: false,
                    target: statusTarget,
                    action: statusActionName,
                    error: 'no relation found for ' + target,
                });
                reject('no relation found for ' + target);
            }
        }));
    }
    getIdentifier() {
        if (!this._identifier) {
            this._identifier = guid_typescript_1.Guid.create().toString();
        }
        return this._identifier;
    }
    setIndex(index) {
        this._index = index;
        return this;
    }
    setIdentifier(identifier) {
        this._identifier = identifier;
        return this;
    }
    getRepository() {
        return this._repository;
    }
    setRepository(repository) {
        this._repository = repository;
        this._firestore$.next(repository.getFirestore());
    }
    setData(data) {
        const self = this;
        if (!data) {
            return self;
        }
        this._index = data['_index'];
        if (data.constructor.name === 'ZoneAwarePromise') {
            data.then((d) => {
                Object.keys(d).forEach((key) => {
                    if (key.substr(0, 1) !== '_') {
                        self[key] = data[key];
                    }
                });
            });
        }
        if (data.constructor.name === 'Object') {
            Object.keys(data).forEach((key) => {
                if (key.substr(0, 1) !== '_') {
                    self[key] = data[key];
                }
            });
        }
        return this;
    }
    toJson() {
        const data = {};
        const promises = [];
        return new Promise(resolve => {
            this.getProperties()
                .then((properties) => {
                properties.forEach((property) => {
                    promises.push(new Promise(res => {
                        if (property.type === 'value') {
                            data[property.key] = property.value;
                            res();
                        }
                        else if (property.type === 'relationOneToOne') {
                            property.value._dataSubject.subscribe((e) => {
                                if (e !== null) {
                                    property.value
                                        .toJson()
                                        .then((d) => {
                                        data[property.key] = d;
                                        res();
                                    })
                                        .catch(() => {
                                        res();
                                    });
                                }
                                else {
                                    this[property.key]
                                        .toJson()
                                        .then((json) => {
                                        data[property.key] = json;
                                        res();
                                    })
                                        .catch(() => {
                                        data[property.key] = {};
                                        res();
                                    });
                                }
                            });
                        }
                        else if (property.type === 'relation') {
                            data[property.key] = [];
                            if (property.value.length) {
                                property.value.forEach((item) => {
                                    item
                                        .toJson()
                                        .then((d) => {
                                        data[property.key].push(d);
                                        if (property.value.length === data[property.key].length) {
                                            res();
                                        }
                                    })
                                        .catch(() => {
                                        res();
                                    });
                                });
                            }
                            else {
                                res();
                            }
                        }
                        else {
                            res();
                        }
                    }));
                });
                Promise.all(promises)
                    .then(() => {
                    resolve(this.sortObject(data));
                })
                    .catch(() => {
                    resolve({});
                });
            })
                .catch(() => {
                resolve({});
            });
        });
    }
    save(callback) {
        const self = this;
        this._repository
            .update(this)
            .then(() => {
            if (callback) {
                callback(self, null);
            }
        })
            .catch(e => {
            if (callback) {
                callback(self, e);
            }
        });
        return;
    }
    remove(callback) {
        const self = this;
        this._repository
            .remove(this)
            .then(() => {
            if (callback) {
                callback(self, null);
            }
        })
            .catch(e => {
            if (callback) {
                callback(self, e);
            }
        });
    }
    getProperties(property) {
        return new Promise(resolve => {
            const properties = [];
            const promises = [];
            Object.keys(this).forEach((key) => {
                if (property === undefined || property === key) {
                    promises.push(new Promise(res => {
                        if (key.substr(0, 1) !== '_') {
                            if (this.getRelationData(key)) {
                                properties.push({ key: key, type: 'relation', value: this.getRelationData(key) });
                                res();
                            }
                            else {
                                if (this[key] &&
                                    typeof this[key] === 'object' &&
                                    this[key].constructor &&
                                    'Observable' === this[key].constructor.name) {
                                    this[key].pipe(operators_1.take(1)).subscribe((d) => {
                                        if (this.getRelationData(key)) {
                                            properties.push({
                                                key: key,
                                                type: 'relation',
                                                value: this.getRelationData(key),
                                            });
                                        }
                                        else {
                                            properties.push({ key: key, type: 'value', value: this[key] });
                                        }
                                        res();
                                    });
                                }
                                else if (this[key] && typeof this[key] === 'object' && this[key]._repository) {
                                    properties.push({ key: key, type: 'relationOneToOne', value: this[key] });
                                    res();
                                }
                                else {
                                    properties.push({ key: key, type: 'value', value: this[key] });
                                    res();
                                }
                            }
                        }
                        else {
                            res();
                        }
                    }));
                }
            });
            Promise.all(promises)
                .then(() => {
                resolve(properties);
            })
                .catch(() => {
                resolve([]);
            });
        });
    }
    sortObject(obj) {
        const objSortedKeys = {};
        Object.keys(obj)
            .sort()
            .forEach((key) => {
            objSortedKeys[key] = obj[key];
        });
        return objSortedKeys;
    }
    initRelationRepository(firestore, name) {
        const repo = new this._repository.constructor(firestore);
        const m = new this._relationsModel[name]();
        repo.setPath(this.getRepository().getPath() + '/' + this.getIdentifier() + '/' + m.constructor.name.toLowerCase());
        repo.setParentModel(this);
        repo.setModel(this._relationsModel[name]);
        this._relationsRepo[name] = repo;
        return repo;
    }
}
exports.AbstractModel = AbstractModel;
