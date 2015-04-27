'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var mongoose            = require('mongoose');
var MessageSchema       = mongoose.model('Message').schema;


// End of dependencies.


var RoomSchema = new mongoose.Schema({
  city: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    required: true
  },
  password: String,
  max_users: {
    type: Number,
    default: 255
  },
  admin: {
    type: String,
    ref: 'User'
  },
  moderators: [{
    type: String,
    ref: 'User'
  }],
  users: [{
    type: String,
    ref: 'User'
  }],
  banned: [{
    type: String,
    ref: 'User'
  }],
  visiters: [{
    type: String,
    ref: 'User'
  }],
  silently: {},
  chat: [MessageSchema],
  create_at: {
    type: Date,
    default: Date.now
  }
});


RoomSchema.methods = {
  // Отправляет уведомление определенного типа всем пользователям комнаты
  notify: function (sio, type, message) {
    this.users.forEach(function (user) {
      mongoose.model('Session').find({user: user}, function (err, sessions) {
        sessions.forEach(function (session) {
          session.sockets.forEach(function (socketID) {
            sio.sockets.socket(socketID).emit(type, message);
          });
        });
      });
    });
  },
  removeUser: function (uid, sio, message, cb) {
    this.chat.push(message);
    if (message.type === 'ban') {
      this.banned.push(uid.toString());
    }
    this.notify(sio, 'service-message', {data: {message: message}});
    var index = this.users.indexOf(uid.toString());
    while (!! ~index) {
      !! ~index && this.users.splice(index, 1);
      index = this.users.indexOf(uid.toString());
    }
    this.save(cb);
  },
  isMuted: function (user) {
    if (!this.silently) { return false; }
    var silence = this.silently[user._id.toString()];
    if (!silence) { return false; }
    if (silence > (+new Date())) {
      return true;
    }
    if (silence < (+new Date())) {
      delete this.silently[user._id.toString()];
      return false;
    }
    return false;
  }
};





RoomSchema.options.toObject = {
  transform: function (doc, ret, options) {
    ret.is_private = !!ret.password;
    if (ret.create_at) {
      ret.create_at = ret.create_at.getTime();
    }
    delete ret.password;
  }
};

RoomSchema.pre('remove', function(next){
    this.model('User').update(
        {_id: {$in: this.visiters}},
        {$pull: {visitedRooms: this._id}},
        {multi: true},
        next
    );
});

mongoose.model('Room', RoomSchema);
