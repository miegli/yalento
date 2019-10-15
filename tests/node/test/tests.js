"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const modelTest_1 = require("./Model/modelTest");
const argv = require('yargs').argv;
const allTests = [modelTest_1.modelTest];
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
