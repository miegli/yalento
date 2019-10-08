import { expect } from 'chai';
import { after, before, describe, it } from 'mocha';
import { getFirestore } from '../../helper';
import { TestModel2 } from '../model/testModel2';
import { TestRepository } from './testRepository';

export function repository(): Promise<void> {

    return new Promise((resolve) => {

        const firestore = getFirestore();
        const repo = new TestRepository(firestore);

        describe('Repository', async () => {

            after(async () => {
                resolve();
            });

            before(async () => {

            });

            it('deleting an not existing item from repository should return true', async () => {

                const status = await repo.remove('notexistingkey').then((e) => {
                    return e;
                }).catch((e) => {
                    console.log(e);
                });

                expect(status).to.equal(true);

            });

            it('adding a new document should return a persisted model', async () => {

                let model: any;
                let model2: any;
                let model3: any;

                model = await repo.add({ lastName: 'lastName', name: 'name' }, 'test').then((m) => {
                    return m;
                }).catch();

                expect(model.getIdentifier()).to.equals('test');

                model = await repo._findOneByIdentifier('test', false).toPromise().then((m) => {
                    return m;
                }).catch();

                expect(model.getIdentifier()).to.equals('test');
                expect(model.name).to.equals('name');
                expect(model.lastName).to.equals('lastName');

                model2 = await repo.find({ identifier: 'test' }).toPromise().then((m) => {
                    return m;
                }).catch();


                expect(model2[0].getIdentifier()).to.equals('test');
                expect(model2[0].name).to.equals('name');
                expect(model2[0].lastName).to.equals('lastName');

                model3 = await repo.find({ path: 'test' }).toPromise().then((m) => {
                    return m;
                }).catch();

                expect(model3[0].getIdentifier()).to.equals('test');
                expect(model3[0].name).to.equals('name');
                expect(model3[0].lastName).to.equals('lastName');


            });

            it('repository without query should be exported as json', async () => {

                const json = await repo.toJson().then((s) => {
                    return s;
                }).catch((e) => {
                    return {};
                });

                expect(json).to.length(1);

            });

            it('repository with matching query should be exported as json', async () => {

                const json = await repo.toJson({
                    where: [{
                        property: 'name',
                        operation: '==',
                        value: 'name',
                    }],
                }).then((json) => {
                    return json;
                }).catch(() => {
                    return {};
                });

                expect(json).to.length(1);

            });

            it('repository should be queried with all available operators', async () => {

                expect(await repo.find({
                    where: [{
                        property: 'name',
                        operation: '==',
                        value: 'name',
                    }],
                }).toPromise().then((r: any) => {
                   return r;
                })).to.length(1);

                expect(await repo.find({
                    where: [{
                        property: 'name',
                        operation: '==',
                        value: 'noname',
                    }],
                }).toPromise().then((r: any) => {
                   return r;
                })).to.length(0);


            });


            /*
            it('repository with query for missing indexed property should return a relevant error message', async () => {

                const error: string = await repo.toJson({
                    orderBy: 'property1' + new Date().getTime(),
                }).then(() => {
                    return '';
                }).catch((e) => {
                    return e.message;
                });

                expect(error).to.contains('The query requires an index. You can create it here');

            });
            */

            it('repository with query in watching mode and subscribeUntil parameter should get timed out', async () => {

                const timeout = 1000;
                let startTime = new Date().getMilliseconds();
                await repo.find(null, true, { until: 'timeout', value: timeout}).toPromise().then((r: any) => {
                    return r;
                });

                let deltaTime = 1 + ((new Date().getMilliseconds() - startTime) * 1000);

                expect(deltaTime).to.greaterThan(timeout);

            });



            it('model should not be accepted if it is from wrong instance type', async () => {

                const model = new TestModel2();
                const error = await repo.update(model).catch((e) => {
                    return e;
                });

                expect(error).contains('repository accepts only objects of ');


            });


            it('deleting an item from repository should return true', async () => {

                const status = await repo.remove('test').then((e) => {
                    return e;
                }).catch((e) => {
                    console.log(e);
                });

                expect(status).to.equal(true);

            });

            it('not existing document should return null', async () => {

                const model = await repo._findOneByIdentifier('test', false).toPromise().then((m) => {
                    return m;
                }).catch();

                expect(model).to.equals(null);

                const models = await repo.find({ identifier: 'test'}).toPromise().then((m) => {
                    return m;
                }).catch();

                expect(models.length).to.equal(0);


            });

        });

    });
}
