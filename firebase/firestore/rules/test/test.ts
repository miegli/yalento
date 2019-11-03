/// <reference path='../node_modules/mocha-typescript/globals.d.ts' />
import * as firebase from "@firebase/testing";
import {expect} from 'chai';
import * as fs from "fs";


/*
 * ============
 *    Setup
 * ============
 */
const projectId = "firestore-emulator-example";
const coverageUrl = `http://localhost:8080/emulator/v1/projects/${projectId}:ruleCoverage.html`;


/**
 * Creates a new app with authentication data matching the input.
 *
 * @param {object} auth the object to use for authentication (typically {uid: some-uid})
 * @return {object} the app.
 */
function authedApp(auth) {
    return firebase
        .initializeTestApp({projectId, auth})
        .firestore();
}

async function createMock(model: string, permissionRules: any, data?: any) {

    await firebase.clearFirestoreData({projectId});

    let rules = fs.readFileSync("firestoreTest.rules", "utf8");
    await firebase.loadFirestoreRules({projectId, rules});

    // create permissions data
    const db = authedApp(null);
    const permissions = db.collection(model).doc("permissions");
    await permissions.set(permissionRules);

    if (data) {
        const entityData = db.doc(model + '/data/' + model.toLowerCase() + 's/test');
        await entityData.set(data);
    }

    rules = fs.readFileSync("firestore.rules", "utf8");
    await firebase.loadFirestoreRules({projectId, rules});
}

/*
 * ============
 *  Test Cases
 * ============
 */
before(async () => {


});


after(async () => {
    await Promise.all(firebase.apps().map(app => app.delete()));
    console.log(`View rule coverage information at ${coverageUrl}\n`);
});

@suite
class MyApp {
    @test
    async "require users to log in before creating an account"() {

        await createMock("Account", {});

        const db = authedApp(null);
        const account = db.collection("Account/data/accounts").doc("testaccount");
        await firebase.assertFails(account.set({name: "name"}));
    }

    @test
    async "should let anyone create an account"() {

        await createMock("Account", {});

        const db = authedApp({uid: "testuserid"});
        const account = db.collection("Account/data/accounts").doc("testaccount");
        await firebase.assertSucceeds(
            account.set({
                name: "name"
            })
        );

    }

    @test
    async "should let users with permissions create an account"() {

        await createMock("Account", {
            create: {testuserid: true}
        });

        const db = authedApp({uid: "testuserid"});
        const account = db.collection("Account/data/accounts").doc("testaccount");
        await firebase.assertSucceeds(
            account.set({
                name: "name"
            })
        );

    }

    @test
    async "should deny users without permissions create an account"() {

        await createMock("Account", {
            create: {testuserid: false}
        });

        const db1 = authedApp({uid: "testuserid"});
        const account1 = db1.collection("Account/data/accounts").doc("testaccount");
        await firebase.assertFails(
            account1.set({
                name: "name"
            })
        );

        await createMock("Account", {
            create: {anotheruser: true}
        });

        const db2 = authedApp({uid: "testuserid"});
        const account2 = db2.collection("Account/data/accounts").doc("testaccount");
        await firebase.assertFails(
            account2.set({
                name: "name"
            })
        );

    }

    @test
    async "should let update an account only to users with write permission"() {

        await createMock("Account", {
            read: {testuserid: true},
            update: {testuserid: true},
            create: {testuserid: true},
        });
        const db = authedApp({uid: "testuserid"});
        const account = db.collection("Account/data/accounts").doc("testaccount");
        await firebase.assertSucceeds(
            account.set({
                name: "name"
            })
        );

    }

    @test
    async "should allow guest users to read an account without defined permissions"() {

        await createMock("Account", {});

        const db = authedApp(null);
        const account = db.collection("Account/data/accounts").doc("testaccount");
        await firebase.assertSucceeds(account.get());
    }

    @test
    async "should allow users list accounts data with self owenership"() {

        await createMock("Account", {}, {__owner: {test: true}, __uuid: 'test', username: 'test'});

        const db = authedApp({uid: "test"});
        const account = db.collection('Account/data/accounts').where('__owner.test', "==", true);
        await firebase.assertSucceeds(account.get());
        expect((await account.get()).docs).to.be.lengthOf(1);
    }

    @test
    async "should not allow users list accounts data without self owenership"() {

        await createMock("Account", {}, {__owner: {test2: true}, __uuid: 'test', username: 'test'});

        const db = authedApp({uid: "test"});
        const account = db.collection('Account/data/accounts').where('__owner.test', "==", true);
        await firebase.assertSucceeds(account.get());
        expect((await account.get()).docs).to.be.lengthOf(0);
    }

    @test
    async "should allow users list accounts data made for everybody"() {

        await createMock("Account", {}, {__owner: {EVERYBODY: true}, __uuid: 'test', username: 'test'});

        const db = authedApp({uid: "test"});
        const account = db.collection('Account/data/accounts').where('__owner.EVERYBODY', "==", true);
        await firebase.assertSucceeds(account.get());
        expect((await account.get()).docs).to.be.lengthOf(1);
    }

}
