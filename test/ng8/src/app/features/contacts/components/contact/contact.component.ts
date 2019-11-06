import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import {IEntity} from '@yalento';
import { Contact } from '../../models/contact';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent implements OnInit {

  @Input() contact: IEntity<Contact>;
  @Output() submitted: EventEmitter<IEntity<Contact>> = new EventEmitter<IEntity<Contact>>();

  constructor() { }

  submit() {
    this.submitted.emit(this.contact);
  }

  ngOnInit() {
  }

}
