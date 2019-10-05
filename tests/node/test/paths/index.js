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
function paths() {
    return new Promise((resolve) => {
        const firestore = helper_1.getFirestore();
        const repo = new testRepository_1.TestRepository(firestore);
        mocha_1.describe('Paths', function () {
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
                        const testModel1 = yield modelFromRepo.add('testModels');
                        const testModel2 = yield modelFromRepo.add('testModels');
                        const persistedTestModelFromNotExistingPathQuery = yield repo.find({ path: modelFromRepo.getIdentifier() + '/noexisting' }).toPromise();
                        chai_1.expect(persistedTestModelFromNotExistingPathQuery.length).equal(0);
                        const persistedTestModelFromPathQuery = yield repo.find({ path: modelFromRepo.getIdentifier() + '/testmodel2' }).toPromise();
                        chai_1.expect(persistedTestModelFromPathQuery.length).equal(2);
                        const persistedTestModelFromOddPathQuery = yield repo.find({ path: modelFromRepo.getIdentifier() }).toPromise();
                        chai_1.expect(persistedTestModelFromOddPathQuery.length).equal(1);
                        yield repo.remove(modelFromRepo);
                        yield repo.remove(testModel1);
                        yield repo.remove(testModel2);
                        yield repo.remove(modelFromRepo);
                    });
                });
            });
        });
    });
}
exports.paths = paths;
