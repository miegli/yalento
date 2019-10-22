import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ContactDetailComponent } from './containers/contact-detail/contact-detail.component';

const routes: Routes = [
  { path: 'contact/:identifier', component: ContactDetailComponent },
];


@NgModule({
  declarations: [],
  imports: [
    RouterModule.forRoot(routes)
  ],
  exports: [RouterModule]
})
export class ContactsRoutingModule { }
