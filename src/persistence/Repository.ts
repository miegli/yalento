import { BehaviorSubject } from 'rxjs';
import { Base } from '..';
import { IStatement, QuerySubject } from './QuerySubject';

export type ICallback = (count: number, page: number) => void;

export interface IRepositoryData {
    _ref: any;
}

export class Repository<T> {

    private readonly _class: any;
    private readonly _constructorArguments: any;
    private readonly _subjects: any[] = [];
    private data: IRepositoryData[] = [];

    constructor(private constructor: any, ...constructorArguments: any[]) {
        this._class = constructor;
        this._constructorArguments = constructorArguments;
    }

    public watch(sql?: IStatement, callback?: ICallback): BehaviorSubject<T[]> {
        const subject = new QuerySubject<T>(this, sql, callback);
        this._subjects.push(subject);
        return subject.getBehaviourSubject();
    }


    public create(data?: any): T {

        const c = this._constructorArguments ? new this._class(...this._constructorArguments) : new this._class;

        if (data) {
            Object.keys(data).forEach((key: string) => {
                c[key] = data[key];
            });
        }

        const e: IRepositoryData = { _ref: c };
        Object.keys(c).forEach((key: string) => {
            // @ts-ignore
            e[key] = c[key];
        });
        this.data.push(e);

        return c;

    }

    public getData(): IRepositoryData[] {
        return this.data;
    }

}
