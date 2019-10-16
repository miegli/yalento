"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const modelTest_1 = require("./Model/modelTest");
const repositoryTest_1 = require("./Repository/repositoryTest");
const argv = require('yargs').argv;
const allTests = [modelTest_1.modelTest, repositoryTest_1.repositoryTest];
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
//# sourceMappingURL=tests.js.map