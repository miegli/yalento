import { IQueryCallbackChanges, QuerySubject } from '../QuerySubject';
import { QueryPaginator } from './QueryPaginator';


export class QueryCallback<T> {

    public paginator: QueryPaginator<T>;
    private results: T[] = [];
    private _querySubject: QuerySubject<T>;

    constructor(querySubject: QuerySubject<T>) {
        this._querySubject = querySubject;
        this.paginator = new QueryPaginator<T>(querySubject);
        querySubject.getQueryCallbackChanges().subscribe((changes: IQueryCallbackChanges) => {
            if (changes.results !== undefined) {
                this.results = changes.results;
            }
        });
    }

    public getResults(): T[] {
        return this.results;
    }


}
