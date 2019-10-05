"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const abstractModel_1 = require("../../../../src/abstractModel");
const testModel2_1 = require("./testModel2");
class TestModel extends abstractModel_1.AbstractModel {
    constructor() {
        super(...arguments);
        this.name = 'test';
        this.testModels = this.manyToOne(testModel2_1.TestModel2, 'testModels', { orderBy: 'name' });
    }
}
exports.TestModel = TestModel;
