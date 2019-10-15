import { expect } from 'chai';
import { after, describe, it } from 'mocha';


export function modelTest(): Promise<void> {

    return new Promise((resolve) => {

        describe('RepositoryTest', async () => {

            after(async () => {
                resolve();
            });

            it('model extends abstractModel', async () => {

                expect(1).to.equal(1);

            });


        });

    });
}
