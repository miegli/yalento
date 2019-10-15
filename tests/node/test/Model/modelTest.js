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
function modelTest() {
    return new Promise((resolve) => {
        mocha_1.describe('RepositoryTest', () => __awaiter(this, void 0, void 0, function* () {
            mocha_1.after(() => __awaiter(this, void 0, void 0, function* () {
                resolve();
            }));
            mocha_1.it('model extends abstractModel', () => __awaiter(this, void 0, void 0, function* () {
                chai_1.expect(1).to.equal(1);
            }));
        }));
    });
}
exports.modelTest = modelTest;
