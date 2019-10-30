import {expect} from 'chai';
import {describe, it} from 'mocha';
import {BehaviorSubject} from 'rxjs';
import {Repository} from '..';


export class Contact {

    public name: string;
    public lastName: string;
    public street: string = '';
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

describe('QuerySubjectTest', async () => {

    const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);
    const repository2: Repository<ContactWithoutConstructor> = new Repository(ContactWithoutConstructor);

    before(() => {
        repository.create({name: 'name1', lastName: 'lastName1', age: 1});
        repository.create({name: 'name2', lastName: 'lastName2', age: 1});
        repository2.create({name: 'name1', lastName: 'lastName1', age: 1});
    })

    it('sql without statement should return all items', async () => {

        expect(repository.select().getResults()).to.be.lengthOf(2);

    });

    it('sql where statement should be applied via alasql', async () => {

        expect(repository.select({where: 'name LIKE ?', params: ['name1']}).getResults()).to.be.lengthOf(1);

    });


    it('sql groupBy statement should be applied via alasql', async () => {

        expect(repository.select({groupBy: 'age'}).getResults()).to.be.lengthOf(1);

    });

    it('sql orderBy statement should be applied via alasql', async () => {

        expect(repository.select({orderBy: 'name DESC'}).getResults()[0].name).to.be.equal('name2');

    });


    it('sql limit statement should be applied via alasql', async () => {

        expect(repository.select({limit: 1}).getResults()).to.be.lengthOf(1);

        const select2 = repository.select({limit: 1});
        expect(select2.getResults()).to.be.lengthOf(1);


    });

    it('sql offset statement should be applied via alasql', async () => {

        expect(repository.select({limit: 1, offset: 2}).getResults()).to.be.lengthOf(0);
        expect(repository.select({offset: 1}).getResults()).to.be.lengthOf(1);

    });

    it('sql with behaviour subject as parameter should be applied via alasql', async () => {

        const value = new BehaviorSubject<string>('name1');
        expect(repository.select({where: 'name LIKE ?', params: [value]}).getResults()).to.be.lengthOf(1);

        const value2 = new BehaviorSubject<string>('name1');
        expect(repository2.select({where: 'name LIKE ?', params: [value2]}).getResults()).to.be.lengthOf(1);

    });

});
