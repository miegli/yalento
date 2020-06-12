import { Observable } from 'rxjs';

export interface IConnectorInterface<T> {
  add(items: T[]): Promise<any>;

  remove(items: T[]): Promise<any>;

  update(items: T[]): Promise<any>;

  select(sql: string): void;

  selectOneByIdentifier(identifier: string): Promise<any>;

  disconnect(): void;

  getUserUuid(): Observable<string>;

  isPrivateMode(): boolean;
}
