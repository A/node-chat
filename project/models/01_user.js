'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var mongoose            = require('mongoose');
var generatePassword    = require('password-generator');
var env                 = process.env.NODE_ENV;
var timestamps          = require('mongoose-timestamp');
var SMSSender           = require('smsc');
var sender              = new SMSSender(
                            config.get('SMSSENDER_CREDENTIALS').split(':')[0],
                            config.get('SMSSENDER_CREDENTIALS').split(':')[1]
                          );

// End of dependencies.


var UserSchema = new mongoose.Schema({
  phone: {
    type: Number,
    unique: true,
    required: true
  },
  // TODO: Сделать password виртуальным полем, а пароль хранить как хэш с солью
  password: {
    type: String,
    required: true
  },
  nickname: String,
  location: String,
  photo: String,
  dob: Date,
  gender: Number,
  room: {
    type: String,
    ref: 'Room'
  },
  gifts: [{
    type: String,
    ref: 'SendedGift'
  }],
  rooms: [{
    type: String,
    ref: 'Room'
  }],
  visitedRooms: [{
    type: String,
    ref: 'Room'
  }],
  balance: {
    type: Number,
    default: 0
  },
  freeCoins: {
    'mailru': {
      type: Date
    },
    'vk': {
      type: Date
    },
    'twitter': {
      type: Date
    },
    'facebook': {
      type: Date
    }
  },
  create_at: {
    type: Date,
    default: Date.now
  }
});


UserSchema.statics.create = function (phone, cb) {
    var User = this;
    var isNew;
    var user;
    this.findOne({phone: phone}, function (err, _user) {
      user = _user
        ? _user
        : new User({
            phone: phone
          });
      user.password = generatePassword(4, false, '[0-9]');
      user.save(function(err, user) {
        if (err) { return cb(err); }
        'test' === env
          ? cb(null, user, !_user)
          : sender.sms(user.phone, config.get('SMS_MESSAGE').replace('%n', user.password), function (err, message) {
              cb(err, user, !_user);
            });
      });
    });
};


UserSchema.methods.removeRoom = function (rid) {
  var index = this.rooms.indexOf(rid.toString());
  while (!! ~index) {
    !! ~index && this.rooms.splice(index, 1);
    index = this.rooms.indexOf(rid.toString());
  }
  this.save();
};


UserSchema.options.toObject = {
  transform: function (doc, ret, options) {
    if (ret.dob) {
      ret.dob = ret.dob.getTime();
    }
    if (ret.create_at) {
      ret.create_at = ret.create_at.getTime();
    }
    delete ret.freeCoins;
    delete ret.password;
  }
};


UserSchema.pre('remove', function(next){
  this.model('Room').update(
    {_id: {$in: this.visitedRooms}},
    {$pull: {visiters: this._id}},
    {multi: true},
    next
  );
});

UserSchema.plugin(timestamps);
mongoose.model('User', UserSchema);
