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
const helper_1 = require("../../helper");
const testModel_1 = require("./testModel");
const testModel2_1 = require("./testModel2");
const testRepository_1 = require("./testRepository");
function modelRelations() {
    return new Promise((resolve) => {
        const firestore = helper_1.getFirestore();
        const repo = new testRepository_1.TestRepository(firestore);
        mocha_1.describe('Model relations', function () {
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
                mocha_1.it('one to one relation should return instance of related model ', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const model = new testModel_1.TestModel();
                        chai_1.expect((yield model.getProperty('testModel2')) instanceof testModel2_1.TestModel2).to.equal(true);
                    });
                });
                mocha_1.it('adding and removing many to one relation without repository support should return correct array lengths', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const model = new testModel_1.TestModel();
                        chai_1.expect(yield model.getProperty('testModels2')).a('array');
                        const model2 = yield model.add('testModels2');
                        chai_1.expect((yield model.getProperty('testModels2')).length).equals(1);
                        yield model2.remove();
                        chai_1.expect((yield model.getProperty('testModels2')).length).equals(0);
                    });
                });
                mocha_1.it('adding and removing many to one relation with repository support should return correct array lengths and ordering', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const model = new testModel_1.TestModel();
                        chai_1.expect(yield model.getProperty('testModels2')).a('array');
                        const model2 = yield model.add('testModels2');
                        chai_1.expect((yield model.getProperty('testModels2')).length).equals(1);
                        yield model2.remove();
                        chai_1.expect((yield model.getProperty('testModels2')).length).equals(0);
                        const modelFromRepo = yield repo.add();
                        chai_1.expect(yield modelFromRepo.getProperty('testModels2')).a('array');
                        yield modelFromRepo.add('testModels2', { name: '2' });
                        yield modelFromRepo.add('testModels2', { name: '3' });
                        yield modelFromRepo.add('testModels2', { name: '1' });
                        yield modelFromRepo.add('testModels2', { name: '5' });
                        yield modelFromRepo.add('testModels2', { name: '6' });
                        yield modelFromRepo.add('testModels2', { name: '7' });
                        yield modelFromRepo.add('testModels2', { name: '9' });
                        yield modelFromRepo.add('testModels2', { name: '4' });
                        yield modelFromRepo.add('testModels2', { name: '8' });
                        const waitForAllModels = () => __awaiter(this, void 0, void 0, function* () {
                            return new Promise((resolve1 => {
                                modelFromRepo.testModels2.subscribe((result) => {
                                    resolve1(result);
                                });
                            }));
                        });
                        const models = yield waitForAllModels();
                        chai_1.expect(models.length).equals(9);
                        chai_1.expect(models.map(value => value.name).join('')).equals('123456789');
                        const repoModel = yield repo._findOneByIdentifier(modelFromRepo.getIdentifier(), false).toPromise().then((m) => {
                            return m;
                        }).catch();
                        chai_1.expect((yield repoModel.getProperty('testModels2')).length).equals(9);
                        yield repo.remove(modelFromRepo);
                        const repoModelAfterRemoving = yield repo._findOneByIdentifier(modelFromRepo.getIdentifier(), false).toPromise().then((m) => {
                            return m;
                        }).catch();
                        chai_1.expect(repoModelAfterRemoving).equals(null);
                    });
                });
                mocha_1.it('moving from one many to one relation collection to an other should return correct allocations', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const modelFromRepo = yield repo.add();
                        const testModel = yield modelFromRepo.add('testModelsWithNameTest3');
                        const waitForTestModelsWithNameTest3 = () => __awaiter(this, void 0, void 0, function* () {
                            return new Promise((resolve1 => {
                                modelFromRepo.testModelsWithNameTest3.subscribe((e) => {
                                    resolve1(e);
                                });
                            }));
                        });
                        const testModelsWithNameTest3 = yield waitForTestModelsWithNameTest3();
                        chai_1.expect(testModelsWithNameTest3).length(1);
                        chai_1.expect(testModelsWithNameTest3[0].name).equals('test3');
                        yield testModelsWithNameTest3[0].move('testModelsWithNameTest4');
                        const waitForTestModelsWithNameTest4 = () => __awaiter(this, void 0, void 0, function* () {
                            return new Promise((resolve1 => {
                                modelFromRepo.testModelsWithNameTest4.subscribe((e) => {
                                    resolve1(e);
                                });
                            }));
                        });
                        const testModelsWithNameTest4 = yield waitForTestModelsWithNameTest4();
                        chai_1.expect(testModelsWithNameTest4).length(1);
                        chai_1.expect(testModelsWithNameTest4[0].name).equals('test4');
                        const waitForTestModelsWithNameTest3AfterMoved = () => __awaiter(this, void 0, void 0, function* () {
                            return new Promise((resolve1 => {
                                modelFromRepo.testModelsWithNameTest3.subscribe((e) => {
                                    resolve1(e);
                                });
                            }));
                        });
                        const testModelsWithNameTest4AfterMoved = yield waitForTestModelsWithNameTest3AfterMoved();
                        chai_1.expect(testModelsWithNameTest4AfterMoved).length(0);
                        yield repo.remove(testModelsWithNameTest4[0]);
                        yield repo.remove(testModel);
                        yield repo.remove(modelFromRepo);
                    });
                });
            });
        });
    });
}
exports.modelRelations = modelRelations;
