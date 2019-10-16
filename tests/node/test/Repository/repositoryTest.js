"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const mocha_1 = require("mocha");
const src_1 = require("../../../../src");
class Contact extends src_1.Base {
    constructor(name, lastName, age) {
        super();
        this.name = name;
        this.lastName = lastName;
        this.age = age;
    }
}
exports.Contact = Contact;
function repositoryTest() {
    return new Promise((resolve) => {
        mocha_1.describe('RepositoryTest', () => __awaiter(this, void 0, void 0, function* () {
            mocha_1.after(() => __awaiter(this, void 0, void 0, function* () {
                resolve();
            }));
            mocha_1.it('construct new repository should instantiate with model without constructor parameters', () => __awaiter(this, void 0, void 0, function* () {
                const repository = new src_1.Repository(Contact);
                chai_1.expect(repository instanceof src_1.Repository).to.be.true;
            }));
            mocha_1.it('construct new repository should instantiate with model constructor parameters and create model based on them', () => __awaiter(this, void 0, void 0, function* () {
                const repository = new src_1.Repository(Contact, 'test1', 'test2', 1);
                const model = repository.create({ street: 'testStreet' });
                chai_1.expect(model.name).to.be.equal('test1');
                chai_1.expect(model.lastName).to.be.equal('test2');
                chai_1.expect(model.street).to.be.equal('testStreet');
                chai_1.expect(model.age).to.be.equal(1);
            }));
        }));
    });
}
exports.repositoryTest = repositoryTest;
//# sourceMappingURL=repositoryTest.js.map