import { AbstractRepository } from '../../../../src/abstractRepository';
import { TestModel } from './testModel';

export class TestRepository extends AbstractRepository {

    path = '/testModel';
    model = TestModel;

}
