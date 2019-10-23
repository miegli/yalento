import { QuerySubject } from '../QuerySubject';
import { QueryPaginator } from './QueryPaginator';

export class QueryCallback<T> {

    public paginator: QueryPaginator<T>;

    constructor(querySubject: QuerySubject<T>) {
        this.paginator = new QueryPaginator<T>(querySubject);
    }

    public getResults(): T[] {
        return this.paginator.results;
    }


}
