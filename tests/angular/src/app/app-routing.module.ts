import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { TestRelationsComponent } from './test/container/test-relations/test-relations.component';
import { TestComponent } from './test/container/test/test.component';

const routes: Routes = [
  { path: 'test', component: TestComponent },
  { path: 'test-relations', component: TestRelationsComponent }
];


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forRoot(routes)
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
