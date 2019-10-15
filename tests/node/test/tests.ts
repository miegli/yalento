import { modelTest } from './Model/modelTest';

const argv = require('yargs').argv;

const allTests: any[] = [modelTest];
const tests = [];

if (argv.only && typeof argv.only === 'string') {
  argv.only = [argv.only];
}

allTests.forEach((t: any) => {
  if (!argv.only || argv.only.indexOf(t.name) >= 0) {
    tests.push(t());
  }
});

Promise.all(tests).then().catch();
