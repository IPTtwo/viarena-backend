import test from 'node:test';import assert from 'node:assert/strict';import {app} from '../src/app.js';
test('express application is constructed',()=>{assert.equal(typeof app.listen,'function');});
