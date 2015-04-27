'use strict';

/**
 * Module dependencies.
 */
var log                 = require('microlog')(module);
var config              = require('nconf');

var crypto              = require('crypto');
var Countdown           = require('next-done');
var SMSSender           = require('smsc');
var sender              = new SMSSender(
                            config.get('SMSSENDER_CREDENTIALS').split(':')[0],
                            config.get('SMSSENDER_CREDENTIALS').split(':')[1]
                          );

var User                = require('mongoose').model('User');
var Message             = require('mongoose').model('Message');
var Session             = require('mongoose').model('Session');
var Invite              = require('mongoose').model('Invite');

var env                 = process.env.NODE_ENV;

// End of dependencies.



var _createNewSession = function (user, cb) {
  var session = new Session({user: user._id});
  session.save(function (err, session) {
    cb && cb(err, session);
  });
};



var _destroySession = function (sessionKey, cb) {
  if (!sessionKey) { return cb(new Error('No session key.')); }
  Session.findById(sessionKey, function (err, session) {
    session.remove(function (err) {
      cb && cb(err);
    });
  });
};



exports.reg = function () {
  return function (req, res) {
    User.create(req.body.phone, function (err, user, isNewUser) {
      err
        ? res.json(500, {error: err.message})
        : isNewUser
          ? Invite.findOne({phone: user.phone}, function (err, invite) {
              res.json(201, {
                user: 'test' === env ? user : user.toObject()
              });
              invite
                && User.findById(invite.author, function (err, user) {
                  if (user) {
                    user.balance = user.balance + 1;
                    user.save();
                  }
                });
            })
          : res.json(200, {
              user: 'test' === env ? user : user.toObject()
            });
    });
  };
};



exports.auth = function () {
  return function (req, res, next) {
    var phone = req.body.phone;
    var password = req.body.key;
    User
      .findOne({ phone: phone})
      .populate('gifts')
      .exec(function (err, user) {
        if (err) {
          !! ~err.message.indexOf('Cast to number failed')
            ? res.json(400, {error: 'Incorrect phone.'})
            : res.json(500, {error: err.message});
        }
        user
          ? password === user.password
            ? _createNewSession(user, function (err, session) {
                err
                  ? res.json(500, {error: err.message})
                  : res.json(200, {
                      data: {
                        user: user.toObject(),
                        session_key: session._id
                      }
                    });
              })
            : res.json(401, { error: 'Incorrect password.' })
          : res.json(401, { error: 'Incorrect phone.' });
      });
  };
};



exports.test = function () {
  return function (req, res, next) {
    res.json(200, {
      data: {
        user: req.user.toObject(),
        session_key: req.sessionKey
      }
    });
  };
};



// Возвращает данные пользователя по ID
exports.getUser = function () {
  return function (req, res, next) {
    User
      .findById(req.body.user_id)
      .populate('gifts')
      .exec(function (err, user) {
        if (err) { return res.json(500, {error: err.message}); }
        if (!user) { return res.json(404, {error: 'User not found'}); }
        // remove password
        user = user.toObject();
        // convert date to timestamp
        user.gifts.map(function(gift) {
          gift.create_at = +new Date(gift.create_at);
        });
        return res.json(200, { data: {user: user} });
      });
  };
};



exports.authenticate = function (req, res, next) {
  if (!req.body.session_key) { return next(); }
  req.sessionKey = req.body.session_key;
  Session.findById(req.sessionKey, function (err, session) {
    err
      ? res.json(500, {error: err.message})
      : session
        ? User.findById(session.user, function (err, user) {
            req.user = user;
            req.user.save();
            next();
          })
        : res.json(440, {error: 'Session expired'});
  });
};



exports.exit = function () {
  return function (req, res, next) {
    _destroySession(req.sessionKey, function (err) {
      if (err) { res.json(500, {error: err.message}); }
      res.json(200);
    });
  };
};



exports.edit = function () {
  return function (req, res) {
    delete req.body.balance;
    User.findOneAndUpdate({_id: req.user._id}, req.body.user, function (err, user) {
      if (err) { return res.json(500, {error: err.message}); }
      user.populate('gifts', function (err, user) {
        res.json(200, {
          data: {
            user: user.toObject()
          }
        });
      });
    });
  };
};



exports.appendSession = function (socket, data) {
  data.session_key
    ? Session.update({_id: data.session_key}, {$push: {sockets: socket.id}},
        function (err) {
          err
            ? socket.emit('init', {
                error_code: 500,
                error: err.message
              })
            : socket.emit('ready');
      })
    : socket.emit('init', {
        error_code: 401,
        error: 'undefined session_key'
      });
};


