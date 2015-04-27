'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');
var mongoose            = require('mongoose');
// End of dependencies.


module.exports = function (done) {
  var sio = this.io;
  setInterval(function () {
    var Message = mongoose.model('Message');
    mongoose
      .model('User')
      .where({
        updatedAt: {
          $lte: new Date(new Date() - 15 * 60 * 1000)
          // $lte: new Date(new Date() - 1 * 60 * 1000)
        }, room: {
          $exists: true,
          $ne: null
        }
      })
      .exec(function (err, users) {
        users.map(function (user) {
          log.info('map to timeout user: %user (%_id)'
            .replace('%user', user.nickname)
            .replace('%_id', user._id.toString())
          );
          mongoose
            .model('Room')
            .findById(user.room, function (err, room) {
              if (room) {
                var messageQuit = new Message({
                  type: 'roommate quits',
                  user: user._id,
                  room: room._id
                });
                log.info('remove user: %user (%_id)'
                  .replace('%user', user.nickname)
                  .replace('%_id', user._id.toString())
                );
                room.removeUser(user._id, sio, messageQuit.toObject());
              }
              user.room = null;
              user.save();
            });
        });
      });
  }, 5 * 60 * 1000);
  // }, 1 * 1 * 1000); // test
  done();
};