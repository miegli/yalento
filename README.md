
[![Build Status](https://travis-ci.com/miegli/yalento.svg?branch=master)](https://travis-ci.com/miegli/yalento)  
  
# Yalento  
An awesome framework that combines the best benefits from [AlaSQL](http://alasql.org) and [Google Cloud Firestore](https://firebase.google.com/docs/firestore) written in typescript for best using in Angular and Node.js projects:

- Write normal SQL-Queries and get observable results.
- Native integration of most common features like pagination or selection.
- CRUD operations for any, even complex, javascript objects
- Full offline support und high performance guaranteed.
- Test coverage of 100%.

## Example for node.js / angular

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

The observables are really useful if you connect your repository to "Google Cloud Firestore" or to any other database with realtime updates support:

    const fb = firebase.initializeApp({  
	    apiKey: '***',
	    ...
    });
    
    repo.connectFirestore(fb);
    
Now, you have successfully connected your repository to realtime database of cloud firestore. This has the consequence that:

 - repository.select({ where: 'age >= 18'}) automatically fetches matching contacts from remote database
 - repository.create({ name: 'Bob', age: 10}) puts new contact to remote database


## Documentation

We are working on it.