import {IEntity} from "../Repository";

export interface IConnectorInterface<T> {
    add(items: Array<IEntity<T>>): void;

    remove(items: Array<IEntity<T>>): void;

    update(items: Array<IEntity<T>>): void;

    select(sql: string): void;

    disconnect(): void;

    getUserUuid(): string;

    isPrivateMode(): boolean;
}
