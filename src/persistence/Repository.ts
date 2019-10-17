import { Guid } from "guid-typescript";
import { BehaviorSubject } from 'rxjs';
import { IStatement, QuerySubject } from './QuerySubject';

export type ICallback = (count: number, page: number) => void;


export interface IRepositoryData {
    _ref: any;
}

export interface IRepositoryDataCreate {
    [key: string]: any
}

export interface IClassProperty {
    name: string;
}

/**
 * Repository class
 * This class can be instantiated by new constructor.
 * You should not inject this class via singleton or provider
 * unless you know what you are doing.
 */
export class Repository<T> {

    private readonly _instanceIdentifier: any;
    private readonly _class: any;
    private readonly _classProperties: IClassProperty[] = [];
    private readonly _constructorArguments: any;
    private readonly _subjects: any[] = [];
    private _tempData: IRepositoryData[] = [];

    /**
     * construct new repository instance, this class should not be used as singleton
     * @param constructor
     * @param constructorArguments
     */
    constructor(private constructor: any, ...constructorArguments: any[]) {
        this._class = constructor;
        this._constructorArguments = constructorArguments;
        this._instanceIdentifier = Guid.create().toString().replace(/-/g, '');
    }

    /**
     * perform sql statement and return behaviour subject as observable results
     * @param sql
     * @param callback
     */
    public select(sql?: IStatement, callback?: ICallback): BehaviorSubject<T[]> {
        const subject = new QuerySubject<T>(this, sql, callback);
        this._subjects.push(subject);
        return subject.getBehaviourSubject();
    }

    /**
     * create entity of given repository
     * @param data
     */
    public create(data?: IRepositoryDataCreate): T {

        const c = this._constructorArguments.length ? new this._class(...this._constructorArguments) : new this._class;

        if (data) {
            Object.keys(data).forEach((key: string) => {
                c[key] = data[key];
            });
        }

        this._tempData.push({ _ref: c });

        return c;

    }

    /**
     * create many entities of given repository
     * @param data[]
     */
    public createMany(data: IRepositoryDataCreate[]): T[] {

        const added: T[] = [];

        data.forEach(value => {
            added.push(this.create(value));
        });

        return added;

    }

    /**
     * INTERNAL USE ONLY: return temp repository data
     */
    public getTempData(): IRepositoryData[] {
        return this._tempData;
    }

    /**
     * INTERNAL USE ONLY: reset temp repository data
     */
    public resetTempData() {
        this._tempData = [];
    }

    /**
     * INTERNAL USE ONLY: return temporary identifier
     */
    public getInstanceIdentifier(): string {
        return this._instanceIdentifier;
    }

    /**
     * INTERNAL USE ONLY: return temporary identifier
     */
    public getClassProperties(): IClassProperty[] {

        if (this._classProperties.length) {
            return this._classProperties;
        }
        const keys = Object.keys(this._constructorArguments.length ? new this._class(...this._constructorArguments) : new this._class);

        keys.forEach((property: string) => {
            this._classProperties.push({ name: property });
        })

        return this._classProperties;

    }


}
