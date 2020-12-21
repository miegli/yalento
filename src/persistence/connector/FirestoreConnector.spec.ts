import { expect } from 'chai';
import firebase from 'firebase/app';
import 'firebase/firestore';
import { describe, it } from 'mocha';
import { Repository } from '../Repository';

export class Contact {
  public name: string = '';
  public lastName: string = '';
  public street: string = '';
  public age: number = 1;
}

describe('FirestoreConnectorTest', async () => {
  const repo = new Repository<Contact>(Contact, 'Contact');
  const fb = firebase.initializeApp({
    apiKey: process.env.test_firebase_apiKey,
    authDomain: process.env.test_firebase_authDomain,
    databaseURL: process.env.test_firebase_databaseURL,
    projectId: process.env.test_firebase_projectId,
    storageBucket: process.env.test_firebase_storageBucket,
    messagingSenderId: process.env.test_firebase_messagingSenderId,
    appId: process.env.test_firebase_appId,
    measurementId: process.env.test_firebase_measurementId,
  });

  after(() => {
    fb.delete();
  });

  it('firestore should be disconnected after destroying repository', async () => {
    expect(repo.destroy()).to.not.be.null;
  });
});
