export interface IConnectorInterface<T> {
  add(items: T[]): void;

  select(sql: string): void;

  disconnect(): void;
}
