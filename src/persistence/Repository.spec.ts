import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Base, Repository } from '..';
import { QueryCallback } from './query/QueryCallback';

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

    it('destroying a repository should be destroy instance', async () => {

        const repository: Repository<Contact> = new Repository(Contact);
        expect(typeof repository === 'object').to.be.true;

        repository.destroy();

        expect(Object.keys(repository).length).to.be.equal(0);

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
        expect(repository.getTempData()[0]._ref).to.be.equal(model);

    });


    it('create many should add entity references to repository data', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);
        const models = repository.createMany([{ street: 'testStreet1' }, { street: 'testStreet3' }, { street: 'testStreet3' }]);
        expect(repository.getTempData()[0]._ref).to.be.equal(models[0]);
        expect(repository.getTempData()[1]._ref).to.be.equal(models[1]);
        expect(repository.getTempData()[2]._ref).to.be.equal(models[2]);
        expect(repository.getTempData()).to.be.lengthOf(3);

    });

    it('select with empty repository should return empty array', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);
        expect(repository.select().getValue()).to.be.lengthOf(0);

    });


    it('select with callback should return callback interface', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);

        const exec = async (): Promise<QueryCallback<Contact>> => new Promise<QueryCallback<Contact>>((resolve => {
            repository.select({}, (callback: QueryCallback<Contact>) => {
                resolve(callback);
            });
        }));

        const result1: QueryCallback<Contact> = await exec();
        expect(result1.paginator.getLength()).to.be.equal(0);
        expect(result1.getResults()).to.be.lengthOf(0);

        repository.create();

        const result2: any = await exec();
        expect(result2.paginator.getLength()).to.be.equal(1);
        expect(result2.getResults()).to.be.lengthOf(1);

    });


    it('select with paginator should return paginator behaviour subject', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);

        expect(repository.selectWithPaginator().getLength()).to.be.equal(0);
        expect(repository.selectWithPaginator().getResults().getValue()).to.be.lengthOf(0);

        repository.create();

        expect(repository.selectWithPaginator().getLength()).to.be.equal(1);
        expect(repository.selectWithPaginator().getResults().getValue()).to.be.lengthOf(1);

    });


    it('select with paginator should sort results', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);

        for (let i = 0; i <= 100; i++) {
            repository.create({ name: 'name', lastName: 'lastName', age: i });
        }

        const select = repository.selectWithPaginator();

        expect(select.getResults().getValue()).to.be.lengthOf(101);

        select.setPageSort({ active: 'age', direction: 'DESC' });
        expect(select.getResults().getValue()[100].age).to.be.equal(0);
        expect(select.getResults().getValue()[0].age).to.be.equal(100);

        select.setPageSort({ active: 'age', direction: 'ASC' });
        expect(select.getResults().getValue()[0].age).to.be.equal(0);
        expect(select.getResults().getValue()[100].age).to.be.equal(100);


    });


    it('creating model with given identifier should return model with uuid', async () => {

        const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);

        for (let i = 0; i <= 100; i++) {
            repository.create({ name: 'name', lastName: 'lastName', age: i }, i);
        }

        const select = repository.selectWithPaginator();
        const results = select.getResults().getValue() as any[];
        expect(results[100]['_uuid']).to.be.equal(100);


    });


});
