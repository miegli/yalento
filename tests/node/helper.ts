const admin = require('firebase-admin');

export function getFirestore() {

    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
    }

    return admin.firestore();
}