exports.removeFromSession = function (socket) {
  Session.update({sockets: socket.id}, {$pull: {sockets: socket.id}}, function (err) {
    err
      ? log.error('disconnected socket wasn\'t removed from session', err.message)
      : log.info('disconnected socket was removed from session');
  });
};


exports.submitPhoto = function () {
  return function (req, res) {
    'object' === typeof req.files.photo
      ? res.json(201, {
          url: req.files.photo.path.replace('public', '')
        })
      : res.send(400);
  };
};


exports.sendMessage = function (sio, apn, apnConnection) {
  return function (req, res) {
    req.body.message.author = req.user._id;
    req.body.message.unread = true;
    if (!req.user) { res.json(403, {error: 'unauthorized'}); }
    if (!req.body.message.text) { res.json(400, {error: 'empty text'}); }
    if (!req.body.message.user) { res.json(400, {error: 'empty user'}); }
    var message = new Message(req.body.message);
    message.save(function (err, message) {
      err
        ? res.json(500, {error: err.message})
        : message.notify(sio, 'direct-message', apn, apnConnection)
        , res.json(200, {
            data: {
              message: message.toObject()
            }
          });
    });
  };
};


exports.getMessages = function () {
  return function (req, res) {
    if (req.body.user && req.body.author) { res.json(400, {error: 'You can define only user or only author'}); }

    var query;
    var user = req.user._id;
    var author = req.body.author;
    var limit = req.body.limit || 100;
    var skip = req.body.skip || 0;
    var countOnly = req.body.countOnly;
    var distinct = req.body.distinct;
    // var slice = limit
    //   ? [skip, limit]
    //   : skip;

    if (distinct) {
      return Message
        .find({user: user})
        .distinct('author')
        .exec(function (err, users) {
          err
            ? res.json(500, {error: err.message})
            : res.json(200, {
                data: {
                  users: users
                }
              });
        });
    }

    if (!req.user) { return res.json(403, {error: 'unauthorized'}); }
    if (req.body.user) {
      author = user;
      user = req.body.user;
    }

    query = Message.find({user: user}, {});
    !countOnly
      && query.sort({create_at: -1});
    author
      && query.where({author: author});
    skip
      && query.skip(skip);
    limit
      && query.limit(limit);
    countOnly
      && query.count();
    query.exec(function (err, messages) {
        res.json(200, {
          data: {
            messages: messages
          }
        });
      });
  };
};


exports.markMessageAsRead = function (sio) {
  return function (req, res) {
    if (!req.body.message) { return res.json(400, {error: 'message id is undefined'}); }
    Message.findOneAndUpdate({_id: req.body.message, user: req.user._id}, {unread: false}, function (err, message) {
      err
        ? res.json(500, {error: err.message})
        : message
          ? message.notify(sio, 'read-message')
            && res.json(200, {
                  data: {
                    message: message.toObject()
                  }
                })
          : res.json(404, {error: 'Message {_id:_id, user: you} not found'});
    });
  };
};


exports.removeMessage = function () {
  return function (req, res) {
    Message.findOneAndRemove({
      _id: req.body.message,
      author: req.user._id
    }, function (err, message) {
      err
        ? res.json(500, {error: err.message})
        : message
          ? res.json(200, {})
          : res.json(404, {error: 'message not found'});
    });
  };
};


exports.initNotifications = function () {
  return function (req, res) {
    if (!req.body.ios_token || !req.body.session_key) { return res.json(400, {error: 'Undefined session or tocken'}); }
    Session.update({
        _id: req.body.session_key,
        ios_tokens: {
          $nin: [req.body.ios_token]
        }
      }, {
        $push: {
          ios_tokens: req.body.ios_token
        }
      }, function (err, isCreated) {
        err
          ? res.json(500, {error: err.message})
          : isCreated
            ? res.json(201, {})
            : res.json(200, {});
    });
  };
};


exports.updateBalance = function () {
  return function (req, res) {
    var shasum = crypto.createHash('md5');
    var balance = req.body.balance;
    var secret = shasum.update(config.get('SECRET') + balance);
    secret.digest('hex') === req.body.secret
      ? User.findOneAndUpdate({_id: req.user._id}, {balance: balance}, function (err, user) {
        err
          ? res.json(500, {error: err.message})
          : user.populate('gifts', function (err, user) {
              err
                ? res.json(500, {error: err.message})
                : res.json(200, {
                    data: {
                      user: user.toObject()
                    }
                  });
            });
        })
      : res.json(403, {error: 'I keep secrets'});
  };
};


