import { BehaviorSubject } from 'rxjs';
import { IQueryCallbackChanges, QuerySubject } from '../QuerySubject';

export interface IQueryPaginatorDefaults {
    pageSizeOptions?: number[];
    pageSize?: number;
    pageSort?: IPageEventSort;
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

export interface IPageEventSort {
    active: string;
    direction: 'ASC' | 'DESC';
}

export class QueryPaginator<T> {

    private length: number = 0;
    private results$: BehaviorSubject<T[]> = new BehaviorSubject<T[]>([]);
    private resultsAll: T[] = [];
    private pageSize: number = 0;
    private pageIndex: number = 0;
    private pageSizeOptions: number[] = [];
    private pageSort: IPageEventSort = { direction: 'ASC', active: '' };
    private _querySubject: QuerySubject<T>;
    private _hasPageSizeChanges: boolean = false;
    private _selected: { [key: string]: boolean } = {};
    private _isSelectedAll$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    private _isSelectedCount$: BehaviorSubject<number> = new BehaviorSubject<number>(0);

    /**
     *
     * @param querySubject
     */
    constructor(querySubject: QuerySubject<T>) {
        this._querySubject = querySubject;
        querySubject.getQueryCallbackChanges().subscribe((changes: IQueryCallbackChanges) => {
            if (changes.count !== undefined) {
                this.setLength(changes.count);
            }
            if (changes.results !== undefined && changes.resultsAll !== undefined) {
                const isSelectedAll = this.length === this.getSelectedCount().getValue() && this.getSelectedCount().getValue() > 0;
                this._isSelectedAll$.next(isSelectedAll);
                this.setResults(changes.results);
                this.resultsAll = changes.resultsAll;
                this._isSelectedCount$.next(this.countSelected());
            }
        });

    }

    /**
     *
     */
    public getSelected(): T[] {

        const selected: T[] = [];

        if (this.isSelectedAll().getValue()) {
            return this.resultsAll;
        }

        this.getResults().getValue().forEach((r: T) => {
            // @ts-ignore
            if (this._selected[r['_uuid']]) {
                selected.push(r);
                // @ts-ignore
                r['_selected'] = true;
            } else {
                // @ts-ignore
                r['_selected'] = true;
            }
        });

        return selected;

    }

    /**
     * get selected count
     */
    public getSelectedCount(): BehaviorSubject<number> {

        return this._isSelectedCount$;

    }

    /**
     *
     * @param item
     */
    public toggleSelection(item?: T) {

        if (item) {
            // @ts-ignore
            const uuid = item['_uuid'];
            this._selected[uuid] = !this._selected[uuid];
            this._isSelectedAll$.next(false);
            this._isSelectedCount$.next(this.countSelected());
            const isSelectedAll = this.length === this.getSelectedCount().getValue();
            this._isSelectedAll$.next(isSelectedAll);
        } else {

            this._isSelectedCount$.next(this.countSelected());
            if (this._isSelectedCount$.getValue() > 0 && this.isSelectedAll().getValue()) {
                Object.keys(this._selected).forEach((key: string) => {
                    this._selected[key] = false;
                });
                this._isSelectedAll$.next(false);
            } else {
                this.resultsAll.forEach((result: any) => {
                    this._selected[result['_uuid']] = true;
                });

                this._isSelectedAll$.next(true);
            }

        }

        this._isSelectedCount$.next(this.countSelected());
    }

    /**
     *
     */
    public isSelected(item: T | any): boolean {
        return this._selected[item['_uuid']] === true;
    }

    /**
     *
     */
    public isSelectedAll(): BehaviorSubject<boolean> {

        return this._isSelectedAll$;
    }

    /**
     *
     * @param pageEvent
     */
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

    /**
     *
     * @param pageIndex
     * @param skipChangeDetection
     */
    public setPageIndex(pageIndex: number, skipChangeDetection?: boolean) {
        this.pageIndex = pageIndex;
        if (skipChangeDetection !== true) {
            this._querySubject.updateQueryCallbackChanges({ pageIndex: pageIndex });
        }
    }

    /**
     *
     * @param pageSort
     */
    public setPageSort(pageSort: IPageEventSort) {
        this.pageSort = pageSort;
        this._querySubject.updateQueryCallbackChanges({ pageSort: pageSort });
    }

    /**
     *
     */
    public getPageSortProperty(): string {
        return this.pageSort.active;
    }

    /**
     *
     */
    public getPageSortDirection(): string {
        return this.pageSort.direction;
    }

    /**
     *
     * @param pageSizeOptions
     */
    public setPageSizeOptions(pageSizeOptions: number[]) {
        this.pageSizeOptions = pageSizeOptions;
    }

    /**
     *
     * @param size
     * @param skipChangeDetection
     */
    public setPageSize(size: number, skipChangeDetection?: boolean) {
        this.pageSize = size;
        if (skipChangeDetection !== true) {
            this._hasPageSizeChanges = true;
            this._querySubject.updateQueryCallbackChanges({ pageSize: size });
        }
    }

    /**
     *
     */
    public getResults(): BehaviorSubject<T[]> {
        return this.results$;
    }

    /**
     *
     */
    public getPageSize(): number {
        return this.pageSize;
    }

    /**
     *
     */
    public getPageSizeOptions(): number[] {
        return this.pageSizeOptions;
    }

    /**
     *
     */
    public getPageIndex(): number {
        return this.pageIndex;
    }

    /**
     *
     */
    public getLength(): number {
        return this.length;
    }

    /**
     *
     */
    public hasPageSizeChanges(): boolean {
        return this._hasPageSizeChanges;
    }

    /**
     *
     * @param pageSize
     */
    public addPageSizeOption(pageSize: number) {

        this.pageSizeOptions.push(pageSize);
        this.pageSizeOptions = [...new Set(this.pageSizeOptions)];
        this.pageSizeOptions.sort((a, b) => a - b);
    }

    /**
     *
     * @param length
     */
    private setLength(length: number) {
        this.length = length;
    }

    /**
     *
     * @param results
     */
    private setResults(results: T[]) {

        const selectedAll = this.isSelectedAll().getValue();
        results.forEach((result: any) => {
            if (result && this._selected[result['_uuid']] === undefined) {
                this._selected[result['_uuid']] = selectedAll;
            }
        });


        this.results$.next(results);
    }

    private countSelected(): number {

        let count = 0;

        if (this.isSelectedAll().getValue()) {
            return this.resultsAll.length;
        } else {

            this.getResults().getValue().forEach((r: T) => {
                if (r) {
                    // @ts-ignore
                    if (this._selected[r['_uuid']]) {
                        count++;
                    }
                }
            });
        }

        return count;

    }

}
