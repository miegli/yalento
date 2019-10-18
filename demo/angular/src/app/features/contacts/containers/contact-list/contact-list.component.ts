import { Component } from '@angular/core';
import { MatDialog, PageEvent } from '@angular/material';

import 'reflect-metadata';
import { BehaviorSubject } from 'rxjs';
import { Repository } from '../../../../../../../../src';
import { IPageEventSort, QueryPaginator } from '../../../../../../../../src/persistence/query/QueryPaginator';
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
  searchString$: BehaviorSubject<number>;
  contactsWithPaginator: QueryPaginator<Contact>;
  displayedColumns: string[] = ['select', 'name', 'lastName', 'age', 'action'];

  constructor(public dialog: MatDialog) {
    this.contactRepository = new Repository(Contact);

    this.searchString$ = new BehaviorSubject<number>(10);

    for (let i = 0; i < 10; i++) {
      this.contactRepository.create({
        name: i,
        lastName: '' + i,
        age: i,
      });
    }

    this.contactsWithPaginator = this.contactRepository.selectWithPaginator({
        sql: {
          limit: 3,
          orderBy: 'name DESC',
          where: 'age <= ?',
          params: [this.searchString$],
        },
        paginatorDefaults: {
          pageSizeOptions: [1, 5, 10, 100],
        },
      },
    );

  }

  edit(contact: Contact): void {
    return;
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

  sort(e: IPageEventSort) {
    this.contactsWithPaginator.setPageSort(e);
  }

  toggleSelection(item: Contact) {
    this.contactsWithPaginator.toggleSelection(item);
  }

  getSelected() {
    console.log(this.contactsWithPaginator.getSelected());
  }

}
