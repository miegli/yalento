import { AbstractModel } from '../../../../src/abstractModel';
import { TestModel3 } from './testModel3';

export class TestModel2 extends AbstractModel {

    name: string = 'test';
    lastName: string = 'test';

    testModel3: TestModel3 = new TestModel3();

}
