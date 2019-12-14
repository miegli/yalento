import { Observable } from 'rxjs';
import { IEntity } from '../Repository';

export interface IConnectorInterface<T> {
  add(items: Array<IEntity<T>>): void;

  remove(items: Array<IEntity<T>>): void;

  update(items: Array<IEntity<T>>): void;

  select(sql: string): void;

  selectOneByIdentifier(identifier: string): Promise<any>;

  disconnect(): void;

  getUserUuid(): Observable<string>;

  isPrivateMode(): boolean;
}
