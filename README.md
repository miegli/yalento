

[![Build Status](https://travis-ci.com/miegli/yalento.svg?branch=master)](https://travis-ci.com/miegli/yalento)  
  
# Yalento  
An awesome framework that combines the best benefits from [AlaSQL](http://alasql.org) and [Google Cloud Firestore](https://firebase.google.com/docs/firestore) written in typescript for best using in Angular and Node.js projects:

- Write normal SQL-Queries and get observable **realtime** result changes.
- Native integration of most common features like pagination or selection.
- **Made for serverless** (google cloud functions, aws lambda, etc).
- CRUD operations for any, even complex, javascript objects
- Full **offline support** und high performance guaranteed.
- User and role based **security framework** (global, collection and entities)
- Test coverage of 100%.

## Example for node.js / angular

### Repository of anything
The yalento repository supports even complex javascript objects where you can do search, orderBy and many other operations. However in practice you work with simple model classes like the following one:

    export class Contact {  
      public name: string = '';  
      public lastName: string = '';
      public street: string = '';
      public age: number = 0;
    }

Your model must not extend from any yalento classes - just write your classes how you like it. Only if you work with objects in a repository, then you need a yalento class:

    import { Repository } from 'yalento';
    const repository: Repository<Contact> = new Repository(Contact);
   
Now we are ready. Let's create two new contacts from repository:

    const contact1: Contact = await repository.create({ name: 'Bob', age: 10});
    const contact2: Contact = await repository.create({ name: 'Jan', age: 28});

And what about querying? Nothing easier than this.

    const kids: Contact[] = repository.select({ where: 'age < 18'}).getResults();

Instead of ‘getResults()’ you also can use ‘getResultsAsObservable’ if you want to observe changes in the repository. That means, your subscribers get informed whenever data has been changed (new contacts matching your query, contacts data changed, etc.). 

### Observable realtime changes
The observables are really useful if you connect your repository to "Google Cloud Firestore" or to any other database with realtime updates support:

    const fb = firebase.initializeApp({  
	    apiKey: '***',
	    ...
    });
    
    repository.connectFirestore(fb);
    
Now, you have successfully connected your repository to realtime database of cloud firestore. This has the consequence that:

 - repository.select({ where: 'age >= 18'}) automatically fetches matching contacts from remote database
 - repository.create({ name: 'Bob', age: 10}) puts new contact to remote database
 
 Don't forget to unsubscribe from all observers to avoid memory leaks:
 
 *Example to unsubscribe from all subscribers after leaving an angular component.*

    ngOnDestroy(): void {
          this.contactRepository.destroy();
    }


### Paginator

Using the native pagination makes most sense, if you are in the context of an angular app. Let's see how easy yalento works with the google material component:

    <mat-paginator [length]="kids.getPaginator().getLength()"  
	    [pageSize]="kids.getPaginator().getPageSize()"
	    [pageSizeOptions]="kids.getPaginator().getPageSizeOptions()"  
	    (page)="kids.getPaginator().setPage($event)"
        [pageIndex]="kids.getPaginator().getPageIndex()">
	</mat-paginator>

Nothing to configure - you've already implemented all the pagination component features. Unless you also want to implement one of the many requirements: select, select all, invert selection.

    # toogle all (all kids get selected)
    kids.getPaginator().toggleSelection();

    # toogle one (first kid get selected in this case)
    kids.getPaginator().toggleSelection(kids.getResults()[0]);

    # get all selected kids
    const yourKids: Contact[] = kids.getPaginator().getSelected();

## Example serverless
### google cloud functions

The yalento repository is optimized for running serverless applications. You can easily query, e.g. create cloud functions and return the results as json. You benefit from the fact that the repository retains all data in the working memory and monitors changes to the source databases in real time. This leads to extremely high reaction times (<5ms).

Let's look at an example for a serverless function:

    import * as functions from 'firebase-functions';  
    import * as firebase from 'firebase-admin';  
    import {Repository} from "yalento";
    
    const fb = firebase.initializeApp();  
    const repo = new Repository<Contact>(Contact);  
    const select = repo.connectFirestore(fb).select({where: 'age > 0'});  
      
      export const helloWorld = functions.https.onRequest((request, response) => {
        select.toJson().then((json: string) => {  
            response.send(json);
            }).catch((e) => {  
            response.send(e.message);
            })  
        });
The output of the example is a JSON array of Contacts, if you call the 'helloWorld' HTTPS endpoint.


## Documentation

We are working on it.

### Firebase Cloud Firestore security rules
If you connect the yalento repository with firebase by `repository.connectFirestore(fb);` method, the cloud firestore is automatically structured as (we use the examples from above, where 'Contact' is the name of the model):


| Level | Path | Document |
|------------------------------|--|--|
|Document |{Contact}/data/{contacts}|Contact: { name: 'Bob', age: 10, __owner: { EVERYBODY: true}}|
|Collection |{Contact}/permissions|Permissions {}|

As you can see in the table there are two levels of privileges. Privileges on documents affects only one document where privileges on collection level affect all entities.

#### Collection privileges
The permission document is empty by default. You should add one for each model/entity via firebase admin console. Everybody has full read and write privileges, if the document is empty. Yalento uses the best practices from firebase documentation about [firestore rules](https://firebase.google.com/docs/firestore/security/get-started). The permission document  once per model/entity is defined like here:

    Permissions: {
				    get|list|create|update|delete: {
					    AUTHENTICATED|AUTH.USER.UUID: boolean 
				    }
                 }
Each key of the permission document that is not defined makes the privilege as public for everybody. So if you do not add 'get' key, then everybody can read data. The following examples explain the mode of operation:

*Example 1: Only authenticated users can read a document or list a collection of given model/entity. All other operations are allowed to everybody.*

    Permissions: {
				    get: {
					    AUTHENTICATED: true 
				    },
				    list: {
					    AUTHENTICATED: true 
				    }
                 }
                 
*Example 2: Only user with uuid 'TEST'  can update documents of given model/entity. All other operations are allowed to everybody.*

    Permissions: {
				    update: {
					    TEST: true 
				    }
                 }

#### Document privileges
Your entity contains an additional property '__owner' that is added automatically by yalento. With this property you specify document level privileges:

    Contact: { name: 'Bob', age: 10, __owner: { EVERYBODY: true}}

The __owner property has EVERYBODY as default value. So everybody with collection privileges can execute all read and write operations.

    Contact: { name: 'Bob', age: 10, __owner: { TESTUSER: true}}

Connecting yalento repository with dataMode option  `repository.connectFirestore(fb, { dataMode: 'PRIVATE' });` adds automatically the currents users uuid to the __owner property. In private dataMode only users can access documents, if they are owner of it. This mode affects  querying, writing and reading. If you execute a select like `const kids: Contact[] = repository.select({ where: 'age < 18'}).getResults();` you only get kids who have your UUID as owner key.

### The firestore.rules
Yalento implements very basic privileges to avoid any performance troubles, but you can extend the default [firestore.rules](https://github.com/miegli/yalento/blob/master/firebase/firestore/rules/firestore.rules) provided by yalento whenever you want to do. Please note, however, the [limits of firestore](https://firebase.google.com/docs/firestore/quotas).
