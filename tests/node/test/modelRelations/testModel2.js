"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const abstractModel_1 = require("../../../../src/abstractModel");
const testModel3_1 = require("./testModel3");
class TestModel2 extends abstractModel_1.AbstractModel {
    constructor() {
        super(...arguments);
        this.name = 'test';
        this.lastName = 'test';
        this.testModel3 = new testModel3_1.TestModel3();
    }
}
exports.TestModel2 = TestModel2;
