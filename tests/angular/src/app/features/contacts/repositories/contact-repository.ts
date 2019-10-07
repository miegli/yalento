import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { BaseRepository } from '../../../core/base-repository';
import { Contact } from '../models/contact';

@Injectable()
export class ContactRepository extends BaseRepository {

  constructor(db: AngularFirestore) {
    super(db);
    this.model = Contact;
  }

  getAll(): BehaviorSubject<Contact[]> {
    const subject = new BehaviorSubject<Contact[]>([]);

    this.find().subscribe((data: any) => {
      subject.next(data);
    });

    return subject;
  }

  getOneByIdentifier(identifier: string): BehaviorSubject<Contact> {
    const subject = new BehaviorSubject<Contact>(null);

    this._findOneByIdentifier(identifier).subscribe((data: any) => {
        subject.next(data);
    });

    return subject;
  }


}


