import { Component } from '@angular/core';
import { MatDialog, PageEvent } from '@angular/material';

import 'reflect-metadata';
import { BehaviorSubject } from 'rxjs';
import { Repository } from '../../../../../../../../src';
import { Contact } from '../../models/contact';
import { ContactDialogComponent } from '../contact-dialog/contact-dialog.component';

@Component({
  selector: 'app-contact-list',
  templateUrl: './contact-list.component.html',
  styleUrls: ['./contact-list.component.css'],
})
export class ContactListComponent {

  contactRepository: Repository<Contact>;
  contacts$: BehaviorSubject<Contact[]> = new BehaviorSubject<Contact[]>([]);
  limit$: BehaviorSubject<number>;
  offset$: BehaviorSubject<number>;
  count$: BehaviorSubject<number>;
  searchString$: BehaviorSubject<number>;
  displayedColumns: string[] = ['select', 'name', 'lastName', 'action'];

  constructor(public dialog: MatDialog) {
    this.limit$ = new BehaviorSubject<number>(25);
    this.offset$ = new BehaviorSubject<number>(0);
    this.contactRepository = new Repository(Contact);
    this.searchString$ = new BehaviorSubject<number>(1);
    this.count$ = new BehaviorSubject<number>(0);

    for (let i = 0; i < 100; i++) {
      this.contactRepository.create({
        name: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        lastName: '' + i,
        age: i,
      });
    }

    this.contacts$ = this.contactRepository.select({
      limit: 10,
      orderBy: 'name ASC',
      where: 'age <= ? AND name LIKE ?',
      params: [this.searchString$, 'm%'],
    }, (count => {
      this.count$.next(count);
    }));

  }

  edit(contact: Contact): void {

    if (!this.dialog.getDialogById('ContactListComponent')) {
      this.dialog.open(ContactDialogComponent, {
        id: 'ContactListComponent',
        data: contact,
      });
    }
  }

  changePaginator(event: PageEvent) {
    this.limit$.next(event.pageSize);
    this.offset$.next(event.pageIndex * event.pageSize);
  }

  add(count?: number): void {


  }


}
