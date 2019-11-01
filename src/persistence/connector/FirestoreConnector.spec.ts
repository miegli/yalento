import {expect} from 'chai';
import * as firebase from 'firebase/app';
import 'firebase/firestore';

import {Guid} from 'guid-typescript';
import {describe, it} from 'mocha';
import {BehaviorSubject} from "rxjs";
import {Repository} from '../Repository';

// tslint:disable-next-line:no-var-requires
require('dotenv').config();

export class Contact {
    public name: string = '';
    public lastName: string = '';
    public street: string = '';
    public age: number = 1;
}

describe('FirestoreConnectorTest', async () => {

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

    after(() => {
        fb.delete();
    });

    it('firestore should be connected to repository', async () => {

        expect(repo.connectFirestore(fb)).to.not.be.null;

    });

    it('firestore should be disconnected after destroying repository', async () => {

        expect(repo.destroy()).to.not.be.null;

    });

    it('firestore should persist data', async () => {

        const name = 'name' + Guid.create();

        expect(await repo.create({name: name}, 'test1')).to.be.deep.equal({
            name: name,
            lastName: '',
            street: '',
            age: 1,
        });

        expect(
            await repo.createMany([
                {name: name, age: 1, __uuid: 'test2'},
                {
                    name: name,
                    age: 2,
                    __uuid: 'test3',
                },
            ]),
        ).to.be.lengthOf(2);
        expect(await repo.select().getResultsAsPromise()).to.be.lengthOf(3);

        const name$ = new BehaviorSubject<string>(name);
        const repo2 = new Repository<Contact>(Contact);
        repo2.connectFirestore(fb);
        const select = repo2.select({
            where: 'name LIKE ?',
            params: [name$]
        });

        expect(
            await select.getResultsAsPromise(),
        ).to.be.lengthOf(3);

        name$.next('test');

        expect(
            await select.getResultsAsPromise(),
        ).to.be.lengthOf(0);

        repo.destroy();
    });

    it('selecting with sql in connection options should return data', async () => {

        const repo2 = new Repository<Contact>(Contact);
        repo2.connectFirestore(fb, {sql: 'SELECT * FROM Contact LIMIT 1'});
        expect(
            await repo2.select().getResultsAsPromise(),
        ).to.be.lengthOf(1);

    });

    it('firestore with wrong path option should throw error', async () => {

        repo.connectFirestore(fb, {path: '/test/test'});

        await repo.create().catch((e) => {
            expect(e.message).to.be.include('Invalid document reference');
        });


    });


});
