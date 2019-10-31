import { expect } from 'chai';
import * as firebase from 'firebase/app';
import 'firebase/firestore';

import { Guid } from 'guid-typescript';
import { describe, it } from 'mocha';
import { take } from 'rxjs/operators';
import { Repository } from '../Repository';

// tslint:disable-next-line:no-var-requires
require('dotenv').config();

export class Contact {
  public name: string = '';
  public lastName: string = '';
  public street: string = '';
  public age: number = 1;
}

describe('AngularFirestoreConnectorTest', async () => {
  it('angular firestore should be connected to repository', async () => {
    const name = 'name' + Guid.create();
    const repo = new Repository<Contact>(Contact);
    const fb = firebase.initializeApp(
      {
        apiKey: process.env.test_firebase_apiKey,
        authDomain: process.env.test_firebase_authDomain,
        databaseURL: process.env.test_firebase_databaseURL,
        projectId: process.env.test_firebase_projectId,
        storageBucket: process.env.test_firebase_storageBucket,
        messagingSenderId: process.env.test_firebase_messagingSenderId,
        appId: process.env.test_firebase_appId,
        measurementId: process.env.test_firebase_measurementId,
      },
      'test' + Guid.create(),
    );

    repo.connectFirestore(fb);

    expect(await repo.create({ name: name }, 'test1')).to.be.deep.equal({
      name: name,
      lastName: '',
      street: '',
      age: 1,
    });
    expect(
      await repo.createMany([
        { name: name, age: 1, __uuid: 'test2' },
        {
          name: name,
          age: 2,
          __uuid: 'test3',
        },
      ]),
    ).to.be.lengthOf(2);
    expect(await repo.select().getResultsAsPromise()).to.be.lengthOf(3);

    const repo2 = new Repository<Contact>(Contact);
    repo2.connectFirestore(fb);
    expect(
      await repo2
        .select({
          where: 'name LIKE "' + name + '"',
        })
        .getResultsAsObservable()
        .pipe(take(2))
        .toPromise(),
    ).to.be.lengthOf(3);

    repo.destroy();
  });
});
