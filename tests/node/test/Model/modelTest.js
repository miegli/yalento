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
}
exports.Contact = Contact;
function modelTest() {
    return new Promise((resolve) => {
        mocha_1.describe('ModelTest', () => __awaiter(this, void 0, void 0, function* () {
            mocha_1.after(() => __awaiter(this, void 0, void 0, function* () {
                resolve();
            }));
            mocha_1.it('construct new repository', () => __awaiter(this, void 0, void 0, function* () {
                const contact = new Contact();
                chai_1.expect(contact instanceof src_1.Base).to.be.true;
            }));
        }));
    });
}
exports.modelTest = modelTest;
//# sourceMappingURL=modelTest.js.map