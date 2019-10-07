import { Component } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Test } from '../../model/test';
import { TestRepository } from '../../repository/test-repository';


@Component({
  selector: 'app-test',
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.css'],
})
export class TestComponent {

  tests$: Observable<Test[]>;
  testRepository: TestRepository;
  findByLastName$: BehaviorSubject<string> = new BehaviorSubject<string>('test1');

  constructor(testRepository: TestRepository) {

    this.testRepository = testRepository;
    this.tests$ = testRepository.find({ orderBy: 'name', where: [ {value: this.findByLastName$, operation: '==', property: 'lastName' } ]});

  }

  add(name?: string, identifier?: string): Promise<Test> {
    return this.testRepository.add({ name: name ? name : '', lastName: this.findByLastName$.getValue() }, identifier);
  }

  remove(item: Test): Promise<boolean> {
    return this.testRepository.remove(item);
  }

  save(item?: Test): Promise<Test> {
    return this.testRepository.update(item);
  }

}
