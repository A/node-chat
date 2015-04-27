'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var Room                = require('mongoose').model('Room');
var Message             = require('mongoose').model('Message');
var Session             = require('mongoose').model('Session');
var User                = require('mongoose').model('User');

// End of dependencies.


exports.create = function () {
  return function (req, res) {
    var room = new Room(req.body.room);
    room.admin = req.user._id;
    req.user.rooms.push(room._id);
    req.user.save(function () {
      room.save(function (err) {
        if (err) {
          !! ~err.message.indexOf('E11000')
            ? res.json(409, {error: err.message})
            : res.json(500, {error: err.message});
          return;
        }
        res.json(201, {
          data: {
            room: room.toObject()
          }
        });
      });
    });
  };
};


exports.enter = function (sio) {
  return function (req, res) {
    Room.findById(req.body.room.id, function (err, room) {
      if (!room) {return res.json(404, { error: 'Room not found'}); }
      if (room.users.length >= room.max_users) { return res.json(423, {error: 'Room is filled'}); }
      if (err) { return res.json(500, { error: err.message}); }
      if (room.password && room.password !== req.body.room.password) {
        return res.json(401, {error: 'Wrong password'});
      }
      if (~room.banned.indexOf(req.user._id.toString())) {
        return res.json(403, {error: 'You\'re banned!'});
      }

      var message = new Message({
        type: 'new roommate',
        user: req.user._id,
        room: room._id
      });
      Room.findById(req.user.room, function (err, oldroom) {
        // Save viseters and visited rooms
        ! ~req.user.visitedRooms.indexOf(room._id.toString())
          && req.user.visitedRooms.push(room._id);
        ! ~room.visiters.indexOf(req.user._id.toString())
          && room.visiters.push(req.user._id);
        room.chat.push(message);
        room.notify(sio, 'service-message', {data: {message: message.toObject()}});
        if (oldroom) {
          var messageQuit = new Message({
            type: 'roommate quits',
            user: req.user._id,
            room: oldroom._id
          });
          oldroom.removeUser(req.user._id, sio, messageQuit.toObject());
        }
        room.users.push(req.user._id);
        req.user.room = room._id;
        room.save(function (err, room) {
          err
            ? res.json(500, {error: err.message})
            : req.user.save(function (err) {
                err
                  ? res.json(500, {error: err.message})
                  : (room.chat = undefined)
                    , res.json(200, {
                        data: {
                          room: room.toObject()
                        }
                      });
              });
          });
      });
    });
  };
};


exports.sendMessage = function (sio) {
  return function (req, res) {
    Room.findById(req.body.message.room_id, function (err, room) {
      // console.log(room.isMuted(req.user)
        // ? 'user is muted'
        // : 'user don\'t muted'
      // );
      if (room.isMuted(req.user)) {
        return res.json(403, {error: 'You\'re muted'});
      }
      var message = new Message({
        author: req.user._id,
        text: req.body.message.text,
        room: room._id.toString()
      });
      room.chat.push(message);
      room.save(function (err) {
        err
          ? res.json(500, {error: err.message})
          : room.notify(sio, 'message', {
              data: {
                message: message.toObject()
              }
            }),
            res.json(200, {
              data: {
                message: message.toObject()
              }
            });
      });
    });
  };
};


exports.del = function () {
  return function (req, res) {
    Room.findById(req.body.room.id, function (err, room) {
      err
        ? res.json(500, {error: err.message})
        : room
          ? room.admin.toString() === req.user._id.toString()
            ? room.remove(function (err) {
                err
                  ? res.json(500, {error: err.message})
                  : res.json(200, {})
                    , req.user.removeRoom(room._id);
                })
          : res.json(403, {error: 'Only admin can remove the room'})
        : res.json(404, {error: 'Room not found'});
    });
  };
};



