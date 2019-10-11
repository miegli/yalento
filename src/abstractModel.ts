import { Guid } from 'guid-typescript';
import { BehaviorSubject, Observable, Observer } from 'rxjs';
import { take } from 'rxjs/operators';
import { AbstractRepository, IQuery, IWhere } from './abstractRepository';

export interface IModelProperty {
  type: 'value' | 'relation' | 'relationOneToOne';
  value: any;
  key: string;
}

export abstract class AbstractModel {
  public _isSelected: boolean = false;
  private _hasChanges: boolean = false;
  private _index: number = 0;
  private _identifier: string = '';
  private _repository: AbstractRepository|null = null;
  private _firestore$: BehaviorSubject<any> = new BehaviorSubject(null);
  private _relationsDataObserver: { [key: string]: any } = {};
  private _relationsData: { [key: string]: any } = {};
  private _relationsRepo: { [key: string]: any } = {};
  private _relationsWhere: { [key: string]: any } = {};
  private _relationsModel: { [key: string]: any } = {};
  private _relationName: string = '';
  private _dataSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  public _init(repository: AbstractRepository, data?: any, identifier?: string | null): any {
    const self = this;

    this.setRepository(repository);
    this.setData(data);
    this.setIdentifier(identifier ? identifier : Guid.create().toString());

    Object.keys(this).forEach((key: string) => {
      if (key.substr(0, 2) === '__') {
        // @ts-ignore
        if (self[key].constructor.name.substr(-10) === 'Repository') {
          // @ts-ignore
          self[key].setPath(self.getRepository().getPath() + '/' + self.getIdentifier() + self[key].getPath());
          // @ts-ignore
          self[key].setFirestore(self.getRepository().getFirestore());
        }
      } else {
        if (key.substr(0, 1) === '_') {
          // @ts-ignore
        } else if (self[key] && typeof self[key] === 'object' && self[key]._repository) {
          // @ts-ignore
          self[key].createOneToOneRelation(self.getRepository().getFirestore(), self, key).subscribe((r: any) => {
            // @ts-ignore
            const d: any = repository.getDataFromModel(r);
            Object.keys(d).forEach((k: string) => {
              // @ts-ignore
              self[key][k] = d[k];
            });
            // @ts-ignore
            self[key]._dataSubject.next(d);
          });
        } else {
          // skip;
        }
      }
    });

    return this;
  }

  public toggleSelection() {
    this.getRepository().toggleSelection(this);
  }

  public setChanges(hasChanges?: boolean): void {
    this._hasChanges = hasChanges ? hasChanges : true;
  }

  public hasChanges() {
    return this._hasChanges;
  }

  public isSelected() {
    return this._isSelected;
  }

