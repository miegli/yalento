import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Contact } from '../../models/contact';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent implements OnInit {

  @Input() contact: Contact;
  @Output() submitted: EventEmitter<Contact> = new EventEmitter<Contact>();

  constructor() { }

  submit() {
    this.submitted.emit(this.contact);
  }

  ngOnInit() {
  }

}
