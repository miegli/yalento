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
const testModel2_1 = require("../model/testModel2");
const testRepository_1 = require("./testRepository");
function repository() {
    return new Promise((resolve) => {
        const firestore = helper_1.getFirestore();
        const repo = new testRepository_1.TestRepository(firestore);
        mocha_1.describe('Repository', () => __awaiter(this, void 0, void 0, function* () {
            mocha_1.after(() => __awaiter(this, void 0, void 0, function* () {
                resolve();
            }));
            mocha_1.before(() => __awaiter(this, void 0, void 0, function* () {
            }));
            mocha_1.it('deleting an not existing item from repository should return true', () => __awaiter(this, void 0, void 0, function* () {
                const status = yield repo.remove('notexistingkey').then((e) => {
                    return e;
                }).catch((e) => {
                    console.log(e);
                });
                chai_1.expect(status).to.equal(true);
            }));
            mocha_1.it('adding a new document should return a persisted model', () => __awaiter(this, void 0, void 0, function* () {
                let model;
                let model2;
                let model3;
                model = yield repo.add({ lastName: 'lastName', name: 'name' }, 'test').then((m) => {
                    return m;
                }).catch();
                chai_1.expect(model.getIdentifier()).to.equals('test');
                model = yield repo._findOneByIdentifier('test', false).toPromise().then((m) => {
                    return m;
                }).catch();
                chai_1.expect(model.getIdentifier()).to.equals('test');
                chai_1.expect(model.name).to.equals('name');
                chai_1.expect(model.lastName).to.equals('lastName');
                model2 = yield repo.find({ identifier: 'test' }).toPromise().then((m) => {
                    return m;
                }).catch();
                chai_1.expect(model2[0].getIdentifier()).to.equals('test');
                chai_1.expect(model2[0].name).to.equals('name');
                chai_1.expect(model2[0].lastName).to.equals('lastName');
                model3 = yield repo.find({ path: 'test' }).toPromise().then((m) => {
                    return m;
                }).catch();
                chai_1.expect(model3[0].getIdentifier()).to.equals('test');
                chai_1.expect(model3[0].name).to.equals('name');
                chai_1.expect(model3[0].lastName).to.equals('lastName');
            }));
            mocha_1.it('repository without query should be exported as json', () => __awaiter(this, void 0, void 0, function* () {
                const json = yield repo.toJson().then((s) => {
                    return s;
                }).catch((e) => {
                    return {};
                });
                chai_1.expect(json).to.length(1);
            }));
            mocha_1.it('repository with matching query should be exported as json', () => __awaiter(this, void 0, void 0, function* () {
                const json = yield repo.toJson({
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
                chai_1.expect(json).to.length(1);
            }));
            mocha_1.it('repository should be queried with all available operators', () => __awaiter(this, void 0, void 0, function* () {
                chai_1.expect(yield repo.find({
                    where: [{
                            property: 'name',
                            operation: '==',
                            value: 'name',
                        }],
                }).toPromise().then((r) => {
                    return r;
                })).to.length(1);
                chai_1.expect(yield repo.find({
                    where: [{
                            property: 'name',
                            operation: '==',
                            value: 'noname',
                        }],
                }).toPromise().then((r) => {
                    return r;
                })).to.length(0);
            }));
            mocha_1.it('repository with query in watching mode and subscribeUntil parameter should get timed out', () => __awaiter(this, void 0, void 0, function* () {
                const timeout = 1000;
                let startTime = new Date().getMilliseconds();
                yield repo.find(null, true, { until: 'timeout', value: timeout }).toPromise().then((r) => {
                    return r;
                });
                let deltaTime = 1 + ((new Date().getMilliseconds() - startTime) * 1000);
                chai_1.expect(deltaTime).to.greaterThan(timeout);
            }));
            mocha_1.it('model should not be accepted if it is from wrong instance type', () => __awaiter(this, void 0, void 0, function* () {
                const model = new testModel2_1.TestModel2();
                const error = yield repo.update(model).catch((e) => {
                    return e;
                });
                chai_1.expect(error).contains('repository accepts only objects of ');
            }));
            mocha_1.it('deleting an item from repository should return true', () => __awaiter(this, void 0, void 0, function* () {
                const status = yield repo.remove('test').then((e) => {
                    return e;
                }).catch((e) => {
                    console.log(e);
                });
                chai_1.expect(status).to.equal(true);
            }));
            mocha_1.it('not existing document should return null', () => __awaiter(this, void 0, void 0, function* () {
                const model = yield repo._findOneByIdentifier('test', false).toPromise().then((m) => {
                    return m;
                }).catch();
                chai_1.expect(model).to.equals(null);
                const models = yield repo.find({ identifier: 'test' }).toPromise().then((m) => {
                    return m;
                }).catch();
                chai_1.expect(models.length).to.equal(0);
            }));
        }));
    });
}
exports.repository = repository;
