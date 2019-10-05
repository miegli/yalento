import { Observable } from 'rxjs';
import { AbstractModel } from '../../../../src/abstractModel';
import { TestModel2 } from './testModel2';

export class TestModel extends AbstractModel {

    testModel2: TestModel2 = new TestModel2();

    testModels2: Observable<TestModel2[]> = this.manyToOne(TestModel2, 'testModels2', { orderBy: 'name' });

    testModelsWithNameTest3: Observable<TestModel2[]> = this.manyToOne(TestModel2, 'testModelsWithNameTest3', {
        where: [{
            property: 'name',
            operation: '==',
            value: 'test3',
        }],
    });

    testModelsWithNameTest4: Observable<TestModel2[]> = this.manyToOne(TestModel2, 'testModelsWithNameTest4', {
        where: [{
            property: 'name',
            operation: '==',
            value: 'test4',
        }],
    });

}
