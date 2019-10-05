#!/bin/bash
set -e
cd node
npm run test
cd ..
cd angular
npm run test-headless
cd ..