  public getProperty(property: string): Promise<any> {
    return new Promise<any>((resolve: any, reject: any) => {
      this.getProperties(property)
        .then(data => {
          if (data.length === 0) {
            resolve([]);
            return;
          }
          if (
            data[0].value &&
            data[0].value.constructor &&
            ('BehaviorSubject' === data[0].value.constructor.name || 'Observable' === data[0].value.constructor.name)
          ) {
            data[0].value.pipe(take(1)).subscribe((d: any) => {
              resolve(d);
            });
          } else {
            resolve(data[0].value);
          }
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  public getDataSubject() {
    return this._dataSubject;
  }

  public getRelationData(property?: string): any {
    return this._relationsData[property ? property : this._relationName];
  }

  public getRelationWhere(property: string): any {
    return this._relationsWhere[property];
  }

  public setRelationsRepo(targetName: string, repo: AbstractRepository | any): void {
    this._relationsRepo[targetName] = repo;
  }

  public getIndex(): number {
    return this._index;
  }

  public manyToOne(model: AbstractModel | any, name: string, query?: IQuery): any {
    const self = this;
    const where = query && query.where ? query.where : undefined;
    this._relationsWhere[name] = where;
    this._relationsModel[name] = model;

    return new Observable((observer: Observer<any>) => {
      self._relationsDataObserver[name] = observer;

      this._firestore$.pipe(take(1)).subscribe((firestore: any) => {
        const repo = this.initRelationRepository(firestore, name);
        repo.find(query, true).subscribe((result: any) => {
          self._relationsData[name] = result;
          observer.next(self._relationsData[name]);
        });
      });
    });
  }

  public setRelationData(data: any) {
    this._relationsData[this._relationName] = data;
    this._relationsDataObserver[this._relationName].next(this._relationsData[this._relationName]);
  }

  public setRelationName(name: string) {
    this._relationName = name;
  }

  public removeItemFromRelationsData(identifier: string) {
    const tmp: any[] = [];
    this._relationsData[this._relationName].forEach((item: AbstractModel) => {
      if (item.getIdentifier() !== identifier) {
        tmp.push(item);
      }
    });
    this._relationsData[this._relationName] = tmp;
    this._relationsDataObserver[this._relationName].next(this._relationsData[this._relationName]);
  }

  public createOneToOneRelation(firestore: any, model: AbstractModel, property: string): Observable<any> {

    // @ts-ignore
    const repo: any = new this._repository.constructor(firestore);
    // @ts-ignores
    repo.setModel(model[property]);
    // @ts-ignore
    repo.setPath(
      model.getRepository().getPath() +
        '/' +
        model.getIdentifier() +
        '/' +
        // @ts-ignore
        model[property].constructor.name.toLowerCase(),
    );
    // @ts-ignore
    const data: any = repo.getDataFromModel(model[property]);
    // @ts-ignore
    model[property]._init(repo, data, property);

    return new Observable((observer: Observer<any>) => {
      repo._findOneByIdentifier(property).subscribe((r: any) => {
        observer.next(r);
      });
    });
  }

  public move(targetRelation: string): Promise<boolean> {
    return this.add(
      targetRelation,
      {},
      this.getIdentifier(),
      this.getRepository(),
      this.getRepository()
        .getParentModel()
        .getRelationWhere(targetRelation),
      'move',
    );
  }

  public add(
    target?: string,
    data?: { [key: string]: any },
    identifier?: string,
    parentRepo?: AbstractRepository,
    parentRelationsWhere?: IWhere[] | undefined,
    statusAction?: string,
  ): Promise<any> {
    if (target === undefined) {
      return this._repository.add(data);
    }

    return new Promise(async (resolve, reject) => {
      if (target && !(parentRepo === undefined ? this._relationsRepo[target] : parentRepo)) {
        this.initRelationRepository(this._firestore$.getValue(), target);
      }

      const statusActionName = statusAction === undefined ? 'add' : statusAction;
      const repo = parentRepo === undefined ? this._relationsRepo[target] : parentRepo;
      const relationsWhere = parentRelationsWhere !== undefined ? parentRelationsWhere : this._relationsWhere[target];
      const initialData: { [key: string]: any } = {};
      const status$ = repo.getParentModel() ? repo.getParentModel().getRepository().status$ : repo.status$;
      const statusTarget = target ? target : this;
      const promises: any = [];
      let statusTimeout: any = null;

      statusTimeout = setTimeout(() => {
        status$.next({
          isWorking: true,
          action: statusActionName,
        });
      }, 500);

      if (data) {
        Object.keys(data).forEach((key: string) => {
          initialData[key] = data[key];
        });
      }

      if (repo) {
        if (relationsWhere !== undefined) {
          relationsWhere.forEach((where: IWhere) => {
            if (!where.operation) {
              where.operation = '==';
            }

            promises.push(
              new Promise(res => {
                if (typeof where.value === 'object') {
                  // TODO: implement all where operations
                  where.value.pipe(take(1)).subscribe((value: any) => {
                    if (where.operation === '==') {
                      initialData[where.property] = value;
                    }
                    if (where.operation === 'array-contains') {
                      initialData[where.property] = [value];
                    }
                    res(value);
                  });
                } else {
                  if (where.operation === '==') {
                    initialData[where.property] = where.value;
                  }
                  if (where.operation === 'array-contains') {
                    initialData[where.property] = [where.value];
                  }
                  res(where.value);
                }
              }),
            );
          });
        }

        Promise.all(promises)
          .then(() => {
            if (identifier === undefined) {
              repo.add(initialData, undefined, target, this).then((result: any) => {
                clearTimeout(statusTimeout);
                status$.next({
                  isWorking: false,
                  identifier: result.getIdentifier(),
                  target: result,
                  action: statusActionName,
                });
                resolve(result);
              });
            } else {
              repo
                .update(this, initialData)
                .then((result: any) => {
                  clearTimeout(statusTimeout);
                  status$.next({
                    isWorking: false,
                    identifier: result.getIdentifier(),
                    target: result,
                    action: statusActionName,
                  });

                  resolve(result);
                })
                .catch((e: any) => {
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
      } else {
        clearTimeout(statusTimeout);
        status$.next({
          isWorking: false,
          target: statusTarget,
          action: statusActionName,
          error: 'no relation found for ' + target,
        });

        reject('no relation found for ' + target);
      }
    });
  }

  public getIdentifier(): string {
    if (!this._identifier) {
      this._identifier = Guid.create().toString();
    }
    return this._identifier;
  }

  public setIndex(index: number): any {
    this._index = index;
    return this;
  }

  public setIdentifier(identifier: string): any {
    this._identifier = identifier;
    return this;
  }

  public getRepository(): AbstractRepository {
    if (!this._repository) {
      this._repository = this.createRepository();
    }

    return this._repository;
  }

  public setRepository(repository: AbstractRepository): any {
    if (!repository) {
      this._repository = this.createRepository();
    } else {
      this._repository = repository;
    }
    this._firestore$.next(repository.getFirestore());
  }

  public setData(data?: any): any {
    const self = this;

    if (!data) {
      return self;
    }

    this._index = data['_index'];

    if (data.constructor.name === 'ZoneAwarePromise') {
      data.then((d: any) => {
        Object.keys(d).forEach((key: string) => {
          if (key.substr(0, 1) !== '_') {
            // @ts-ignore
            self[key] = data[key];
          }
        });
      });
    }

    if (data.constructor.name === 'Object') {
      Object.keys(data).forEach((key: string) => {
        if (key.substr(0, 1) !== '_') {
          // @ts-ignore
          self[key] = data[key];
        }
      });
    }

    return this;
  }

  public toJson(nonRecursive?: boolean): Promise<any> {
    const data: any = {};
    const promises: any = [];

    return new Promise(resolve => {
      this.getProperties()
        .then((properties: IModelProperty[]) => {
          properties.forEach((property: IModelProperty) => {
            promises.push(
              new Promise(res => {
                if (property.type === 'value') {
                  data[property.key] = property.value;
                  res();
                } else if (property.type === 'relationOneToOne' && nonRecursive !== true) {
                  property.value._dataSubject.subscribe((e: any) => {
                    if (e !== null) {
                      property.value
                        .toJson()
                        .then((d: any) => {
                          data[property.key] = d;
                          res();
                        })
                        .catch(() => {
                          res();
                        });
                    } else {
                      // @ts-ignore
                      this[property.key]
                        .toJson()
                        .then((json: any) => {
                          data[property.key] = json;
                          res();
                        })
                        .catch(() => {
                          data[property.key] = {};
                          res();
                        });
                    }
                  });
                } else if (property.type === 'relation' && nonRecursive !== true) {
                  data[property.key] = [];
                  if (property.value.length) {
                    property.value.forEach((item: AbstractModel) => {
                      item
                        .toJson()
                        .then((d: any) => {
                          data[property.key].push(d);
                          if (property.value.length === data[property.key].length) {
                            res();
                          }
                        })
                        .catch(() => {
                          res();
                        });
                    });
                  } else {
                    res();
                  }
                } else {
                  res();
                }
              }),
            );
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

  public save(callback?: (model: any, error?: any) => void): void {
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

  public remove(callback?: (model: any, error?: any) => void): void {
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

  public getProperties(property?: string): Promise<IModelProperty[]> {
    return new Promise(resolve => {
      const properties: IModelProperty[] = [];
      const promises: any = [];

      Object.keys(this).forEach((key: string) => {
        if (property === undefined || property === key) {
          promises.push(
            new Promise(res => {
              if (key.substr(0, 1) !== '_') {
                if (this.getRelationData(key)) {
                  // @ts-ignore
                  properties.push({ key: key, type: 'relation', value: this.getRelationData(key) });
                  res();
                } else {
                  if (
                    // @ts-ignore
                    this[key] &&
                    // @ts-ignore
                    typeof this[key] === 'object' &&
                    // @ts-ignore
                    this[key].constructor &&
                    // @ts-ignore
                    'Observable' === this[key].constructor.name
                  ) {
                    // @ts-ignore
                    this[key].pipe(take(1)).subscribe((d: any) => {
                      if (this.getRelationData(key)) {
                        properties.push({
                          key: key,
                          type: 'relation',
                          value: this.getRelationData(key),
                        });
                      } else {
                        // @ts-ignore
                        properties.push({ key: key, type: 'value', value: this[key] });
                      }

                      res();
                    });
                    // @ts-ignore
                  } else if (this[key] && typeof this[key] === 'object' && this[key]._repository) {
                    // @ts-ignore
                    properties.push({ key: key, type: 'relationOneToOne', value: this[key] });
                    res();
                  } else {
                    // @ts-ignore
                    properties.push({ key: key, type: 'value', value: this[key] });
                    res();
                  }
                }
              } else {
                res();
              }
            }),
          );
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

  private sortObject(obj: any): any {
    const objSortedKeys: any = {};

    Object.keys(obj)
      .sort()
      .forEach((key: any) => {
        objSortedKeys[key] = obj[key];
      });

    return objSortedKeys;
  }


  private createRepository() {
    return new (class extends AbstractRepository {})();
  }

  /**
   *
   * @param firestore
   * @param name
   */
  private initRelationRepository(firestore: any, name: string): AbstractRepository {

    if (!this._repository) {
      this._repository = this.createRepository();
    }

    // @ts-ignore
    const repo: any = new this._repository.constructor(firestore);
    // @ts-ignore
    const m = new this._relationsModel[name]();
    // @ts-ignore
    repo.setPath(this.getRepository().getPath() + '/' + this.getIdentifier() + '/' + m.constructor.name.toLowerCase());
    repo.setParentModel(this);
    repo.setModel(this._relationsModel[name]);
    this._relationsRepo[name] = repo;
    return repo;
  }
}
