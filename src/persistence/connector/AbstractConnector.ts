import { Repository } from '../Repository';

export abstract class AbstractConnector<T> {
  public repository: Repository<T>;

  protected constructor(repository: Repository<T>) {
    this.repository = repository;
  }
}
