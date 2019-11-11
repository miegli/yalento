import { GeoFirePoint } from 'geofirex/dist/index';
import { Observable } from 'rxjs';

export interface IConnectorInterface<T> {
  add(items: T[]): void;

  remove(items: T[]): void;

  update(items: T[]): void;

  select(sql: string, uuid?: string): void;

  disconnect(): void;

  getUserUuid(): Observable<string>;

  isPrivateMode(): boolean;
}
