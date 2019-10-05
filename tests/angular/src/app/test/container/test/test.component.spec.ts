import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { CoreModule } from '../../../core/core.module';
import { Test } from '../../model/test';
import { TestRepository } from '../../repository/test-repository';
import { ItemComponent } from '../../view/item/item.component';

import { TestComponent } from './test.component';

describe('TestComponent', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;


  const getData = async (minLength: number = 1): Promise<Test[]> => {
    return new Promise<Test[]>((resolve) => {
      component.tests$.subscribe((a: Test[]) => {
        if (a.length >= minLength) {
          fixture.detectChanges();
          resolve(a);
        }
      });
    });
  };

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [TestComponent, ItemComponent],
      imports: [CoreModule, FormsModule],
      providers: [
        TestRepository,
      ],
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add and display new model from repository by filtering with value from behaviour subject', async () => {

    const name1 = 'test2';
    await component.add(name1, name1);


    const data = await getData();
    expect(data.length).toBe(1);

    const name2 = 'test1';
    await component.add(null, name2);

    const data2 = await getData();
    expect(data2.length).toBe(2);

    component.findByLastName$.next('noname');

    const data3 = await getData(0);
    expect(data3.length).toBe(0);

    component.findByLastName$.next('test1');
    await getData();

    const data4 = await getData();
    expect(data4.length).toBe(2);

  });

  it('should persist changes after calling repository update', async () => {

    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    const data = await getData();
    expect(data.length).toBe(2);

    data.forEach((item: Test, index: number) => {
      item.name = 'testUpdated' + index;
    });

    fixture.detectChanges();

    await component.save();

    expect((await getData()).length).toBe(2);

    const json = await component.testRepository.toJson();

    expect(json[0].name).toBe('testUpdated0');
    expect(json[1].name).toBe('testUpdated1');

    expect(fixture.nativeElement.querySelector('.test-container > div:nth-child(1) > app-item').textContent).toContain('testUpdated0');
    expect(fixture.nativeElement.querySelector('.test-container > div:nth-child(2) > app-item').textContent).toContain('testUpdated1');

  });

  it('should remove from repository and from view', async () => {

    fixture = TestBed.createComponent(TestComponent);

    fixture.detectChanges();
    const data = await getData();
    expect(data.length).toBe(2);

    const promises = [];
    data.forEach((item: Test) => {
      promises.push(component.remove(item));
    });

    await Promise.all(promises);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.test-container > div:nth-child(1) > app-item')).toBe(null);

  });


});
