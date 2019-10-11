import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
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
  limit$: BehaviorSubject<number>;
  offset$: BehaviorSubject<number>;
  displayedColumns: string[] = ['select', 'name', 'lastName', 'action'];

  constructor(contactRepository: ContactRepository, public dialog: MatDialog) {
    this.contactRepository = contactRepository.createInstance(this);
    this.limit$ = new BehaviorSubject<number>(this.contactRepository.getState('limit$', 25));
    this.offset$ = new BehaviorSubject<number>(this.contactRepository.getState('offset$', 0));
    this.contacts$ = this.contactRepository.getAll(this.limit$, this.offset$);
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
    this.offset$.next(event.pageIndex * event.pageSize);
  }

  add(count?: number): void {

    if (count && count > 1) {
      this.contactRepository.addMultiple(count).then();
    } else {
      this.contactRepository.add().then((contact: Contact) => {
        this.edit(contact);
      });
    }

  }


}
