[![Build Status](https://travis-ci.com/miegli/yalento.svg?branch=master)](https://travis-ci.com/miegli/yalento)

# Yalento
  
An awesome Angular and Node.js integration of Google Firebase for easy using all features from realtime databases, functions and more cloud services.  
  
## Prerequisites

- [ ] [Google firebase project](https://firebase.google.com/) (spark plan for free)
- [ ] Google firebase [Admin SDK](https://firebase.google.com/docs/admin/setup) (for node.js) 
- [ ] [JavaScript SDK](https://firebase.google.com/docs/web/setup) (for Angular)  
  
### Example setup for node.js  
  
Install dependencies:

    npm i firebase-admin
    npm i yalento
    
Create simple node typescript file to start with Yalento and then add the code that is explained here:

***index.ts:***

*Import AbstractModel and AbstractRepository from yalento and admin from firebase-admin package.*

    import { AbstractModel, AbstractRepository } from 'yalento';
    const admin = require('firebase-admin');
    
*Initialize firebase app with your credentials provided by your env variable GOOGLE_APPLICATION_CREDENTIALS=service-account.json*

    admin.initializeApp({  
        credential: admin.credential.applicationDefault(),  
    });

*Now you can create your own models and repositories by extending the abstract ones. You are ending with a contact model and a contact repository where you can perform CRUD operations.*

    export class Contact extends AbstractModel {  
        name: string;  
        lastName: string;  
    }
    
    export class ContactRepository extends AbstractRepository {  
        model = Contact;  
    }
    
*Don't forget to initialize your repository by connecting it to the firebase app. Now you have support from awesome firebase features like realtime database updates or offline support.*

    const repo = new ContactRepository(admin.firestore());
Try it by your self by creating your first contact record.

    repo.add({ name: 'Diego', lastName: 'Trump' }, 'testId').then();
Retrieving data is as easy as it looks.

    repo.find().toPromise().then((contacts: Contact[]) => {  
    console.log(contacts.map((contact: Contact) => contact.name + contact.lastName));
    });

Start now the script by using something like `tsc && node index` and you are ending with a console output that stands for simplicity working with Yalento:
 [ 'DiegoTrump' ]

> It's recommended to use a **tsconfig.json** like the following one:

     {  
      "compilerOptions": {  
      "target" : "es5",  
      "lib": ["es5", "es2017", "dom"]  
       } 
     }

  
### Example setup for Angular  

Add yalento and firebase dependencies to your angular project

    npm add firebase
    npm add yalento
    npm add @angular/fire
 
 Add your firebase web app credentials to **environment.ts**

    export const environment = {  
	    firebase: {  
		    apiKey: "***",
		    authDomain: "*.firebaseapp.com",
		    databaseURL: "https://*.firebaseio.com",
		    projectId: "*",
		    storageBucket: "*.appspot.com",
		    messagingSenderId: "***",
		    appId: "*:*:web:*"
	     }
	   };

Add some imports to your ***app.module.ts***:

    import  { AngularFireModule }  from  '@angular/fire';
    import  { AngularFirestoreModule }  from '@angular/fire/firestore';
    import  { environment }  from  '../../environments/environment';
