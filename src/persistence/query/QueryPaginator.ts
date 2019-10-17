import { IQueryCallbackChanges, QuerySubject } from '../QuerySubject';

export class QueryPaginator<T> {

    private length: number = 0;
    private results: T[] = [];

    constructor(querySubject: QuerySubject<T>) {
        querySubject.queryCallbackChanges$.subscribe((changes: IQueryCallbackChanges) => {
            if (changes.count !== undefined) {
                this.setLength(changes.count);
            }
            if (changes.results !== undefined) {
                this.setResults(changes.results);
            }
        });

    }

    public getResults() {
        return this.results;
    }

    public getPageSize() {
            //
    }

    public getLength() {
        return this.length;
    }

    private setLength(length: number) {
        this.length = length;
    }

    private setResults(results: T[]) {
        this.results = results;
    }


}
