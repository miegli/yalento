import { Observable, Subscriber } from 'rxjs';
import { take, takeWhile } from 'rxjs/operators';
import { QueryPaginator } from '../query/QueryPaginator';
import { IQueryCallbackChanges, QuerySubject } from '../QuerySubject';
import {IEntity, IRepositoryDataCreate} from '../Repository';

export class Select<T> {
  private readonly subject: QuerySubject<T>;
  private readonly paginator: QueryPaginator<T>;
  private _subscriptions: any[] = [];

  constructor(subject: QuerySubject<T>) {
    this.subject = subject;
    this.paginator = subject.getPaginator();
  }

  public getPaginator(): QueryPaginator<T> {
    return this.paginator;
  }

  public getResults(): Array<IEntity<T>> {
    return this.paginator.getResults();
  }

  public getResultsAsPromise(): Promise<Array<IEntity<T>>> {
    return new Promise<Array<IEntity<T>>>(resolve => {
      this.subject
        .getQueryCallbackChanges()
        .pipe(
          takeWhile((changes: IQueryCallbackChanges) => {
            return changes.results === undefined;
          }),
        )
        .toPromise()
        .then(() => {
          resolve(this.getResults());
        });
      this.subject.execStatement(this.subject.getSql());
    });
  }

  public toJson(): Promise<string> {
    return new Promise<string>(resolve => {
      this.subject
        .getQueryCallbackChanges()
        .pipe(
          takeWhile((changes: IQueryCallbackChanges) => {
            return changes.results === undefined;
          }),
        )
        .toPromise()
        .then(() => {
          const results: any[] = [];
          this.getResults().forEach((r: IEntity<T>) => {
            results.push((r as any)._toPlain());
          });
          resolve(JSON.stringify(results));
        });
      this.subject.execStatement(this.subject.getSql());
    });
  }

  public getResultsAsObservable(): Observable<Array<IEntity<T>>> {
    return new Observable<Array<IEntity<T>>>((observer: Subscriber<Array<IEntity<T>>>) => {
      this._subscriptions.push(
        this.subject.getQueryCallbackChanges().subscribe((changes: IQueryCallbackChanges) => {
          if (changes.results !== undefined) {
            this.subject.getRepository()._zone.run(() => {
              observer.next(this.getResults());
            });
          }
        }),
      );
    });
  }

  public create(data?: IRepositoryDataCreate, id?: string | number): Promise<IEntity<T>> {
    return new Promise<IEntity<T>>((resolve, reject) => {
      this.subject
        .getRepository()
        .create(data, id, this.subject.getSqlSelectParsed(this.subject.getSql()))
        .then((c: IEntity<T>) => {
          this.subject
            .getQueryCallbackChanges()
            .pipe(take(1))
            .toPromise()
            .then(() => {
              resolve(c);
            });
          this.subject.execStatement(this.subject.getSql());
        });
    });
  }

  public unsubscribe() {
    this._subscriptions.forEach((sub: any) => {
      sub.unsubscribe();
    });
  }
}
