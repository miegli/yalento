import * as functions from 'firebase-functions';
import * as firebase from 'firebase-admin';
import {Repository} from "yalento";

export class Contact {
    name: string = '';
    age: number = 0;
}

const fb = firebase.initializeApp();
const repo = new Repository<Contact>(Contact);
const select = repo.connectFirestore(fb, {realtimeMode: false}).select({where: 'age > 0'});
repo.create({age: new Date().getTime()}).then().catch();

export const helloWorld = functions.region('europe-west2').https.onRequest((request, response) => {

    select.toJson().then((json: string) => {
        response.send(json);
    }).catch((e) => {
        response.send(e.message);
    })

});
