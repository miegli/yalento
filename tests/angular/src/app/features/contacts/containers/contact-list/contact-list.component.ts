import { Component, OnInit } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Contact } from '../../models/contact';
import { ContactRepository } from '../../repositories/contact-repository';

@Component({
  selector: 'app-contact-list',
  templateUrl: './contact-list.component.html',
  styleUrls: ['./contact-list.component.css']
})
export class ContactListComponent {

  contactRepository: ContactRepository;
  contacts$: BehaviorSubject<Contact[]>;
  displayedColumns: string[] = ['select', 'name', 'lastName', 'action'];

  constructor(contactRepository: ContactRepository) {
    this.contactRepository = contactRepository;
    this.contacts$ = this.contactRepository.getAll();
  }

}
