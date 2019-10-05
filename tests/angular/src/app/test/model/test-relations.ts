import { Observable } from 'rxjs';
import { BaseModel } from '../../core/base-model';
import { Test } from './test';

export class TestRelations extends BaseModel {

  name: string = 'test1';

  test1: Test = new Test();

  tests: Observable<Test[]> = this.manyToOne(Test, 'tests');

  testsWithNameTest: Observable<Test[]> = this.manyToOne(Test, 'testsWithNameTest', {
    where: [{
      property: 'name',
      value: 'test1',
    },
      {
        property: 'lastName',
        value: 'test1',
      }],
    limit: 10,
  });

  testsWithNameTest1: Observable<Test[]> = this.manyToOne(Test, 'testsWithNameTest1', {
    where: [{
      property: 'name',
      value: 'test21',
    }, {
      property: 'lastName',
      value: 'testsWithNameTest1',
    }],
    limit: 10,
  });

}
