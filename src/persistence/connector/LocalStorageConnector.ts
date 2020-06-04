import { Observable, of } from 'rxjs';
import { IEntity, Repository } from '../Repository';
import { AbstractConnector } from './AbstractConnector';
import { IConnectorInterface } from './ConnectorInterface';

export interface IConnectionLocalStorage {
  debug?: boolean;
}

export interface IStorage {
  /**
   * Get the name of the driver being used.
   * @returns Name of the driver
   */
  readonly driver: string | null;

  /**
   * Get the value associated with the given key.
   * @param key the key to identify this value
   * @returns Returns a promise with the value of the given key
   */
  get(key: string): Promise<any>;

  /**
   * Set the value for the given key.
   * @param key the key to identify this value
   * @param value the value for this key
   * @returns Returns a promise that resolves when the key and value are set
   */
  set(key: string, value: any): Promise<any>;

  /**
   * Remove any value associated with this key.
   * @param key the key to identify this value
   * @returns Returns a promise that resolves when the value is removed
   */
  remove(key: string): Promise<any>;

  /**
   * Clear the entire key value store. WARNING: HOT!
   * @returns Returns a promise that resolves when the store is cleared
   */
  clear(): Promise<void>;

  /**
   * @returns Returns a promise that resolves with the number of keys stored.
   */
  length(): Promise<number>;

  /**
   * @returns Returns a promise that resolves with the keys in the store.
   */
  keys(): Promise<string[]>;

  /**
   * Iterate through each key,value pair.
   * @param iteratorCallback a callback of the form (value, key, iterationNumber)
   * @returns Returns a promise that resolves when the iteration has finished.
   */
  forEach(iteratorCallback: (value: any, key: string, iterationNumber: number) => any): Promise<void>;
}

export class LocalStorageConnector<T> extends AbstractConnector<T> implements IConnectorInterface<IEntity<T>> {
  public readonly options: IConnectionLocalStorage;

  private storage: IStorage;
  private lastSql: string = '';

  constructor(repository: Repository<T>, storage: IStorage, options?: IConnectionLocalStorage) {
    super(repository);
    this.options = options ? options : {};
    this.storage = storage;
  }

  public add(items: IEntity<T>[]): void {
    const promises: any[] = [];
    items.forEach((item: IEntity<T>) => {
      promises.push(this.storage.set(item.getUuid(), { ...item._toPlain(), __timestamp: new Date().getTime() }));
    });

    Promise.all(promises).then();
  }

  public remove(items: IEntity<T>[]): void {
    const promises: any[] = [];
    items.forEach((item: IEntity<T>) => {
      promises.push(this.storage.remove(item.getUuid()));
    });

    Promise.all(promises).then();
  }

  public update(items: IEntity<T>[]): void {
    this.add(items);
  }

  public select(sql: string): void {
    if (this.lastSql !== sql) {
      const results: any = [];
      this.storage
        .forEach((value, key, iterationNumber) => {
          results.push(value);
        })
        .then(() => {
          this.repository
            .createMany(results, '', 'localStorage')
            .then()
            .catch((e) => {
              throw e;
            });
        });
    }

    this.lastSql = sql;
  }

  public selectOneByIdentifier(identifier: string): Promise<IEntity<T>> {
    return new Promise<IEntity<T>>((resolve) => {
      this.storage.get(identifier).then((value) => {
        if (value) {
          this.repository
            .create(value, identifier, undefined, 'localStorage')
            .then((e) => {
              resolve(e);
            })
            .catch(() => {
              resolve();
            });
        } else {
          resolve();
        }
      });
    });
  }

  public disconnect(): void {
    // no implementation needed
  }

  public getUserUuid(): Observable<string> {
    return of('');
  }

  public isPrivateMode(): boolean {
    return false;
  }
}
