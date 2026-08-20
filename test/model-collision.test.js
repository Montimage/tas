const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { request } = require('./_http');

const modelRouter = require('../src/server/routes/model');

const modelsDir = path.resolve(__dirname, '../src/server/data/models');

let server;
let app;

before(() => {
  app = express();
  app.use(express.json());
  app.use('/api/models', modelRouter);
  server = app.listen(0);
});

after(() => {
  server.close();
});

const unique = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const inModelsDir = (fileName) => path.join(modelsDir, fileName);

test('models POST refuses an existing name with 409 and reports only written files', async () => {
  const name = unique('collision-create');
  const fileName = `${name}.json`;
  const body = { model: { name, devices: [] } };

  try {
    const create = await request(server, 'POST', '/api/models', body);
    assert.equal(create.status, 200);
    assert.equal(create.body.modelFileName, fileName);

    const again = await request(server, 'POST', '/api/models', body);
    assert.equal(
      again.status,
      409,
      `expected 409 for duplicate name, got ${again.status} (${again.raw})`
    );

    // The reported filename must always be readable afterwards, and the
    // refused create must leave the original untouched with no stray
    // timestamped copies behind.
    const read = await request(server, 'GET', `/api/models/${encodeURIComponent(fileName)}`);
    assert.equal(read.status, 200);
    assert.equal(read.body.model.name, name);

    const leftovers = fs
      .readdirSync(modelsDir)
      .filter((f) => f.startsWith(`${name}-`) && f.endsWith('.json'));
    assert.deepEqual(leftovers, [], 'no renamed leftover files may be created');
  } finally {
    fs.rmSync(inModelsDir(fileName), { force: true });
  }
});

test('models POST duplicate twice yields two distinct readable files', async () => {
  const name = unique('collision-dup');
  const fileName = `${name}.json`;

  try {
    const create = await request(server, 'POST', '/api/models', {
      model: { name, devices: [] },
    });
    assert.equal(create.status, 200);

    const first = await request(server, 'POST', `/api/models/${encodeURIComponent(fileName)}`, {
      isDuplicated: true,
    });
    assert.equal(first.status, 200);
    const firstDupName = first.body.modelFileName;
    assert.ok(firstDupName.includes('[Duplicated]'), `expected [Duplicated] in ${firstDupName}`);
    assert.ok(fs.existsSync(inModelsDir(firstDupName)));

    const second = await request(server, 'POST', `/api/models/${encodeURIComponent(fileName)}`, {
      isDuplicated: true,
    });
    assert.equal(second.status, 200);
    const secondDupName = second.body.modelFileName;
    assert.notEqual(
      secondDupName,
      firstDupName,
      'the second duplicate must target a different file'
    );
    assert.ok(fs.existsSync(inModelsDir(secondDupName)), 'second duplicate must exist');
    assert.ok(
      fs.existsSync(inModelsDir(firstDupName)),
      'first duplicate must not be overwritten by the second'
    );

    const readFirst = await request(
      server,
      'GET',
      `/api/models/${encodeURIComponent(firstDupName)}`
    );
    assert.equal(readFirst.status, 200);
    assert.equal(readFirst.body.model.name, firstDupName.replace(/\.json$/, ''));

    const readSecond = await request(
      server,
      'GET',
      `/api/models/${encodeURIComponent(secondDupName)}`
    );
    assert.equal(readSecond.status, 200);
    assert.equal(readSecond.body.model.name, secondDupName.replace(/\.json$/, ''));
  } finally {
    fs.rmSync(inModelsDir(fileName), { force: true });
    for (const f of fs.readdirSync(modelsDir)) {
      if (f.startsWith(`${name} [Duplicated]`)) fs.rmSync(inModelsDir(f), { force: true });
    }
  }
});
