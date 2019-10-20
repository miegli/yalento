import {Repository} from "../Repository";
import {IConnectionAngularFirestore} from "./AngularFirestoreConnector";

export abstract class AbstractConnector<T> {

    public repository: Repository<T>;
    private readonly options?: IConnectionAngularFirestore;

    protected constructor(repository: Repository<T>, options?: IConnectionAngularFirestore) {
        this.repository = repository;
        this.options = options;
    }

    public getPath(): string {
        return !this.options || !this.options.path ? this.repository.getClassName() : this.options.path;
    }


}