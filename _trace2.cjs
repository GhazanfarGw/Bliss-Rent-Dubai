const Module = require('module');
const orig = Module.prototype.require;
let count = 0;
const start = Date.now();
Module.prototype.require = function(id) {
  count++;
  return orig.apply(this, arguments);
};
require('undici');
console.log('undici ok, total requires:', count, 'elapsed ms:', Date.now()-start);