exports.get = function () {
  return function (req, res) {
    var id = req.body.room_id;
    var select = {};
    var filter = req.body.filter || {};
    var name = req.body.name;
    var regexName = new RegExp(name, 'i');
    var perPage = req.body.per_page || 40;
    var page = req.body.page || 1;
    var query = Room.find(null);
    var countQuery = Room.find(null).count(); // Сколько всего документов?
    var cityQuery = Room.findOne({city: true, name: req.user.location });
    // Пагинация
    query.limit(perPage);
    page-1
      && query.skip(perPage*(page-1));

    id
      && query.where({_id: id})
      && countQuery.where({_id: id});

    name
      && query.where({name: regexName})
      && countQuery.where({name: regexName});

    // Сортировка
    req.body.sort
      && query.sort(req.body.sort);

    // Фильтры
    filter.privated
      && query.$where('!this.password')
      && countQuery.$where('!this.password');
    filter.filled
      && query.$where('this.users.length < this.max_users')
      && countQuery.$where('this.users.length < this.max_users');

    countQuery.exec(function (err, count) {
      if (filter.countOnly) {
        return err
          ? res.json(500, {error: err.message})
          : res.json({
              data: {
                count: count
              }
            });
      } else {
        query.exec(function (err, rooms) {
          if (err) { return res.json(500, {error: err.message }); }
          // need to use cityRoom?
          if (id || name || filter.privated) {
            return res.json({
              data: {
                count: count,
                rooms: rooms.map(function (room) {
                  room.chat = undefined;
                  return room.toObject();
                })
              }
            });
          } else {
            // get cityroom
            cityQuery.exec(function(err, cityRoom) {
              if (err) { return res.json(500, {error: err.message }); }
              if (!cityRoom) {
                cityRoom = new Room({ city: true, name: req.user.location });
                cityRoom.save(function() {});
              } else {
                rooms = rooms.filter(function(room) {
                  return room._id.toString() !== cityRoom._id.toString();
                });
              }
              return res.json({
                data: {
                  count: count,
                  rooms: [cityRoom].concat(rooms.map(function (room) {
                    room.chat = undefined;
                    return room.toObject();
                  }))
                }
              });
            });
          }
        });
      }
    });
  };
};


exports.addModerator = function (sio) {
  return function (req, res) {
    if (!req.body.user_id) { return res.json(400, {error: 'Undefined user_id'}); }
    if (!req.body.room_id) { return res.json(400, {error: 'Undefined room_id'}); }
    Room.findById(req.body.room_id, function (err, room) {
      if (room.admin !== req.user._id.toString()) {
        return res.json(403, {error:'Only admin can add moderators'});
      }

      ! ~room.moderators.indexOf(req.body.user_id.toString())
        && room.moderators.push(req.body.user_id);

      var message = new Message({
        type: 'new moderator',
        user: req.body.user_id,
        author: req.user._id,
        room: room._id
      });
      room.chat.push(message);
      room.notify(sio, 'service-message', {data: {message: message.toObject()}});

      room.save(function (err) {
        err
          ? res.json(500, {error: err.massage})
          : res.json(201, {});
      });
    });
  };
};


exports.removeModerator = function (sio) {
  return function (req, res) {
    Room.findById(req.body.room_id, function (err, room) {
      if (room.admin !== req.user._id.toString()) {
        return res.json(403, {error:'Only admin can add moderators'});
      }
      if (! ~room.moderators.indexOf(req.body.user_id.toString())) {
        return res.json(404, {error: 'Not found'});
      }

      var index = room.moderators.indexOf(req.body.user_id.toString());
      while (!! ~index) {
        !! ~index && room.moderators.splice(index, 1);
        index = room.moderators.indexOf(req.body.user_id.toString());
      }

      var message = new Message({
        type: 'remove moderator',
        user: req.body.user_id,
        author: req.user._id,
        room: room._id
      });
      room.chat.push(message);
      room.notify(sio, 'service-message', {data: {message: message.toObject()}});

      room.save(function (err) {
        err
          ? res.json(500, {error: err.massage})
          : res.json(200, {});
      });
    });
  };
};


