import { IQueryCallbackChanges, QuerySubject } from '../QuerySubject';

export class QueryPaginator<T> {

    private length: number = 0;

    constructor(querySubject: QuerySubject<T>) {
        querySubject.queryCallbackChanges$.subscribe((changes: IQueryCallbackChanges) => {
            if (changes.count !== undefined) {
                this.setLength(changes.count);
            }
        });

    }

    public getLength() {
        return this.length;
    }

    private setLength(length: number) {
        this.length = length;
    }


}
