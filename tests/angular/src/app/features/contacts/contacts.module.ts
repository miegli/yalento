import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoreModule } from '../../core/core.module';
import { MaterialModule } from '../../material/material.module';
import { ContactsRoutingModule } from './contacts-routing.module';
import { ContactListComponent } from './containers/contact-list/contact-list.component';
import { ContactRepository } from './repositories/contact-repository';
import { ContactComponent } from './components/contact/contact.component';
import { ContactDetailComponent } from './containers/contact-detail/contact-detail.component';
import { ContactDialogComponent } from './containers/contact-dialog/contact-dialog.component';



@NgModule({
  declarations: [ContactListComponent, ContactComponent, ContactDetailComponent, ContactDialogComponent],
  entryComponents: [ ContactDialogComponent ],
  imports: [
    ContactsRoutingModule,
    CommonModule,
    MaterialModule,
    CoreModule,
    FormsModule,
  ],
  providers: [ ContactRepository ]
})
export class ContactsModule { }
