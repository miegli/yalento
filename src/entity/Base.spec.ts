import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Base } from './Base';


export class Contact extends Base {

    public name: string = '';
    public lastName: string = '';
    public street: string = '';
    public age: number = 0;

}

describe('EntityTest', async () => {

    it('construct new model should return instance of base model', async () => {

        const contact: Contact = new Contact();
        expect(contact instanceof Base).to.be.true;

    });


});
