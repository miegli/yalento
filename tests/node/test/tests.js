"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const modelRelations_1 = require("./modelRelations");
const paths_1 = require("./paths");
const repository_1 = require("./repository");
const model_1 = require("./model");
const serialize_1 = require("./serialize");
const watch_1 = require("./watch");
const argv = require('yargs').argv;
const allTests = [repository_1.repository, model_1.model, modelRelations_1.modelRelations, serialize_1.serialize, paths_1.paths, watch_1.watch];
const tests = [];
if (argv.only && typeof argv.only === 'string') {
    argv.only = [argv.only];
}
allTests.forEach((t) => {
    if (!argv.only || argv.only.indexOf(t.name) >= 0) {
        tests.push(t());
    }
});
Promise.all(tests).then().catch();
