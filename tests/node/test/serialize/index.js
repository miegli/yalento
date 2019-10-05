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
const testRepository_1 = require("./testRepository");
function serialize() {
    return new Promise((resolve) => {
        const firestore = helper_1.getFirestore();
        const repo = new testRepository_1.TestRepository(firestore);
        mocha_1.describe('Serialize', function () {
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
                mocha_1.it('model toJson method should return a representing json', function () {
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
                        const jsonFromTestModelsWithNameTest3 = yield testModelsWithNameTest3[0].toJson();
                        chai_1.expect(jsonFromTestModelsWithNameTest3.testModel3.lastName).equals('test');
                        const persistedTestModelAsJson = yield (yield repo._findOneByIdentifier(modelFromRepo.getIdentifier()).toPromise()).toJson();
                        chai_1.expect(persistedTestModelAsJson.name).equal('test');
                        chai_1.expect(persistedTestModelAsJson.testModel2.testModel3.name).equal('test');
                        chai_1.expect(persistedTestModelAsJson.testModelsWithNameTest4).length(0);
                        chai_1.expect(persistedTestModelAsJson.testModelsWithNameTest3).length(1);
                        chai_1.expect(persistedTestModelAsJson.testModelsWithNameTest3[0].name).equal('test3');
                        chai_1.expect(persistedTestModelAsJson.testModelsWithNameTest3[0].testModel3.name).equal('test');
                        yield repo.remove(testModelsWithNameTest3[0]);
                        yield repo.remove(testModel);
                        yield repo.remove(modelFromRepo);
                    });
                });
                mocha_1.it('repository toJson with identifier as query should return a representing json', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const modelFromRepo = yield repo.add({ 'name': 'testName' }, 'testIdentifier');
                        const testModel = yield modelFromRepo.add('testModelsWithNameTest3');
                        const waitForTestModelsWithNameTest3 = () => __awaiter(this, void 0, void 0, function* () {
                            return new Promise((resolve1 => {
                                modelFromRepo.testModelsWithNameTest3.subscribe((e) => {
                                    resolve1(e);
                                });
                            }));
                        });
                        const testModelsWithNameTest3 = yield waitForTestModelsWithNameTest3();
                        const jsonFromTestModelsWithNameTest3 = yield testModelsWithNameTest3[0].toJson();
                        chai_1.expect(jsonFromTestModelsWithNameTest3.testModel3.lastName).equals('test');
                        const json = yield repo.toJson({ identifier: 'testIdentifier' });
                        chai_1.expect(json.name).equal('testName');
                        yield repo.remove(testModelsWithNameTest3[0]);
                        yield repo.remove(testModel);
                        yield repo.remove(modelFromRepo);
                    });
                });
            });
        });
    });
}
exports.serialize = serialize;
