import { expect } from 'chai';
import { after, before, describe, it } from 'mocha';
import { getFirestore } from '../../helper';
import { TestModel } from './testModel';
import { TestModel2 } from './testModel2';
import { TestRepository } from './testRepository';


export function modelRelations(): Promise<void> {

    return new Promise((resolve) => {

        const firestore = getFirestore();
        const repo = new TestRepository(firestore);

        describe('Model relations', async function () {

            after(async function () {
                resolve();
            });

            before(async function () {

            });

            it('one to one relation should return instance of related model ', async function () {

                const model = new TestModel();
                expect(await model.getProperty('testModel2') instanceof TestModel2).to.equal(true);

            });

            it('adding and removing many to one relation without repository support should return correct array lengths', async function () {

                const model = new TestModel();
                expect(await model.getProperty('testModels2')).a('array');
                const model2 = await model.add('testModels2');
                expect((await model.getProperty('testModels2')).length).equals(1);
                await model2.remove();
                expect((await model.getProperty('testModels2')).length).equals(0);


            });

            it('adding and removing many to one relation with repository support should return correct array lengths and ordering', async function () {

                const model = new TestModel();
                expect(await model.getProperty('testModels2')).a('array');
                const model2 = await model.add('testModels2');
                expect((await model.getProperty('testModels2')).length).equals(1);
                await model2.remove();
                expect((await model.getProperty('testModels2')).length).equals(0);

                const modelFromRepo = await repo.add();
                expect(await modelFromRepo.getProperty('testModels2')).a('array');

                await modelFromRepo.add('testModels2', { name: '2' });
                await modelFromRepo.add('testModels2', { name: '3' });
                await modelFromRepo.add('testModels2', { name: '1' });
                await modelFromRepo.add('testModels2', { name: '5' });
                await modelFromRepo.add('testModels2', { name: '6' });
                await modelFromRepo.add('testModels2', { name: '7' });
                await modelFromRepo.add('testModels2', { name: '9' });
                await modelFromRepo.add('testModels2', { name: '4' });
                await modelFromRepo.add('testModels2', { name: '8' });


                const waitForAllModels = async (): Promise<TestModel2[]> => {
                    return new Promise<TestModel2[]>((resolve1 => {

                        modelFromRepo.testModels2.subscribe((result: TestModel2[]) => {
                            resolve1(result);
                        });

                    }))
                };

                const models = await waitForAllModels();
                expect(models.length).equals(9);
                expect(models.map(value => value.name).join('')).equals('123456789');

                const repoModel = await repo._findOneByIdentifier(modelFromRepo.getIdentifier(), false).toPromise().then((m) => {
                    return m;
                }).catch();
                expect((await repoModel.getProperty('testModels2')).length).equals(9);

                await repo.remove(modelFromRepo);


                const repoModelAfterRemoving = await repo._findOneByIdentifier(modelFromRepo.getIdentifier(), false).toPromise().then((m) => {
                    return m;
                }).catch();

               expect(repoModelAfterRemoving).equals(null);


            });


            it('moving from one many to one relation collection to an other should return correct allocations', async function () {


                const modelFromRepo = await repo.add();

                const testModel = await modelFromRepo.add('testModelsWithNameTest3');

                const waitForTestModelsWithNameTest3 = async (): Promise<TestModel2[]> => {
                    return new Promise<TestModel2[]>((resolve1 => {
                        modelFromRepo.testModelsWithNameTest3.subscribe((e) => {
                            resolve1(e);
                        })
                    }))
                };

                const testModelsWithNameTest3 = await waitForTestModelsWithNameTest3();
                expect(testModelsWithNameTest3).length(1);
                expect(testModelsWithNameTest3[0].name).equals('test3');


                await testModelsWithNameTest3[0].move('testModelsWithNameTest4');

                const waitForTestModelsWithNameTest4 = async (): Promise<TestModel2[]> => {
                    return new Promise<TestModel2[]>((resolve1 => {
                        modelFromRepo.testModelsWithNameTest4.subscribe((e) => {
                            resolve1(e);
                        })
                    }))
                };

                const testModelsWithNameTest4 = await waitForTestModelsWithNameTest4();
                expect(testModelsWithNameTest4).length(1);
                expect(testModelsWithNameTest4[0].name).equals('test4');

                const waitForTestModelsWithNameTest3AfterMoved = async (): Promise<TestModel2[]> => {
                    return new Promise<TestModel2[]>((resolve1 => {
                        modelFromRepo.testModelsWithNameTest3.subscribe((e) => {
                            resolve1(e);
                        })
                    }))
                };

                const testModelsWithNameTest4AfterMoved = await waitForTestModelsWithNameTest3AfterMoved();
                expect(testModelsWithNameTest4AfterMoved).length(0);

                await repo.remove(testModelsWithNameTest4[0]);
                await repo.remove(testModel);
                await repo.remove(modelFromRepo);


            });


        });

    });
}
