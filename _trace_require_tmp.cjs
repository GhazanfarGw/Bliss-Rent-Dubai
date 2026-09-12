const Module = require('module');
const orig = Module.prototype.require;
Module.prototype.require = function(id) {
  console.log('requiring:', id);
  return orig.apply(this, arguments);
};
console.log('start');
require('undici');
console.log('undici ok');
