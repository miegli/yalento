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

describe('RepositoryTest', async () => {

    it('construct new repository should instantiate with model without constructor parameters', async () => {

        const repository: Repository<Contact> = new Repository(Contact);
        expect(typeof repository === 'object').to.be.true;

    });

    it('construct new repository should instantiate with model constructor parameters and create model based on them', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);
        const model = repository.create({ street: 'testStreet' });
        expect(model.name).to.be.equal('test1');
        expect(model.lastName).to.be.equal('test2');
        expect(model.street).to.be.equal('testStreet');
        expect(model.age).to.be.equal(1);

    });


});
