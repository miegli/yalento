import {Repository} from '../Repository';
import {IConnectionFirestore, IParentConnection} from './FirestoreConnector';

export abstract class AbstractConnector<T> {
    public repository: Repository<T>;
    public readonly options?: IConnectionFirestore;

    protected constructor(repository: Repository<T>, options?: IConnectionFirestore) {
        this.repository = repository;
        this.options = options;
    }

    public getPath(): string {
        if (!this.options || !this.options.parent) {
            return this.repository.getClassName() + '/data/' + this.repository.getClassName().toLowerCase() + 's';
        }

        let path = '';

        this.options.parent.forEach((p: IParentConnection) => {
            const parentClassName = p.modelName.toUpperCase().substr(0, 1) + p.modelName.toLowerCase().substr(1);
            path += parentClassName + '/data/' + parentClassName.toLowerCase() + 's' + '/';
            path += p.documentId + '/';
            path += this.repository.getClassName() + '/data/' + this.repository.getClassName().toLowerCase() + 's';
        });

        return path;
    }

    public getParentDocumentPath(): string {
        const pathSegments = this.getPath().split('/');
        return pathSegments.slice(0, pathSegments.length - 3).join('/');
    }

}
