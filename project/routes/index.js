'use strict';

/**
 * Module dependencies.
 */
var log                      = require('microlog')(module);
var config                   = require('nconf');
var express                  = require('express');

var extend                   = require('node.extend');
var requireTree              = require('require-tree');
var controllers              = extend(
                                 requireTree('../controllers/'),
                                 require('express-controllers-set')
                               );
var RouteConstr              = require('express-mvc-routes');
var pwd                      = require('process-pwd');
var env                      = process.env.NODE_ENV;

// End of dependencies.


module.exports = function () {

  this.all('*', controllers.user.authenticate);
  this.all('/admin/*', express.basicAuth(
    config.get('CREDENTIALS').split(':')[0],
    config.get('CREDENTIALS').split(':')[1]
  ));

  // # Support
  this.get('/support', controllers.render('support'));

  // # API
  // ## Users
  this.post('/init/reg', controllers.user.reg());
  this.post('/init/auth', controllers.user.auth());
  this.post('/init/exit', controllers.user.exit());
  this.post('/init/edit', controllers.user.edit());
  this.post('/init/getUser', controllers.user.getUser());
  this.post('/init/invite', controllers.user.invite());
  this.post('/upload', controllers.user.submitPhoto());

  // ## Rooms
  this.post('/room/create', controllers.room.create());
  this.post('/room/enter', controllers.room.enter(this.io));
  this.post('/room/remove', controllers.room.del());
  this.post('/room/sendMessage', controllers.room.sendMessage(this.io));
  this.post('/room/get', controllers.room.get());
  this.post('/room/add-moderator', controllers.room.addModerator(this.io));
  this.post('/room/remove-moderator', controllers.room.removeModerator(this.io));
  this.post('/room/kick', controllers.room.kick(this.io));
  this.post('/room/ban', controllers.room.ban(this.io));
  this.post('/room/silence', controllers.room.silence(this.io));
  this.post('/room/chat', controllers.room.chat());
  this.post('/complaints/', controllers.complaints.get());
  this.post('/complaints/new', controllers.complaints.create());
  this.post('/user/sendMessage', controllers.user.sendMessage(this.io, this.apn, this.apnConnection));
  this.post('/user/messages', controllers.user.getMessages());
  this.post('/user/messages/mark-as-read', controllers.user.markMessageAsRead(this.io));
  this.post('/user/messages/remove', controllers.user.removeMessage());
  this.post('/user/init-notifications', controllers.user.initNotifications());
  this.post('/user/updateBalance', controllers.user.updateBalance());
  this.post('/user/dialogs', controllers.user.getDialogs());
  this.post('/user/dialog', controllers.user.getDialog());
  this.post('/user/remove-dialog', controllers.user.removeDialog());
  this.post('/gifts', controllers.gifts.get());
  this.post('/gifts/send', controllers.gifts.send(this.io));
  this.post('/user/free-coins', controllers.user.freeCoins());

  // # Admin
  this.get('/admin', controllers.render('index'));

  // ## Users


  this.get('/admin/users', controllers.admin.users());
  this.get('/admin/users/:userId/delete', controllers.admin.deleteUser());
  this.get('/admin/users/:userId', controllers.admin.user());
  this.post('/admin/users/:userId', controllers.admin.updateUser());
  // ???
  this.get('/admin/api/users', controllers.admin.getUsers());
  this.put('/admin/api/users/:userId', controllers.admin.updateUser());

  // ## Rooms
  this.get('/admin/rooms', controllers.admin.rooms());
  this.post('/admin/rooms/:roomId', controllers.admin.updateRoom());
  this.get('/admin/rooms/:room_id/delete', controllers.admin.removeRoom());

  // ## Gifts
  this.get('/admin/gifts/:giftId/edit', controllers.admin.updateGiftPage());
  this.post('/admin/gifts/:giftId/edit', controllers.admin.updateGift());
  this.get('/admin/gifts', controllers.admin.giftsPage());
  this.post('/admin/gifts/', controllers.admin.createGift());
  this.get('/admin/gifts/:giftId/remove', controllers.admin.removeGift());

  // ## Stats
  this.get('/admin/stats', controllers.admin.stats());

  this.get('/admin/gifts/new', controllers.admin.newGiftForm());
  this.get('/admin/gifts/:giftId', controllers.admin.giftsPage());

  // this.get('/admin/users', controllers.render('users'));
  // this.get('/admin/users/:userId', controllers.render('user'));
  // this.get('/admin/rooms', controllers.render('rooms'));
  // this.get('/admin/rooms/:roomId', controllers.render('room'));
  // this.get('/admin/complaints/', controllers.render('complaints'));
  // this.get('/admin/complaints/:complaintId', controllers.render('complaint'));






  // ## Sockets
  this.io.sockets.on('connection', function (socket) {
    // send the clients id to the client itself.
    socket.on('init', function (data) {
      controllers.user.appendSession(socket, data);
    });

    socket.on('disconnect', function () {
      // remove session-to-socket
      controllers.user.removeFromSession(socket);
      log.info('remove socket from session');
    });
  });





};
