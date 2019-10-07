import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';
import { Contact } from '../../models/contact';

@Component({
  selector: 'app-contact-dialog',
  templateUrl: './contact-dialog.component.html',
  styleUrls: ['./contact-dialog.component.css'],
})
export class ContactDialogComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<ContactDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public contact$: BehaviorSubject<Contact>) {
  }

  ngOnInit(): void {
    this.contact$.subscribe((contact: Contact) => {
      if (!contact) {
        this.dialogRef.close();
      }
    });
  }

  save(contact: Contact) {

    contact.save(() => {
      this.close();
    });

  }

  close() {
    this.dialogRef.close();
  }

}
