import {Component, OnInit} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {MatDialog} from '@angular/material';

import 'reflect-metadata';
import {BehaviorSubject} from 'rxjs';
import {Repository} from '../../../../../../../../src';
import {IPageEventSort, QueryPaginator} from '../../../../../../../../src/persistence/query/QueryPaginator';
import {Contact} from '../../models/contact';
import {ContactDialogComponent} from '../contact-dialog/contact-dialog.component';

@Component({
  selector: 'app-contact-list',
  templateUrl: './contact-list.component.html',
  styleUrls: ['./contact-list.component.css'],
})
export class ContactListComponent implements OnInit {

  contactRepository: Repository<Contact>;
  searchString$: BehaviorSubject<number>;
  contactsWithPaginator: QueryPaginator<Contact>;
  displayedColumns: string[] = ['select', 'name', 'lastName', 'age', 'action'];

  constructor(public dialog: MatDialog, db: AngularFirestore) {
    this.contactRepository = new Repository(Contact, 'test');
    this.contactRepository.connectAngularFirestore(db);
  }

  ngOnInit(): void {

    this.searchString$ = new BehaviorSubject<number>(0);

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
      this.contactRepository.create({name: 'test1'});
    } else {
      this.contactRepository.createMany(Array(count).fill({
        name: 'test'
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
