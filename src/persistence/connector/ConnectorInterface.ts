export interface IConnectorInterface<T> {
  add(items: T[]): void;

  remove(items: T[]): void;

  update(items: T[]): void;

  select(sql: string): void;

  disconnect(): void;

  getUserUuid(): string;

  isPrivateMode(): boolean;
}
