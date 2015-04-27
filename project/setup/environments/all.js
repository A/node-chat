'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var express             = require('express');
var RedisStore          = require('connect-redis')(express);
var multipart           = require('connect-multiparty');
var pwd                 = require('process-pwd');
var moment              = require('moment');
// var authenticate   = require('../../controllers/user').authenticate;

// end of dependencies.


module.exports = function () {
  this.set('views', pwd + '/views');
  this.set('view engine', 'jade');
  this.locals.moment = moment;
  this.use(express.favicon());
  this.use(express.bodyParser({
    uploadDir: config.get('UPLOAD_DIR'),
    keepExtensions: true
  }));
  this.use(express.methodOverride());
  this.use(this.router);
  this.use(express.static(pwd + '/public'));
  this.use(express.errorHandler());
};