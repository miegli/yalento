import {QueryPaginator} from "../query/QueryPaginator";
import {QuerySubject} from "../QuerySubject";
import {IRepositoryDataCreate} from "../Repository";

export class Select<T> {

    private readonly subject: QuerySubject<T>;
    private readonly paginator: QueryPaginator<T>;

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

    public create(data?: IRepositoryDataCreate, id?: string | number): Promise<T> {

        return this.subject.getRepository().create(data, id, this.subject.getLastSelectSql());

    }

}