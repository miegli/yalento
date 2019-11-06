import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {IEntity} from "@yalento";
import {Contact} from '../../models/contact';

@Component({
  selector: 'app-contact-dialog',
  templateUrl: './contact-dialog.component.html',
  styleUrls: ['./contact-dialog.component.css'],
})
export class ContactDialogComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<ContactDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public contact: Contact) {
  }

  ngOnInit(): void {

  }

  save(item: IEntity<Contact>) {
    console.log(item.age);
    console.log(item.save);
  }


  close() {
    this.dialogRef.close();
  }

}
