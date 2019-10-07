import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CoreModule } from './core/core.module';
import { ContactsModule } from './features/contacts/contacts.module';
import { ContactListComponent } from './features/contacts/containers/contact-list/contact-list.component';
import { TestRelationsComponent } from './test/container/test-relations/test-relations.component';
import { TestComponent } from './test/container/test/test.component';

const routes: Routes = [
  { path: 'test', component: TestComponent },
  { path: 'test-relations', component: TestRelationsComponent },
  { path: 'contacts', component: ContactListComponent }
];


@NgModule({
  declarations: [],
  imports: [
    CoreModule,
    ContactsModule,
    RouterModule.forRoot(routes)
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
