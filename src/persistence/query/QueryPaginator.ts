import { BehaviorSubject } from 'rxjs';
import { IQueryCallbackChanges, QuerySubject } from '../QuerySubject';

export interface IQueryPaginatorDefaults {
    pageSizeOptions?: number[];
    pageSize?: number;
}

export interface IPageEvent {
    /** The current page index. */
    pageIndex?: number;
    /** The previous page size */
    previousPageIndex?: number;
    /** The current page size */
    pageSize?: number;
    /** The current total number of items being paged */
    length?: number;
}

export class QueryPaginator<T> {

    private length: number = 0;
    private results: BehaviorSubject<T[]> = new BehaviorSubject<T[]>([]);
    private pageSize: number = 0;
    private pageIndex: number = 0;
    private pageSizeOptions: number[] = [];
    private _querySubject: QuerySubject<T>;
    private _hasPageSizeChanges: boolean = false;

    constructor(querySubject: QuerySubject<T>) {
        this._querySubject = querySubject;
        querySubject.getQueryCallbackChanges().subscribe((changes: IQueryCallbackChanges) => {
            if (changes.count !== undefined) {
                this.setLength(changes.count);
            }
            if (changes.results !== undefined) {
                this.setResults(changes.results);
            }
        });

    }

    public setPage(pageEvent: IPageEvent) {
        const changes: IQueryCallbackChanges = {};
        if (pageEvent.pageIndex !== undefined && pageEvent.pageIndex !== this.getPageIndex()) {
            this.pageIndex = pageEvent.pageIndex;
            changes.pageIndex = pageEvent.pageIndex;
        }
        if (pageEvent.pageSize !== undefined && pageEvent.pageSize !== this.getPageSize()) {
            this.pageSize = pageEvent.pageSize;
            this._hasPageSizeChanges = true;
            changes.pageSize = pageEvent.pageSize;
        }
        if (Object.keys(changes).length > 0) {
            this._querySubject.updateQueryCallbackChanges(changes);
        }
    }

    public setPageIndex(pageIndex: number, skipChangeDetection?: boolean) {
        this.pageIndex = pageIndex;
        if (skipChangeDetection !== true) {
            this._querySubject.updateQueryCallbackChanges({ pageIndex: pageIndex });
        }
    }

    public setPageSizeOptions(pageSizeOptions: number[]) {
        this.pageSizeOptions = pageSizeOptions;
    }

    public setPageSize(size: number, skipChangeDetection?: boolean) {
        this.pageSize = size;
        if (skipChangeDetection !== true) {
            this._hasPageSizeChanges = true;
            this._querySubject.updateQueryCallbackChanges({ pageSize: size });
        }
    }

    public getResults(): BehaviorSubject<T[]> {
        return this.results;
    }

    public getPageSize(): number {
        return this.pageSize;
    }

    public getPageSizeOptions(): number[] {
        return this.pageSizeOptions;
    }

    public getPageIndex(): number {
        return this.pageIndex;
    }

    public getLength(): number {
        return this.length;
    }

    public hasPageSizeChanges(): boolean {
        return this._hasPageSizeChanges;
    }

    public addPageSizeOption(pageSize: number) {

        this.pageSizeOptions.push(pageSize);
        this.pageSizeOptions = [...new Set(this.pageSizeOptions)];
        this.pageSizeOptions.sort((a, b) => a - b);
    }

    private setLength(length: number) {
        this.length = length;
    }

    private setResults(results: T[]) {
        this.results.next(results);
    }


}
