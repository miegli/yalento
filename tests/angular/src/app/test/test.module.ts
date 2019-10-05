import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoreModule } from '../core/core.module';
import { TestRelationsComponent } from './container/test-relations/test-relations.component';
import { TestComponent } from './container/test/test.component';
import { TestRelationsRepository } from './repository/test-relations-repository';
import { TestRepository } from './repository/test-repository';
import { ItemComponent } from './view/item/item.component';

@NgModule({
  declarations: [TestComponent, ItemComponent, TestRelationsComponent],
  exports: [
    TestComponent
  ],
  imports: [
    CommonModule,
    CoreModule,
    FormsModule,
  ],
  providers: [
    TestRepository,
    TestRelationsRepository
  ]
})
export class TestModule { }
