"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require('firebase-admin');
function getFirestore() {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
    }
    return admin.firestore();
}
exports.getFirestore = getFirestore;
