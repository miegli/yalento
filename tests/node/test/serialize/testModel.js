"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const abstractModel_1 = require("../../../../src/abstractModel");
const testModel2_1 = require("./testModel2");
class TestModel extends abstractModel_1.AbstractModel {
    constructor() {
        super(...arguments);
        this.name = 'test';
        this.testModel2 = new testModel2_1.TestModel2();
        this.testModels2 = this.manyToOne(testModel2_1.TestModel2, 'testModels2', { orderBy: 'name' });
        this.testModelsWithNameTest3 = this.manyToOne(testModel2_1.TestModel2, 'testModelsWithNameTest3', {
            where: [{
                    property: 'name',
                    operation: '==',
                    value: 'test3',
                }],
        });
        this.testModelsWithNameTest4 = this.manyToOne(testModel2_1.TestModel2, 'testModelsWithNameTest4', {
            where: [{
                    property: 'name',
                    operation: '==',
                    value: 'test4',
                }],
        });
    }
}
exports.TestModel = TestModel;
