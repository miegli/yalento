import { Component } from '@angular/core';
import { MatDialog, PageEvent } from '@angular/material';
import { Repository } from '../../../../../../../../src';

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
  contacts$: BehaviorSubject<Contact[]> = new BehaviorSubject<Contact[]>([]);
  limit$: BehaviorSubject<number>;
  offset$: BehaviorSubject<number>;
  displayedColumns: string[] = ['select', 'name', 'lastName', 'action'];

  constructor(public dialog: MatDialog) {
    this.limit$ = new BehaviorSubject<number>(25);
    this.offset$ = new BehaviorSubject<number>(0);
    this.contactRepository = new Repository(Contact);
    this.contactRepository.create({ lastName: 'test'});
    this.contacts$ = this.contactRepository.watch({
      orderBy: 'age DESC',
      limit: 5
    }, (count: number, page: number) => {
      console.log(count, page);
    });



    this.contacts$.asObservable().subscribe((c: Contact[]) => {
      console.log(1, c);
    });

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
