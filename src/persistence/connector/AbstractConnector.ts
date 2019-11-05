import { Repository } from '../Repository';
import { IConnectionFirestore } from './FirestoreConnector';

export abstract class AbstractConnector<T> {
  public repository: Repository<T>;
  public readonly options?: IConnectionFirestore;

  protected constructor(repository: Repository<T>, options?: IConnectionFirestore) {
    this.repository = repository;
    this.options = options;
  }

  public getPath(): string {
    return !this.options || !this.options.path
      ? this.repository.getClassName() + '/data/' + this.repository.getClassName().toLowerCase() + 's'
      : this.options.path;
  }
}
