"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const abstractRepository_1 = require("../../../../src/abstractRepository");
const testModel_1 = require("../model/testModel");
class TestRepository extends abstractRepository_1.AbstractRepository {
    constructor() {
        super(...arguments);
        this.path = '/testModel';
        this.model = testModel_1.TestModel;
    }
}
exports.TestRepository = TestRepository;
