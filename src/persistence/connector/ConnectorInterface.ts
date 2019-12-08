import {Observable} from 'rxjs';

export interface IConnectorInterface<T> {
    add(items: T[]): void;

    remove(items: T[]): void;

    update(items: T[]): void;

    select(sql: string): void;

    selectOneByIdentifier(identifier: string): Promise<T>;

    disconnect(): void;

    getUserUuid(): Observable<string>;

    isPrivateMode(): boolean;
}