exports.getDialogs = function () {
  return function (req, res) {
    var dialogs = [];
    _getUsersInDialogs(req.user._id, function (err, users) {
      if (!users || !users.length) {
        return res.json(200, {
          data: {
            dialogs: []
          }
        });
      }
      users.forEach(function (user, key, all) {
        _getCountAndLastMessageInDialog(req.user._id, user, function (err, lastMessage, unread) {
          dialogs.push({user: user, last_message: lastMessage.toObject(), unread:unread});
          if (key === all.length - 1) {
            res.json(200, {
              data: {
                dialogs: dialogs
              }
            });
          }
        });
      });
    });
  };
};


exports.getDialog = function () {
  return function (req, res) {
    var limit = req.body.limit || 100;
    var skip = req.body.skip || 0;
    req.body.user
      ? Message
          .find({})
          .or([
            {author: req.user._id, user: req.body.user},
            {user: req.user._id, author: req.body.user}
          ])
          .sort('-create_at')
          .skip(skip)
          .limit(limit)
          .exec(function (err, messages) {
            if (messages) {
              for (var i in messages) {
                messages[i] = messages[i].toObject();
              }
            }
            err
              ? res.json(500, {error: err.message})
              : res.json(200, {
                data: {
                  dialog: messages
                }
              });
          })
      : res.json(400, {error: 'User is undefined'});
  };
};


exports.removeDialog = function () {
  return function (req, res) {
    req.body.user
      ? Message
          .find({})
          .or([
            {author: req.user._id, user: req.body.user},
            {user: req.user._id, author: req.body.user}
          ])
          .remove()
          .exec(function (err) {
            err
              ? res.json(500, {error: err.message})
              : res.json(200, {});
          })
      : res.json(400, {error: 'User is undefined'});
  };
};


var _getUsersInDialogs = function (user, cb) {

  var authors, users;

  var next = new Countdown(2, function () {
    users = users
      .concat(authors)
      .filter(function (value, index, self) {
        return self.indexOf(value) === index;
      });
    return cb(null, users);
  });

  Message
    .distinct('author', {user: user}, function (err, _authors) {
      authors = _authors;
      next();
    });

  Message
    .distinct('user', {author: user}, function (err, _users) {
      users = _users;
      next();
    });

};


var _getCountAndLastMessageInDialog = function (requser, user, cb) {

  var lastMessage, unread;

  var next = new Countdown(2, function () {
    return cb(null, lastMessage, unread);
  });

  Message
    .findOne(null)
    .or([{user: requser, author: user},{user: user, author: requser}])
    .sort('-create_at')
    .exec(function (err, _lastMessage) {
      lastMessage = _lastMessage;
      next();
    });

  Message
    .find({user: requser, author: user, unread: true})
    .count()
    .exec(function (err, _unread) {
      unread = _unread;
      next();
    });

};


exports.freeCoins = function () {
  var coinsForPost = 3;
  return function (req, res) {
    var oldDate = req.user.freeCoins[req.body.type];
    if (oldDate) {
      oldDate = +new Date(oldDate);
      var newDate = +new Date();
      var delta = newDate - oldDate;
      if (delta < 86400000) {
        return res.json(400, {error: 'Сome back tomorrow'});
      }
    }
    req.user.freeCoins[req.body.type] = +new Date();
    req.user.balance += 3;
    req.user.save(function (err) {
        err
          ? res.json(500, {error: err.message})
          : res.json(200, {});
    });
  };
};


exports.invite = function () {
  return function (req, res) {
    if ('object' !== typeof req.body.phones) { return res.json(400, {}); }
    var next = new Countdown(req.body.phones.length, function (err) {
      err
        ? res.json(500, {error: err.message})
        : res.json(200, {});
    });
    for (var i = req.body.phones.length - 1; i >= 0; i--) {
      createInvite(req.body.phones[i], req.user, next);
    }
  };
};


var createInvite = function (phone, author, next) {
  var invite = new Invite({
    author: author._id,
    phone: phone
  });
  Invite
    .findOne({phone: invite.phone})
    .exec(function (err, _invite) {
      if (_invite && _invite.closed) { return next(); }
        invite = _invite || invite;
        'test' === env
          ? invite.save(next)
          : sender.sms(invite.phone, 'Ваш друг приглашает вас в Просто Чат!', function (err, message) {
              invite.save(next);
            });
    });
};
