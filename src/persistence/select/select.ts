import {Observable, Subscriber} from 'rxjs';
import {map, take, takeUntil, takeWhile} from 'rxjs/operators';
import {QueryPaginator} from '../query/QueryPaginator';
import {IQueryCallbackChanges, QuerySubject} from '../QuerySubject';
import {IRepositoryDataCreate} from '../Repository';

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

    public getResults(): T[] {
        return this.paginator.getResults();
    }

    public getResultsAsPromise(): Promise<T[]> {
        return new Promise<T[]>(resolve => {
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

    public getResultsAsObservable(): Observable<T[]> {
        return new Observable<T[]>((observer: Subscriber<T[]>) => {

            this._subscriptions.push(this.subject.getQueryCallbackChanges().subscribe((changes: IQueryCallbackChanges) => {
                if (changes.results !== undefined) {
                    this.subject.getRepository()._zone.run(() => {
                        observer.next(this.getResults());
                    });
                }
            }));
        });
    }

    public create(data?: IRepositoryDataCreate, id?: string | number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.subject
                .getRepository()
                .create(data, id, this.subject.getSqlSelectParsed(this.subject.getSql()))
                .then((c: T) => {
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
        })
    }

}
