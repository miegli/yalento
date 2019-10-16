import { expect } from 'chai';
import { after, describe, it } from 'mocha';
import { Base } from '../../../../src';

export class Contact extends Base {

    public name;
    public lastName;
    public age: number;

}

export function modelTest(): Promise<void> {

    return new Promise((resolve) => {

        describe('ModelTest', async () => {

            after(async () => {
                resolve();
            });

            it('construct new repository', async () => {

                const contact = new Contact();
                expect(contact instanceof Base).to.be.true;

            });


        });

    });
}
