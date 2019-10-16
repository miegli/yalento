import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Base, ICallback, Repository } from '..';


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

export class ContactWithoutConstructor extends Base {

    public name: string = '';
    public lastName: string = '';
    public street: string = '';
    public age: number = 0;


}

describe('RepositoryTest', async () => {

    it('construct new repository should instantiate with model without constructor parameters', async () => {

        const repository: Repository<Contact> = new Repository(Contact);
        expect(typeof repository === 'object').to.be.true;

    });

    it('construct new repository should instantiate with model with constructor parameters', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);
        expect(typeof repository === 'object').to.be.true;

    });


    it('create should return entity', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);
        const model = repository.create({ street: 'testStreet' });
        expect(model.name).to.be.equal('test1');
        expect(model.lastName).to.be.equal('test2');
        expect(model.street).to.be.equal('testStreet');
        expect(model.age).to.be.equal(1);

        const repository2: Repository<ContactWithoutConstructor> = new Repository(ContactWithoutConstructor);
        const model2 = repository2.create();
        expect(model2.name).to.be.equal('');
        expect(model2.lastName).to.be.equal('');
        expect(model2.street).to.be.equal('');
        expect(model2.age).to.be.equal(0);

    });

    it('create should add entity reference to repository data', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);
        const model = repository.create({ street: 'testStreet' });
        expect(repository.getData()[0]._ref).to.be.equal(model);

    });

    it('watch with empty repository should return empty array', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);
        expect(repository.watch().getValue()).to.be.lengthOf(0);

    });


    it('watch with callback should return callback interface', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);

        const exec = async () => new Promise((resolve => {
            repository.watch({}, (count, page) => {
                resolve({ count: count, page: page });
            });
        }));

        const result1: any = await exec();
        expect(result1.count).to.be.equal(0);
        expect(result1.page).to.be.equal(1);

        repository.create();

        const result2: any = await exec();
        expect(result2.count).to.be.equal(1);
        expect(result2.page).to.be.equal(1);

    });


});
