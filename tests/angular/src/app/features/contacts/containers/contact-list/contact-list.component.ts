import { Component } from '@angular/core';
import { MatDialog, PageEvent } from '@angular/material';
import { BehaviorSubject } from 'rxjs';
import { Contact } from '../../models/contact';
import { ContactRepository } from '../../repositories/contact-repository';
import { ContactDialogComponent } from '../contact-dialog/contact-dialog.component';

@Component({
  selector: 'app-contact-list',
  templateUrl: './contact-list.component.html',
  styleUrls: ['./contact-list.component.css'],
})
export class ContactListComponent {

  contactRepository: ContactRepository;
  contacts$: BehaviorSubject<Contact[]>;
  limit$: BehaviorSubject<number> = new BehaviorSubject<number>(10);
  displayedColumns: string[] = ['select', 'name', 'lastName', 'action'];

  constructor(contactRepository: ContactRepository, public dialog: MatDialog) {
    this.contactRepository = contactRepository;
    this.contacts$ = this.contactRepository.getAll(this.limit$);
  }

  edit(contact: Contact): void {

    if (!this.dialog.getDialogById('ContactListComponent')) {
      this.dialog.open(ContactDialogComponent, {
        id: 'ContactListComponent',
        data: this.contactRepository.getOneByIdentifier(contact.getIdentifier()),
      });
    }
  }

  changePaginator(event: PageEvent) {
    this.limit$.next(event.pageSize);
    console.log(event);
  }

  add(): void {

    this.contactRepository.add().then((contact: Contact) => {
      this.edit(contact);
    });

  }

}
