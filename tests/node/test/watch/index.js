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
function watch() {
    return new Promise((resolve) => {
        const firestore = helper_1.getFirestore();
        const repo = new testRepository_1.TestRepository(firestore);
        mocha_1.describe('Watch', function () {
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
                mocha_1.it('changes in model should be watchable', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const modelFromRepo = yield repo.add();
                        const watchNames = (identifier) => {
                            return new Promise((resolve1) => {
                                let names = [];
                                repo._findOneByIdentifier(identifier, true).subscribe((model) => {
                                    if (model) {
                                        names.push(model.name);
                                        if (names.length > 2) {
                                            resolve1(names);
                                        }
                                    }
                                    else {
                                        resolve1(names);
                                    }
                                });
                                setTimeout(() => {
                                    modelFromRepo.name = 'test2';
                                    modelFromRepo.save();
                                }, 500);
                                setTimeout(() => {
                                    modelFromRepo.name = 'test3';
                                    modelFromRepo.save();
                                }, 750);
                                setTimeout(() => {
                                    modelFromRepo.name = 'test3';
                                    modelFromRepo.save();
                                }, 1000);
                            });
                        };
                        const names = yield watchNames(modelFromRepo.getIdentifier());
                        chai_1.expect(names.length).to.equal(3);
                        chai_1.expect(names.join('-')).to.equal('test1-test2-test3');
                        const namesForNotExistingIdentifier = yield watchNames('notexisting');
                        chai_1.expect(namesForNotExistingIdentifier.length).to.equal(0);
                        yield repo.remove(modelFromRepo);
                    });
                });
            });
        });
    });
}
exports.watch = watch;
