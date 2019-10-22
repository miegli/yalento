import { Component } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { MatDialog } from '@angular/material';
import { IPageEventSort, QueryPaginator, Repository } from '@yalento';

import 'reflect-metadata';
import { BehaviorSubject } from 'rxjs';
import { Contact } from '../../models/contact';
import { ContactDialogComponent } from '../contact-dialog/contact-dialog.component';

@Component({
  selector: 'app-contact-list',
  templateUrl: './contact-list.component.html',
  styleUrls: ['./contact-list.component.css'],
})
export class ContactListComponent {

  contactRepository: Repository<Contact>;
  searchString$: BehaviorSubject<number>;
  contactsWithPaginator: QueryPaginator<Contact>;
  displayedColumns: string[] = ['select', 'name', 'lastName', 'age', 'action'];

  constructor(public dialog: MatDialog, db: AngularFirestore) {
    this.contactRepository = new Repository(Contact, 'test');


    this.searchString$ = new BehaviorSubject<number>(0);

    this.contactRepository.connectFirestore(db);
    this.contactsWithPaginator = this.contactRepository.selectWithPaginator({
        sql: {
          limit: 3,
          orderBy: 'name DESC',
          where: 'age = ?',
          params: [this.searchString$],
        },
        paginatorDefaults: {
          pageSizeOptions: [1, 5, 10, 100],
        },
      },
    );


    this.contactsWithPaginator.results.subscribe((d: Contact[]) => {
      console.log(d);
    });

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

  add(count?: number): void {

    if (count === undefined) {
      this.contactRepository.create({ name: 'test1' });
    } else {
      this.contactRepository.createMany(Array(count).fill({
        name: 'test',
      }));
    }


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
