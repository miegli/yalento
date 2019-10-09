import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { Test } from '../../model/test';
import { TestRelations } from '../../model/test-relations';
import { TestRelationsRepository } from '../../repository/test-relations-repository';

@Component({
  selector: 'app-test-relations',
  templateUrl: './test-relations.component.html',
  styleUrls: ['./test-relations.component.css'],
})
export class TestRelationsComponent {

  testRelationsRepository: TestRelationsRepository;
  testRelations$: Observable<TestRelations[]>;
  testIdentifier: string = 'test' + new Date().getTime();

  constructor(testRelationsRepository: TestRelationsRepository) {

    this.testRelationsRepository = testRelationsRepository;
    this.testRelations$ = testRelationsRepository.find({ limit: 1, identifier: this.testIdentifier});

  }

  async addOneWithChildren(childrenCount: number): Promise<boolean> {

    return new Promise<boolean>(async (resolve) => {

      const model = await this.testRelationsRepository.add({}, this.testIdentifier);

      for (let i = 0; i < childrenCount; i++) {
        await model.add('tests');
      }
      resolve(true);

    });


  }

  move(item: Test, target: string): Promise<boolean> {

    return item.move(target);

  }

}
