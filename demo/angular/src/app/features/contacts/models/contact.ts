import {AngularFirestore} from '@angular/fire/firestore';

export class Contact {

  public name = '';
  public lastName = '';
  public age = 0;
  public myObject: { test: string } = { test: 'hallo'};

  constructor(name: string, private db: AngularFirestore) {
    this.name = name;
  }

  public getFirestore(): AngularFirestore {
    return this.db;
  }


}
