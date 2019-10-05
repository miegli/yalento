import { expect } from 'chai';
import { after, before, describe, it } from 'mocha';
import { getFirestore } from '../../helper';
import { TestRepository } from './testRepository';


export function paths(): Promise<void> {

    return new Promise((resolve) => {

        const firestore = getFirestore();
        const repo = new TestRepository(firestore);

        describe('Paths', async function () {

            after(async function () {
                resolve();
            });

            before(async function () {

            });


            it('model toJson method should return a representing json', async function () {

                const modelFromRepo = await repo.add();
                const testModel1 = await modelFromRepo.add('testModels');
                const testModel2 = await modelFromRepo.add('testModels');

                const persistedTestModelFromNotExistingPathQuery = await repo.find({ path: modelFromRepo.getIdentifier() + '/noexisting' }).toPromise();
                expect(persistedTestModelFromNotExistingPathQuery.length).equal(0);

                const persistedTestModelFromPathQuery = await repo.find({ path: modelFromRepo.getIdentifier() + '/testmodel2' }).toPromise();
                expect(persistedTestModelFromPathQuery.length).equal(2);

                const persistedTestModelFromOddPathQuery = await repo.find({ path: modelFromRepo.getIdentifier() }).toPromise();
                expect(persistedTestModelFromOddPathQuery.length).equal(1);

                await repo.remove(modelFromRepo);
                await repo.remove(testModel1);
                await repo.remove(testModel2);
                await repo.remove(modelFromRepo);


            });


        });
    });
}
