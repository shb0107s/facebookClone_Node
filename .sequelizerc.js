const path = require('path');

module.exports = {
  config: path.resolve('db/config/config.js'),
  'models-path': path.resolve('db/models'),
  'seeders-path': path.resolve('db/seeders'),
  'migrations-path': path.resolve('db/migrations'),
};