exports.kick = function (sio) {
  return function (req, res) {
    Room.findById(req.body.room_id, function (err, room) {
      var userForKick = req.body.user_id;
      if (!userForKick) {
        return res.json(400, {error: 'Who must be kicked?'});
      }
      if (req.user._id.toString() === room.admin || ~room.moderators.indexOf(req.user._id.toString())) {
        var message = new Message({
          type: 'kick',
          author: req.user._id,
          user: userForKick,
          room: room._id,
          ref_message: room.chat.id(req.body.ref_message)
        });

        User.findById(userForKick, function (err, user) {
          user.room = undefined;
          user.save(function (err) {
            if (err) { return res.json(500, {error: err.message}); }
            room.removeUser(userForKick, sio, message.toObject(), function (err) {
              if (err) { res.json(500, {error: err.message}); }
              room.chat.push(message);
              room.save();
              res.json(200, {});
            });
          });
        });
      } else {
        return res.json(403, {error: 'UNACCEPTABLE!!!!11'});
      }
    });
  };
};


exports.ban = function (sio) {
  return function (req, res) {
    Room.findById(req.body.room_id, function (err, room) {
      var userForBan = req.body.user_id;
      if (!userForBan) {
        return res.json(400, {error: 'Who must be banned?'});
      }
      if (req.user._id.toString() !== room.admin || ~room.moderators.indexOf(req.user._id.toString())) {
        return res.json(403, {error: 'UNACCEPTABLE!!!!11'});
      }
      if (req.user._id.toString() === room.admin || ~room.moderators.indexOf(req.user._id.toString())) {
        var message = new Message({
          type: 'ban',
          author: req.user._id,
          user: userForBan,
          room: room._id,
          ref_message: room.chat.id(req.body.ref_message)
        });
        User.findById(userForBan, function (err, user) {
          user.room = undefined;
          user.save(function (err) {
            if (err) { return res.json(500, {error: err.message}); }
            room.removeUser(userForBan, sio, message, function (err) {
              if (err) { return res.json(500, {error: err.message}); }
              room.banned.push(userForBan);
              room.chat.push(message);
              room.save();
              res.json(200, {});
            });
          });
        });
      } else {
        return res.json(403, {error: 'UNACCEPTABLE!!!!11'});
      }
    });
  };
};


exports.silence = function (sio) {
  return function (req, res) {
    var silentlyUser = req.body.user_id;
    var finished = req.body.finished;
    if (!silentlyUser || !finished) {
      return res.json(400, {error: 'Who must be silently?'});
    }
    Room.findById(req.body.room_id, function (err, room) {
      if (req.user._id.toString() === room.admin || ~room.moderators.indexOf(req.user._id.toString())) {
        if (!room.silently) { room.silently = {}; }
        var message = new Message({
          type: 'silence',
          author: req.user._id,
          user: silentlyUser,
          room: room._id,
          text: req.body.text,
          finished: finished,
          ref_message: room.chat.id(req.body.ref_message)
        });
        room.chat.push(message);
        room.notify(sio, 'service-message', {data: {message: message.toObject()}});
        var update = {};
        update['silently.'+silentlyUser] = finished;
        Room.findOneAndUpdate({_id: room._id}, update, {upsert: true}, function (err, room) {
          if (err) { return res.json(500, {error: err.message}); }
          room.save(function (err) {
            if (err) { return res.json(500, {error: err.message}); }
            res.json(200, {});
          });
        });
      } else {
        return res.json(403, {error: 'UNACCEPTABLE!!!!11'});
      }
    });
  };
};


exports.chat = function () {
  return function (req, res) {
    var roomID = req.body.room;
    var limit = req.body.limit || 100;
    var skip = req.body.skip || 0;
    var slice = limit
      ? [skip, limit]
      : skip;

    if (!roomID) { return res.json(400, 'Room is undefined'); }

    var query = Room.find({_id: req.body.room}, 'chat users');
    query.slice('chat', slice);
    query.exec(function (err, rooms) {
      if (!rooms) {return res.json(500, {error: 'WHERE ARE THIS FUCKING ROOMS!??'}); }
      var room = rooms[0];
      if (! ~room.users.indexOf(req.user._id.toString())) {
        return res.json(403, {error: 'You must be inside a chat'});
      }
      for (var i = room.chat.length - 1; i >= 0; i--) {
        room.chat[i] = room.chat[i].toObject();
      }
      err
        ? res.json(500, {error: err.message})
        : res.json(200, {data: {
          chat: room.chat
        }});
    });
  };
};
