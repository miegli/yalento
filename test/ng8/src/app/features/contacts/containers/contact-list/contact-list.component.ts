import {Component, OnInit} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {MatDialog} from '@angular/material';
import {IPageEventSort, Select, Repository} from '@yalento';

import 'reflect-metadata';
import {BehaviorSubject} from 'rxjs';
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
  contacts: Select<Contact>;
  displayedColumns: string[] = ['select', 'name', 'lastName', 'age', 'action'];

  constructor(public dialog: MatDialog, db: AngularFirestore) {
    this.contactRepository = new Repository<Contact>(Contact, 'test').connectFirestore(db);
    this.searchString$ = new BehaviorSubject<number>(0);
  }


  ngOnInit(): void {

    this.contacts = this.contactRepository.select({
        limit: 5,
        orderBy: 'name DESC',
        where: 'age = ?',
        params: [this.searchString$],
      },
      {
        pageSizeOptions: [1, 5, 10, 100],
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
      this.contacts.create().then();
    } else {
      this.contactRepository.createMany(Array(count).fill({
        name: 'test',
      })).then().catch();
    }


  }

  sort(e: IPageEventSort) {
    this.contacts.getPaginator().setPageSort(e);
  }

  toggleSelection(item: Contact) {
    this.contacts.getPaginator().toggleSelection(item);
  }

  getSelected() {
    console.log(this.contacts.getPaginator().getSelected());
  }

}
