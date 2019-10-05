import { Observable } from 'rxjs';
import { AbstractModel } from '../../../../src/abstractModel';
import { TestModel2 } from './testModel2';

export class TestModel extends AbstractModel {

    name: string = 'test';

    testModels: Observable<TestModel2[]> = this.manyToOne(TestModel2, 'testModels', { orderBy: 'name' });

}
