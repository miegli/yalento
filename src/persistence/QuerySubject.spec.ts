import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Base, Repository } from '..';


export class Contact extends Base {

    public name: string;
    public lastName: string;
    public street: string = '';
    public age: number;

    constructor(name: string, lastName: string, age: number) {
        super();
        this.name = name;
        this.lastName = lastName;
        this.age = age;
    }

}

describe('QuerySubjectTest', async () => {

    const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);

    before(() => {
        repository.create({ name: 'name1', lastName: 'lastName1', age: 1 });
        repository.create({ name: 'name2', lastName: 'lastName2', age: 1 });
    })

    it('sql without statement should return all items', async () => {

        expect(repository.select().getValue()).to.be.lengthOf(2);

    });

    it('sql where statement should be applied via alasql', async () => {

        expect(repository.select({ where: 'name LIKE ?', params: ['name1'] }).getValue()).to.be.lengthOf(1);

    });


    it('sql groupBy statement should be applied via alasql', async () => {

        expect(repository.select({ groupBy: 'age' }).getValue()).to.be.lengthOf(1);

    });

    it('sql orderBy statement should be applied via alasql', async () => {

        expect(repository.select({ orderBy: 'name DESC' }).getValue()[0].name).to.be.equal('name2');

    });


    it('sql limit statement should be applied via alasql', async () => {

        expect(repository.select({ limit: 1 }).getValue()).to.be.lengthOf(1);

    });

    it('sql offset statement should be applied via alasql', async () => {

        expect(repository.select({ limit: 1, offset: 2 }).getValue()).to.be.lengthOf(0);
        expect(repository.select({ offset: 1 }).getValue()).to.be.lengthOf(1);

    });


    it('sql with full statement should be applied via alasql and return callback', async () => {

        expect(repository.select({
            where: 'name LIKE ?',
            groupBy: 'age',
            orderBy: 'name DESC',
            limit: 1,
            offset: 0,
            params: ['name%'],
        }, (count) => {
            expect(count).to.be.equal(2);
        }).getValue()).to.be.lengthOf(1);

    });


});
