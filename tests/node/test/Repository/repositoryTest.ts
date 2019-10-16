import { expect } from 'chai';
import { after, describe, it } from 'mocha';
import { Base, Repository } from '../../../../src';

export class Contact extends Base {

    public name: string;
    public lastName: string;
    public street: string;
    public age: number;

    constructor(name: string, lastName: string, age: number) {
        super();
        this.name = name;
        this.lastName = lastName;
        this.age = age;
    }

}

export function repositoryTest(): Promise<void> {

    return new Promise((resolve) => {

        describe('RepositoryTest', async () => {

            after(async () => {
                resolve();
            });

            it('construct new repository should instantiate with model without constructor parameters', async () => {

                const repository: Repository<Contact> = new Repository(Contact);
                expect(repository instanceof Repository).to.be.true;

            });

            it('construct new repository should instantiate with model constructor parameters and create model based on them', async () => {

                const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);
                const model: Contact = repository.create({ street: 'testStreet'});
                expect(model.name).to.be.equal('test1');
                expect(model.lastName).to.be.equal('test2');
                expect(model.street).to.be.equal('testStreet');
                expect(model.age).to.be.equal(1);

            });


        });

    });
}
