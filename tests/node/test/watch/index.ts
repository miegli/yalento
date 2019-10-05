import { expect } from 'chai';
import { after, before, describe, it } from 'mocha';
import { getFirestore } from '../../helper';
import { TestModel } from './testModel';
import { TestRepository } from './testRepository';


export function watch(): Promise<void> {

    return new Promise((resolve) => {

        const firestore = getFirestore();
        const repo = new TestRepository(firestore);

        describe('Watch', async function () {

            after(async function () {
                resolve();
            });

            before(async function () {

            });


            it('changes in model should be watchable', async function () {

                const modelFromRepo = await repo.add();
                const watchNames = (identifier: string): Promise<any[]> => {
                    return new Promise((resolve1) => {

                        let names = [];

                        repo._findOneByIdentifier(identifier, true).subscribe((model: TestModel) => {

                            if (model) {
                                names.push(model.name);
                                if (names.length > 2) {
                                    resolve1(names);
                                }
                            } else {
                                resolve1(names);
                            }

                        });

                        setTimeout(() => {
                            modelFromRepo.name = 'test2';
                            modelFromRepo.save();
                        }, 500);

                        setTimeout(() => {
                            modelFromRepo.name = 'test3';
                            modelFromRepo.save();
                        }, 750);

                        setTimeout(() => {
                            modelFromRepo.name = 'test3';
                            modelFromRepo.save();
                        }, 1000);



                    })
                };

                const names = await watchNames(modelFromRepo.getIdentifier());
                expect(names.length).to.equal(3);
                expect(names.join('-')).to.equal('test1-test2-test3');

                const namesForNotExistingIdentifier = await watchNames('notexisting');
                expect(namesForNotExistingIdentifier.length).to.equal(0);

                await repo.remove(modelFromRepo);


            });


        });
    });
}
