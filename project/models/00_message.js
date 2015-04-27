'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var mongoose            = require('mongoose');

// End of dependencies.


var MessageSchema = new mongoose.Schema({
  author: {
    type: String,
    ref: 'User'
  },
  text: {
    type: String,
  },
  room: {
    type: String,
    ref: 'Room'
  },
  ref_message: {},
  create_at: {
    type: Date,
    default: Date.now
  },
  unread: {
    type: Boolean,
    default: false
  },
  user: {
    type: String,
    ref: 'User'
  },
  type: String,
  finished: Number
});


MessageSchema.methods = {
  // Отправляет уведомление определенного типа всем пользователям комнаты
  notify: function (sio, type, apn, apnConnection) {
    var message = this;
    mongoose.model('Session').find({user: message.user}, function (err, sessions) {
      sessions.forEach(function (session) {
        session.sockets.length
          ? session.sockets.forEach(function (socketID) {
              sio.sockets.socket(socketID).emit(type, {data: {message: message.toObject()}});
            })
          : session.ios_tokens[0]
              ? message.pushMessage(apn, apnConnection, session.ios_tokens[0])
              : void 0;
      });
    });
    mongoose.model('Session').find({user: message.author}, function (err, sessions) {
      sessions.forEach(function (session) {
        session.sockets.forEach(function (socketID) {
          sio.sockets.socket(socketID).emit(type, {data: {message: message.toObject()}});
        });
      });
    });
    return true;
  },
  pushMessage: function (apn, apnConnection, ios_token) {
    if (!apn || !apnConnection) { return false; }
    var message = this;
    var device = new apn.Device(ios_token);
    var note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 360000; // Expires 1 hour from now.
    note.payload = {
      author: message.author
    };
    note.sound = 'dialog.wav';
    mongoose
      .model('Message')
      .find({user: message.user, unread: true})
      .count()
      .exec(function (err, unread) {
        note.badge = unread;
        mongoose
          .model('User')
          .findOne({_id: message.author}, function (err, author) {
            note.alert = '@%author: %message'
                            .replace('%author', author.nickname)
                            .replace('%message', message.text);
            apnConnection.pushNotification(note, device);
          });
      });
  }
};


MessageSchema.options.toObject = {
  transform: function (doc, ret, options) {
    if (ret.create_at) {
      ret.create_at = ret.create_at.getTime();
    }
  }
};


mongoose.model('Message', MessageSchema);
