import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { CoreModule } from '../../../core/core.module';
import { Test } from '../../model/test';
import { TestRelations } from '../../model/test-relations';
import { TestRelationsRepository } from '../../repository/test-relations-repository';

import { TestRelationsComponent } from './test-relations.component';

describe('TestRelationsComponent', () => {
  let component: TestRelationsComponent;
  let fixture: ComponentFixture<TestRelationsComponent>;

  const getData = async (minLength: number = 1): Promise<TestRelations[]> => {
    return new Promise<TestRelations[]>((resolve) => {
      component.testRelations$.subscribe((a: TestRelations[]) => {
        if (a.length >= minLength) {
          fixture.detectChanges();
          resolve(a);
        }
      });
    });
  };

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [TestRelationsComponent],
      imports: [CoreModule],
      providers: [
        TestRelationsRepository,
      ],
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TestRelationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize test-relations model by constructor', async () => {
    const model = new TestRelations();
    const json = await model.toJson();
    expect(model).toBeTruthy();
    expect(json['test1']['lastName']).toBe('test1');

    const manyToOneModel: Test = await model.add('tests');
    expect(manyToOneModel).toBeTruthy();
    expect(manyToOneModel.lastName).toBe('test1');

  });

  it('should initialize test-relations model by adding to repository', async () => {
    const model = await component.testRelationsRepository.add();
    const json = await model.toJson();
    expect(model).toBeTruthy();
    expect(json['test1']['lastName']).toBe('test1');
    await component.testRelationsRepository.remove(model);

  });

  it('should move between relations', async () => {

    const model = await component.testRelationsRepository.add({}, component.testIdentifier);

    const getChildren = async (subscribable: Observable<any>, minLength: number = 1): Promise<Test[]> => {
      return new Promise<Test[]>((resolve) => {
        subscribable.subscribe((a: Test[]) => {
          if (a.length >= minLength) {
            resolve(a);
          }
        });
      });
    };

    const testsWithNameTestBefore = await getData();
    expect(testsWithNameTestBefore.length).toBe(1);
    await component.addOneWithChildren(10);

    const testsWithNameTestAfter = await getChildren(testsWithNameTestBefore[0].testsWithNameTest);
    expect(testsWithNameTestAfter.length).toBe(10);

    await component.move(testsWithNameTestAfter[0], 'testsWithNameTest1');
    const testsWithNameTestAfterMove = await getChildren(testsWithNameTestBefore[0].testsWithNameTest);
    expect(testsWithNameTestAfterMove.length).toBe(9);

    const testsWithName1TestAfter = await getChildren(testsWithNameTestBefore[0].testsWithNameTest1);
    expect(testsWithName1TestAfter.length).toBe(1);

    const allTests = await getChildren(testsWithNameTestBefore[0].tests);
    await component.testRelationsRepository.remove(allTests);
    await component.testRelationsRepository.remove(model);

  });

});
