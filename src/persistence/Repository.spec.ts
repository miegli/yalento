import { expect } from 'chai';
import { describe, it } from 'mocha';
import { BehaviorSubject } from 'rxjs';
import { skipWhile, takeUntil, takeWhile } from 'rxjs/operators';
import { IEntity, Repository } from '..';
import { IQueryCallbackChanges } from './QuerySubject';

export class Contact {
  public name: string;
  public lastName: string;
  public street: string = 'street';
  public age: number;

  constructor(name: string, lastName: string, age: number) {
    this.name = name;
    this.lastName = lastName;
    this.age = age;
  }
}

export class ContactWithoutConstructor {
  public name: string = '';
  public lastName: string = '';
  public street: string = '';
  public age: number = 0;
}

describe('RepositoryTest', async () => {
  it('construct new repository should instantiate with model with and without constructor parameters', async () => {
    const repository1: Repository<Contact> = new Repository(Contact, 'Contact');
    expect(typeof repository1 === 'object').to.be.true;

    const repository2: Repository<Contact> = new Repository(Contact, 'Contact', 'name', 'lastName', 3);
    expect(typeof repository2 === 'object').to.be.true;
  });

  it('destroying a repository should be destroy instance', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    expect(typeof repository === 'object').to.be.true;

    repository.destroy();
  });

  it('construct new repository should instantiate model', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact', 'test1', 'test2', 1);
    expect(typeof repository === 'object').to.be.true;

    const repository2: Repository<ContactWithoutConstructor> = new Repository(
      ContactWithoutConstructor,
      'ContactWithoutConstructor',
    );
    expect(typeof repository2 === 'object').to.be.true;
  });

  it('create item of repository should return model', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    expect((await repository.create()).street).to.be.equal('street');
    expect((await repository.create({ street: 'test' })).street).to.be.equal('test');
    expect((await repository.create({}, 1))['__uuid']).to.be.equal(1);
  });

  it('create items with same identifier should create only once', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    expect((await repository.create({}, 1))['__uuid']).to.be.equal(1);
    expect((await repository.create({}, 1))['__uuid']).to.be.equal(1);
    expect(await repository.select().getResultsAsPromise()).to.be.lengthOf(1);

    const repository2: Repository<Contact> = new Repository(Contact, 'Contact');
    await repository2.createMany([{ __uuid: 2 }, { __uuid: 2 }]);
    expect(await repository2.select().getResultsAsPromise()).to.be.lengthOf(1);
  });

  it('create many items of repository should return models', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    expect(await repository.createMany([{ age: 1 }, { age: 2 }])).to.lengthOf(2);
    expect((await repository.createMany([{ __uuid: 2 }]))[0]['__uuid']).to.be.equal(2);
  });

  it('create item of repository by reading default data from sql statement should return model', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    const contact = await repository.create(
      { lastName: 'lastName' },
      undefined,
      'SELECT * FROM Contact WHERE age = 1 AND name LIKE "name"',
    );
    expect(contact.street).to.equal('street');
    expect(contact.lastName).to.equal('lastName');
    expect(contact.age).to.equal(1);
    expect(contact.name).to.equal('name');

    const contacts = await repository.createMany(
      [{ lastName: 'lastName' }, { lastName: 'lastName' }],
      'SELECT * FROM Contact WHERE age = 1 AND name LIKE "name"',
    );
    expect(contacts).to.be.lengthOf(2);

    const contact1 = await repository.create(
      {},
      undefined,
      'SELECT * FROM Contact WHERE age = 1 AND name LIKE "name5" AND (age = 2 OR name LIKE "test") AND name LIKE "name5"',
    );
    expect(contact1.name).to.equal('name5');

    const contact2 = await repository.create({}, undefined, 'SELECT * FROM Contact WHERE 1');
    expect(contact2.name).to.equal(undefined);
  });

  it('querying items from empty repository should return no models', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    expect(repository.select().getResults()).to.lengthOf(0);

    const repository2: Repository<Contact> = new Repository(Contact, 'Contact', 'name', 'lastName', 1);
    expect(repository2.select().getResults()).to.lengthOf(0);
  });

  it('querying items from repository should return matching models', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    const contacts1 = repository.select();
    await contacts1.create({ name: 'name', lastName: 'lastName', age: 3 });
    expect(contacts1.getResults()).to.lengthOf(1);

    const contacts2 = repository.select({ where: 'lastName LIKE "test"' });
    await contacts2.create({ name: 'name', age: 1 });
    await contacts2.create({ name: 'name', age: 2 });
    await contacts2.create({ name: 'name', age: 2 });
    await contacts2.create({ name: 'name', age: 3 });
    await contacts2.create({ name: 'name', age: 4 });
    await contacts2.create({ name: 'name', age: 5 });
    await contacts2.create({ name: 'name', age: 6 });
    expect(contacts2.getResults()).to.lengthOf(7);

    const contactsAll = repository.select();
    expect(await contactsAll.getResultsAsPromise()).to.be.lengthOf(8);

    expect(await repository.select({ limit: 1 }).getResultsAsPromise()).to.be.lengthOf(1);
    expect(await repository.select({ offset: 1 }).getResultsAsPromise()).to.be.lengthOf(1);
    expect(await repository.select({ offset: 9 }).getResultsAsPromise()).to.be.lengthOf(0);
    expect(await repository.select({ limit: 1, offset: 1 }).getResultsAsPromise()).to.be.lengthOf(1);
    expect((await repository.select({ orderBy: 'age DESC' }).getResultsAsPromise())[0].age).to.be.equal(6);
    expect((await repository.select({ orderBy: 'age ASC' }).getResultsAsPromise())[0].age).to.be.equal(1);
  });

  it('querying items with params from repository should return matching models', async () => {
    const age$: BehaviorSubject<number> = new BehaviorSubject(1);
    const repository: Repository<Contact> = new Repository(Contact, 'Contact', 'test');
    const contacts = repository.select({ where: 'age = ? AND name LIKE ?', params: [age$, 'test'] });
    await repository.create({ age: 1 });
    await repository.create({ age: 2 });
    await repository.create({ age: 2 });
    await repository.create({ age: 3 });
    await repository.create({ age: 3 });
    await repository.create({ age: 3 });

    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(1);

    age$.next(2);
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(2);

    age$.next(3);
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(3);
  });

  it('querying items from repository should return observable results', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    const contacts = repository.select();
    expect(await contacts.getResults()).to.be.lengthOf(0);

    const waitFor = async () => {
      return new Promise<number[]>(resolve => {
        const counter: number[] = [];
        contacts
          .getResultsAsObservable()
          .pipe(
            takeWhile((results: Array<IEntity<Contact>>) => {
              counter.push(results.length);
              return results.length !== 3;
            }),
          )
          .toPromise()
          .then(() => {
            resolve(counter);
          });

        repository.create({ age: 1 });

        setTimeout(() => {
          repository.create({ age: 2 });
        }, 5);

        setTimeout(() => {
          repository.create({ age: 3 });
        }, 50);
      });
    };

    expect(await waitFor()).to.be.deep.eq([1, 2, 3]);
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(3);
    expect(await contacts.getResults()).to.be.lengthOf(3);
  });

  it('paginator for select items from repository should be applied', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    await repository.create({ age: 1 });
    await repository.create({ age: 2 });
    await repository.create({ age: 3 });
    await repository.create({ age: 4 });
    await repository.create({ age: 5 });
    await repository.create({ age: 6 });
    await repository.create({ age: 7 });
    await repository.create({ age: 8 });

    const contacts = repository.select(
      {},
      {
        pageSize: 5,
        pageSizeOptions: [10],
        pageSort: { active: 'age', direction: 'ASC' },
      },
    );
    expect(contacts.getPaginator().getPageSizeOptions()).to.be.lengthOf(2);
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(5);

    contacts.getPaginator().setPageIndex(1);
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(3);

    contacts.getPaginator().setPageIndex(100);
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(3);

    expect(
      repository
        .select(
          {},
          {
            pageSize: 5,
            pageSizeOptions: [5, 10],
            pageSort: { active: 'age', direction: 'ASC' },
          },
        )
        .getPaginator()
        .getPageSizeOptions(),
    ).to.be.lengthOf(2);
  });

  it('creating model after repository querying should update results', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    const contacts = repository.select();
    expect(contacts.getResults()).to.be.lengthOf(0);
    await contacts.create();
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(1);
    await repository.createMany([{ age: 1 }, { age: 2 }]);
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(3);
  });

  it('removing model after repository querying should update results', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    const contacts = repository.select();
    const contact = await contacts.create();
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(1);
    await repository.remove(contact);
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(0);
  });

  it('updating model after repository querying should update results', async () => {
    const repository: Repository<Contact> = new Repository(Contact, 'Contact');
    const contacts = repository.select({ where: 'age = 0' });
    const contact = await contacts.create();
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(1);
    contact.age = 1;
    await repository.update(contact);
    expect(await contacts.getResultsAsPromise()).to.be.lengthOf(0);
  });
});
