import { expect } from 'chai';
import { after, before, describe, it } from 'mocha';
import { getFirestore } from '../../helper';
import { TestModel } from './testModel';
import { TestModel2 } from './testModel2';
import { TestRepository } from './testRepository';


export function serialize(): Promise<void> {

    return new Promise((resolve) => {

        const firestore = getFirestore();
        const repo = new TestRepository(firestore);

        describe('Serialize', async function () {

            after(async function () {
                resolve();
            });

            before(async function () {

            });


            it('model toJson method should return a representing json', async function () {

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

                const jsonFromTestModelsWithNameTest3 = await testModelsWithNameTest3[0].toJson() as TestModel2;
                expect(jsonFromTestModelsWithNameTest3.testModel3.lastName).equals('test');

                const persistedTestModelAsJson = await (await repo._findOneByIdentifier(modelFromRepo.getIdentifier()).toPromise()).toJson() as TestModel;

                expect(persistedTestModelAsJson.name).equal('test');
                expect(persistedTestModelAsJson.testModel2.testModel3.name).equal('test');
                expect(persistedTestModelAsJson.testModelsWithNameTest4).length(0);
                expect(persistedTestModelAsJson.testModelsWithNameTest3).length(1);
                expect(persistedTestModelAsJson.testModelsWithNameTest3[0].name).equal('test3');
                expect(persistedTestModelAsJson.testModelsWithNameTest3[0].testModel3.name).equal('test');

                await repo.remove(testModelsWithNameTest3[0]);
                await repo.remove(testModel);
                await repo.remove(modelFromRepo);


            });


            it('repository toJson with identifier as query should return a representing json', async function () {

                const modelFromRepo = await repo.add({ 'name': 'testName' }, 'testIdentifier');
                const testModel = await modelFromRepo.add('testModelsWithNameTest3');

                const waitForTestModelsWithNameTest3 = async (): Promise<TestModel2[]> => {
                    return new Promise<TestModel2[]>((resolve1 => {
                        modelFromRepo.testModelsWithNameTest3.subscribe((e) => {
                            resolve1(e);
                        })
                    }))
                };

                const testModelsWithNameTest3 = await waitForTestModelsWithNameTest3();

                const jsonFromTestModelsWithNameTest3 = await testModelsWithNameTest3[0].toJson() as TestModel2;
                expect(jsonFromTestModelsWithNameTest3.testModel3.lastName).equals('test');

                const json = await repo.toJson({ identifier: 'testIdentifier' }) as TestModel;
                expect(json.name).equal('testName');

                await repo.remove(testModelsWithNameTest3[0]);
                await repo.remove(testModel);
                await repo.remove(modelFromRepo);


            });


        });
    });
}
