import { expect } from 'chai';
import { after, before, describe, it } from 'mocha';
import { BehaviorSubject, Observable } from 'rxjs';
import { getFirestore } from '../../helper';
import { TestRepository } from '../repository/testRepository';
import { TestModel } from './testModel';


export function model(): Promise<void> {

    return new Promise((resolve) => {

        const firestore = getFirestore();
        const repo = new TestRepository(firestore);

        describe('Model', async function () {

            after(async function () {
                resolve();
            });

            before(async function () {

            });

            it('getProperty method should return correct value from static setter', async function () {

                const model = new TestModel();
                model.name = 'test';
                expect(await model.getProperty('name')).to.equal('test');

            });

            it('getProperty method should return correct value from observable', async function () {

                const model = new TestModel();
                model.setData({ name: new BehaviorSubject('test') });
                expect(await model.getProperty('name')).to.equal('test');

                model.setData({
                    name: new Observable((observer) => {
                        setTimeout(() => {
                            observer.next('test');
                        }, 1);
                    }),
                });
                expect(await model.getProperty('name')).to.equal('test');


            });

            it('model should be persisted via repository update and should be removable after', async function () {

                const model = new TestModel();
                const persistedModel = await repo.update(model);
                expect(persistedModel.getIdentifier()).a('string');
                expect(await repo.remove(model)).equal(true);

            });

            it('model save() method should be persist changes', async function () {

                const model = new TestModel();
                const persistedModel = await repo.update(model);
                const identifier = persistedModel.getIdentifier();
                expect(await model.getProperty('name')).to.equal('');
                model.name = 'testAfter';

                const loadedModelWithoutSaveBefore = await repo._findOneByIdentifier(identifier).toPromise();
                expect(await loadedModelWithoutSaveBefore.getProperty('name')).to.equal('');

                const save = async () => {
                    return new Promise((resolve => {
                        model.save(() => {
                            resolve();
                        })
                    }));
                };

                await save();

                const loadedModelWithSavedBefore = await repo._findOneByIdentifier(identifier).toPromise();
                expect(await loadedModelWithSavedBefore.getProperty('name')).to.equal('testAfter');

                await repo.remove(model);


            });


            it('model remove() method should remove from persistence', async function () {

                const model = await repo.add();
                const identifier = model.getIdentifier();
                expect(await model.getProperty('name')).to.equal('');
                const modelLoaded = await repo._findOneByIdentifier(identifier).toPromise();
                expect(await modelLoaded.getProperty('name')).to.equal('');

                const remove = async () => {
                    return new Promise((resolve => {
                        model.remove(() => {
                            resolve();
                        })
                    }));
                };

                await remove();

                const modelRemoved = await repo._findOneByIdentifier(identifier).toPromise();
                expect(modelRemoved).to.equal(null);

            });



        });

    });
}
