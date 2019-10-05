"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const mocha_1 = require("mocha");
const rxjs_1 = require("rxjs");
const helper_1 = require("../../helper");
const testRepository_1 = require("../repository/testRepository");
const testModel_1 = require("./testModel");
function model() {
    return new Promise((resolve) => {
        const firestore = helper_1.getFirestore();
        const repo = new testRepository_1.TestRepository(firestore);
        mocha_1.describe('Model', function () {
            return __awaiter(this, void 0, void 0, function* () {
                mocha_1.after(function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        resolve();
                    });
                });
                mocha_1.before(function () {
                    return __awaiter(this, void 0, void 0, function* () {
                    });
                });
                mocha_1.it('getProperty method should return correct value from static setter', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const model = new testModel_1.TestModel();
                        model.name = 'test';
                        chai_1.expect(yield model.getProperty('name')).to.equal('test');
                    });
                });
                mocha_1.it('getProperty method should return correct value from observable', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const model = new testModel_1.TestModel();
                        model.setData({ name: new rxjs_1.BehaviorSubject('test') });
                        chai_1.expect(yield model.getProperty('name')).to.equal('test');
                        model.setData({
                            name: new rxjs_1.Observable((observer) => {
                                setTimeout(() => {
                                    observer.next('test');
                                }, 1);
                            }),
                        });
                        chai_1.expect(yield model.getProperty('name')).to.equal('test');
                    });
                });
                mocha_1.it('model should be persisted via repository update and should be removable after', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const model = new testModel_1.TestModel();
                        const persistedModel = yield repo.update(model);
                        chai_1.expect(persistedModel.getIdentifier()).a('string');
                        chai_1.expect(yield repo.remove(model)).equal(true);
                    });
                });
                mocha_1.it('model save() method should be persist changes', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const model = new testModel_1.TestModel();
                        const persistedModel = yield repo.update(model);
                        const identifier = persistedModel.getIdentifier();
                        chai_1.expect(yield model.getProperty('name')).to.equal('');
                        model.name = 'testAfter';
                        const loadedModelWithoutSaveBefore = yield repo._findOneByIdentifier(identifier).toPromise();
                        chai_1.expect(yield loadedModelWithoutSaveBefore.getProperty('name')).to.equal('');
                        const save = () => __awaiter(this, void 0, void 0, function* () {
                            return new Promise((resolve => {
                                model.save(() => {
                                    resolve();
                                });
                            }));
                        });
                        yield save();
                        const loadedModelWithSavedBefore = yield repo._findOneByIdentifier(identifier).toPromise();
                        chai_1.expect(yield loadedModelWithSavedBefore.getProperty('name')).to.equal('testAfter');
                        yield repo.remove(model);
                    });
                });
                mocha_1.it('model remove() method should remove from persistence', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const model = yield repo.add();
                        const identifier = model.getIdentifier();
                        chai_1.expect(yield model.getProperty('name')).to.equal('');
                        const modelLoaded = yield repo._findOneByIdentifier(identifier).toPromise();
                        chai_1.expect(yield modelLoaded.getProperty('name')).to.equal('');
                        const remove = () => __awaiter(this, void 0, void 0, function* () {
                            return new Promise((resolve => {
                                model.remove(() => {
                                    resolve();
                                });
                            }));
                        });
                        yield remove();
                        const modelRemoved = yield repo._findOneByIdentifier(identifier).toPromise();
                        chai_1.expect(modelRemoved).to.equal(null);
                    });
                });
            });
        });
    });
}
exports.model = model;
