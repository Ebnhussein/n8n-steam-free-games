'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = process.env.DATA_DIR || path.resolve('data');
function read(name) { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); }
function save(name, data) {
  fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  const dest = path.join(dir, name), tmp = dest + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), {mode: 0o600});
  fs.renameSync(tmp, dest);
}
function apiKey() {
  const file = path.join(dir, 'api-key');
  fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  try { fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), {mode: 0o600, flag: 'wx'}); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
  return fs.readFileSync(file, 'utf8').trim();
}
module.exports = {read, save, apiKey};
