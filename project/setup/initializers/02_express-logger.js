'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');
var express        = require('express');

// End of dependencies.


module.exports = function () {
  express.logger.token('time', function (req, res) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function makeTwoDigits(d) {
      d = d.toString();
      return d.length === 1
        ? '0' + d
        : d;
    }

    var date       = new Date();
    var day        = date.getDate();
    var month      = months[date.getMonth()];
    var hours      = makeTwoDigits(date.getHours());
    var minutes    = makeTwoDigits(date.getMinutes());
    var seconds    = makeTwoDigits(date.getSeconds());

    return [
      [day, month].join(' '),
      [hours, minutes, seconds ].join(':')
    ].join(' ');
  });

  express.logger.format('microlog', [':time', '—', ':status   '.cyan, '[:method]'.grey, ':url'].join(' '));
  if ('test' !== this.get('env')) {
    this.use(express.logger('microlog'));
  }
};