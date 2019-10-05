import { modelRelations } from './modelRelations';
import { paths } from './paths';
import { repository } from './repository';
import { model } from './model';
import { serialize } from './serialize';
import { watch } from './watch';

const argv = require('yargs').argv;

const allTests: any[] = [repository, model, modelRelations, serialize, paths, watch];
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
