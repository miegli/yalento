"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const abstractModel_1 = require("../../../../src/abstractModel");
class TestModel3 extends abstractModel_1.AbstractModel {
    constructor() {
        super(...arguments);
        this.name = 'test';
        this.lastName = 'test';
    }
}
exports.TestModel3 = TestModel3;
