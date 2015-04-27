/* globals describe, it */

'use strict';

var config              = require('nconf');

var request             = require('supertest');
var app                 = require('../app');
var assert              = require('assert');
var mongoose            = require('mongoose');
var io                  = require('socket.io-client');
var oio                 = require('othersocket.io-client');
var Countdown           = require('next-done');
var assert              = require('better-assert');
var crypto              = require('crypto');

// End of dependencies.


var testUser = {
  phone: '79124901694' // Модель при валидации сконвертирует в число
};
var otherTestUser = {
  phone: '+79223438450'
};
var thirdTestUser = {
  phone: '79089099010'
};
var randomObjectID = new mongoose.Types.ObjectId()
  , session_key = ''
  , otherSession_key = ''
  , thirdSession_key = ''
  , room
  , privateRoom
  , socket
  , otherSocket
  , message_to_complaint
  , message_to_read
  , messageToServiceMessagesTest
  , limitMessage
  , giftToGive
;



describe('Общий тест', function () {

  it('Загрузка ExpressJS', function (done) {
    app.boot(function (err) {
      done();
    });
  });


  it('Порт по-умолчанию — 3000', function (done) {
    assert(3000 === config.get('PORT'));
    done();
  });


  it('Удаление тестовых данных', function (done) {
    var Collections = [
      mongoose.model('User'),
      mongoose.model('Room'),
      mongoose.model('Session'),
      mongoose.model('Gift'),
      mongoose.model('Message'),
      mongoose.model('SendedGift'),
      mongoose.model('Invite')
    ];
    var next = new Countdown(Collections.length, done);
    Collections.forEach(function (Collection) {
      Collection.remove(function (err) {
        next(err);
      });
    });
  });

  it('Создает подарок', function(done) {
    var Gift = mongoose.model('Gift');
    var gift = new Gift({
      name: 'Fixture Gift',
      price: 150
    });
    gift.save(done);
  });

  it('Регистрация первого пользователя', function (done) {
    request(app)
      .post('/init/reg')
      .send(testUser)
      .expect(201)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        // assert('string' === typeof res.body.user.location);
        assert(parseInt(testUser.phone) === res.body.user.phone);
        testUser = res.body.user;
        done(err);
      });
  });


  it('Авторизация первого пользователя', function (done) {
    request(app)
      .post('/init/auth')
      .send({
        phone: testUser.phone,
        key: testUser.password
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // Должны получить session key
        assert('undefined' === typeof res.body.error);
        assert('string' === typeof res.body.data.session_key);
        assert('object' === typeof res.body.data.user);
        session_key = res.body.data.session_key;
        done(err);
      });
  });


  it('Инвайт для второго пользователя', function (done) {
    request(app)
      .post('/init/invite')
      .send({
        session_key: session_key,
        phones: [otherTestUser.phone]
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        done();
      });
  });


  it('Пользователю ничего не начисляется за инвайты', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(0 === res.body.data.user.balance);
        done(err);
      });
  });

  it('Регистрация второго пользователя ', function (done) {
    request(app)
      .post('/init/reg')
      .send(otherTestUser)
      .expect(201)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        // assert('string' === typeof res.body.user.location);
        assert(parseInt(otherTestUser.phone) === res.body.user.phone);
        otherTestUser = res.body.user;
        done(err);
      });
  });


  it('Регистрация третьего пользователя', function (done) {
    request(app)
      .post('/init/reg')
      .send(thirdTestUser)
      .expect(201)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(parseInt(thirdTestUser.phone) === res.body.user.phone);
        thirdTestUser = res.body.user;
        done(err);
      });
  });


  it('После регистрации приглашенных пользователей пользователю начисляются баллы', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(1 === res.body.data.user.balance);
        done(err);
      });
  });


  it('Регистрация уже зарегистрированного номера телефона', function (done) {
    request(app)
      .post('/init/reg')
      .send(otherTestUser)
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(parseInt(otherTestUser.phone) === res.body.user.phone);
        otherTestUser = res.body.user;
        done(err);
      });
  });


  it('После повторной регистрации приглашенного пользователя не дается денег пригласившему', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(1 === res.body.data.user.balance);
        done(err);
      });
  });


  it('Получение отсутствующего списка диалогов первого пользователя', function (done) {
    request(app)
      .post('/user/dialogs')
      .send({
        session_key: session_key
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.dialogs));
        done(err);
      });
  });


  it('Авторизация второго пользователя', function (done) {
    request(app)
      .post('/init/auth')
      .send({
        phone: otherTestUser.phone,
        key: otherTestUser.password
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // Должны получить session key
        assert('undefined' === typeof res.body.error);
        assert('string' === typeof res.body.data.session_key);
        assert('object' === typeof res.body.data.user);
        otherSession_key = res.body.data.session_key;
        done(err);
      });
  });


  it('Авторизация третьего пользователя', function (done) {
    request(app)
      .post('/init/auth')
      .send({
        phone: thirdTestUser.phone,
        key: thirdTestUser.password
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // Должны получить session key
        assert('undefined' === typeof res.body.error);
        assert('string' === typeof res.body.data.session_key);
        assert('object' === typeof res.body.data.user);
        thirdSession_key = res.body.data.session_key;
        done(err);
      });
  });


  it('Авторизация с неверным форматом телефона', function (done) {
    request(app)
      .post('/init/auth')
      .send({
        phone: 'wrong phone format',
        key: 'And some wrong password'
      })
      // Неавторизован
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // Должны получить описание ошибки
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Авторизация с неверными учетными данными', function (done) {
    request(app)
      .post('/init/auth')
      .send({
        phone: testUser.phone,
        key: 'And some wrong password'
      })
      // Неавторизован
      .expect(401)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // Должны получить описание ошибки
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Получение информации о пользователе по ID', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(testUser.phone === res.body.data.user.phone);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Получение информации о другом пользователе', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: otherTestUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(otherTestUser.phone === res.body.data.user.phone);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Получение информации о пользователе по несуществующему ID', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: randomObjectID
      })
      .expect(404)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Обновление данных пользователя', function (done) {
    request(app)
      .post('/init/edit')
      .send({
        session_key: session_key,
        user: {
          nickname: 'shuvalov-anton', // Указываем существующие в модели поля, которые будем обновлять.
          location: 'Perm', // несуществующие отбрасываются на валидации
          dob: +new Date('1990-02-08'),
          gender: 0
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('shuvalov-anton' === res.body.data.user.nickname);
        assert('Perm' === res.body.data.user.location);
        assert(+new Date('1990-02-08') === res.body.data.user.dob);
        assert('number' === typeof res.body.data.user.create_at);
        assert(0 === res.body.data.user.gender);
        done(err);
      });
  });

  it('Обновление данных пользователя', function (done) {
    request(app)
      .post('/init/edit')
      .send({
        session_key: otherSession_key,
        user: {
          nickname: 'a8h333', // Указываем существующие в модели поля, которые будем обновлять.
          location: 'Moscow', // несуществующие отбрасываются на валидации
          dob: +new Date('1990-02-08'),
          gender: 0
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('a8h333' === res.body.data.user.nickname);
        assert('Moscow' === res.body.data.user.location);
        assert(+new Date('1990-02-08') === res.body.data.user.dob);
        assert('number' === typeof res.body.data.user.create_at);
        assert(0 === res.body.data.user.gender);
        done(err);
      });
  });

  it('Обновление данных пользователя', function (done) {
    request(app)
      .post('/init/edit')
      .send({
        session_key: thirdSession_key,
        user: {
          nickname: 'R31', // Указываем существующие в модели поля, которые будем обновлять.
          location: 'Moscow', // несуществующие отбрасываются на валидации
          dob: +new Date('1990-02-08'),
          gender: 0
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('R31' === res.body.data.user.nickname);
        assert('Moscow' === res.body.data.user.location);
        assert(+new Date('1990-02-08') === res.body.data.user.dob);
        assert('number' === typeof res.body.data.user.create_at);
        assert(0 === res.body.data.user.gender);
        done(err);
      });
  });

  it('Установка баланса пользователя на 100 единиц', function (done) {
    var shasum = crypto.createHash('md5');
    var balance = 100;
    var secret = shasum.update(config.get('SECRET') + balance);
    request(app)
      .post('/user/updateBalance')
      .send({
        session_key: session_key,
        balance: balance,
        secret: secret.digest('hex')
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(testUser.phone === res.body.data.user.phone);
        assert(balance === res.body.data.user.balance);
        done(err);
      });
  });

  it('Установка баланса пользователя на 200 единиц', function (done) {
    var shasum = crypto.createHash('md5');
    var balance = 200;
    var secret = shasum.update(config.get('SECRET') + balance);
    request(app)
      .post('/user/updateBalance')
      .send({
        session_key: session_key,
        balance: balance,
        secret: secret.digest('hex')
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(testUser.phone === res.body.data.user.phone);
        assert(balance === res.body.data.user.balance);
        done(err);
      });
  });

  it('Повторное выполнение запроса на установку баланса не увеличивает его', function (done) {
    var shasum = crypto.createHash('md5');
    var balance = 200;
    var secret = shasum.update(config.get('SECRET') + balance);
    request(app)
      .post('/user/updateBalance')
      .send({
        session_key: session_key,
        balance: balance,
        secret: secret.digest('hex')
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(testUser.phone === res.body.data.user.phone);
        assert(balance === res.body.data.user.balance);
        done(err);
      });
  });


  it('Загрузка аватара пользователя', function (done) {
    request(app)
      .post('/upload')
      .attach('photo', 'test/fixtures/avatar.png')
      .expect(201)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('string' === typeof res.body.url);
        testUser.photo = res.body.url;
        done(err);
      });
  });


  it('Запись загруженного изображения в профиль пользователя', function (done) {
    assert('undefined' !== typeof testUser.photo);
    request(app)
      .post('/init/edit')
      .send({
        session_key: session_key,
        user: {
          photo: testUser.photo
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('shuvalov-anton' === res.body.data.user.nickname);
        assert('undefined' !== typeof res.body.data.user.photo);
        assert(testUser.photo === res.body.data.user.photo);
        done(err);
      });
  });


  it('Получение аватара пользователя', function (done) {
    request(app)
      .get(testUser.photo)
      // Если картинки нет — будет 404. Дальше не знаю, как лучше проверить, по этому так оставлю.
      .expect(200)
      .expect('Content-Type', /image/)
      .end(function (err, res) {
        done(err);
      });
  });


  it('Создание комнаты', function (done) {
    request(app)
      .post('/room/create')
      .send({
        session_key: session_key,
        room: {
          name: 'SUP',
          max_users: 2
        }
      })
      .expect(201)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('undefined' === typeof res.body.data.room.password);
        assert('object' === typeof res.body.data.room);
        assert('SUP' === res.body.data.room.name);
        assert(testUser._id === res.body.data.room.admin);
        assert(0 === res.body.data.room.users.length); // Вход — отдельная процедура
        assert(false === res.body.data.room.is_private);
        assert('number' === typeof res.body.data.room.create_at);
        room = res.body.data.room;
        done(err);
      });
  });


  it('Создание приватной комнаты', function (done) {
      request(app)
        .post('/room/create')
        .send({
          session_key: session_key,
          room: {
            name: '_SUP',
            password: 'Wassup!?'
          }
        })
        .expect(201)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          assert('undefined' === typeof res.body.error);
          assert('undefined' === typeof res.body.data.room.password);
          assert('object' === typeof res.body.data.room);
          assert('_SUP' === res.body.data.room.name);
          assert(testUser._id === res.body.data.room.admin);
          assert(0 === res.body.data.room.users.length); // Вход — отдельная процедура
          assert(true === res.body.data.room.is_private);
          assert('number' === typeof res.body.data.room.create_at);
          privateRoom = res.body.data.room;
          done(err);
        });
  });


  it('Вход в комнату', function (done) {
    request(app)
      .post('/room/enter')
      .send({
        session_key: otherSession_key,
        room: {
          id: room._id
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('undefined' === typeof res.body.data.room.password);
        assert('object' === typeof res.body.data.room);
        assert('SUP' === res.body.data.room.name);
        assert(testUser._id === res.body.data.room.admin);
        assert(false === res.body.data.room.is_private);
        assert('undefined' === typeof res.body.data.room.chat);
        assert(1 === res.body.data.room.users.length);
        done(err);
      });
  });


  it('Посещенная комната добавилась в историю посещений пользователя', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: otherSession_key,
        user_id: otherTestUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('undefined' === typeof res.body.data.user.password);
        assert('object' === typeof res.body.data.user.visitedRooms);
        assert(room._id === res.body.data.user.visitedRooms[0]);
        done(err);
      });
  });


  it('Вход в приватную комнату с неверным паролем', function (done) {
    request(app)
      .post('/room/enter')
      .send({
        session_key: session_key,
        room: {
          id: privateRoom._id,
          password: 'wrong password'
        }
      })
      // Все ок
      .expect(401)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        assert('undefined' === typeof res.body.room);
        done(err);
      });
  });


  it('Вход в приватную комнату', function (done) {
    request(app)
      .post('/room/enter')
      .send({
        session_key: session_key,
        room: {
          id: privateRoom._id,
          password: 'Wassup!?'
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('undefined' === typeof res.body.data.room.password);
        assert('object' === typeof res.body.data.room);
        assert('_SUP' === res.body.data.room.name);
        assert(testUser._id === res.body.data.room.admin);
        assert(true === res.body.data.room.is_private);
        assert(1 === res.body.data.room.users.length);
        done(err);
      });
  });


  it('Посещенная приватная комната добавилась в историю посещений пользователя', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('shuvalov-anton' === res.body.data.user.nickname);
        assert('undefined' === typeof res.body.data.user.password);
        assert('object' === typeof res.body.data.user.visitedRooms);
        assert(privateRoom._id === res.body.data.user.visitedRooms[0]);
        done(err);
      });
  });


  it('Подключение к сокету', function (done) {
    var socketURL = 'http://localhost:' + config.get('SOCKET_PORT');
    socket = io.connect(socketURL);
    socket.on('connect', function () {
      done();
    });
  });


  it('Инициализация сокета — связывание сессии и сокета', function (done) {
    socket.on('ready', function (data) {
      done();
    });
    socket.emit('init', {session_key: session_key});
  });


  it('Отправка сообщения и получение в фиде через сокет', function (done) {
    var next = new Countdown(2, done);
    var finished = false;
    // Subscribe to message
    socket.on('message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('SUP for all you' === res.data.message.text);
        assert('number' === typeof res.data.message.create_at);
        assert(privateRoom._id === res.data.message.room);
        assert(testUser._id === res.data.message.author);
        next();
      }
    });

    request(app)
      .post('/room/sendMessage')
      .send({
        session_key: session_key,
        message: {
          room_id: privateRoom._id,
          text: 'SUP for all you'
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.message);
        assert('undefined' === typeof res.body.data.error);
        assert('SUP for all you' === res.body.data.message.text);
        assert('number' === typeof res.body.data.message.create_at);
        assert(privateRoom._id === res.body.data.message.room);
        assert(testUser._id === res.body.data.message.author);
        next(err);
      });
  });


  it('У пользователя есть поле room равное активной (private) комнате', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(testUser.phone === res.body.data.user.phone);
        assert('string' === typeof res.body.data.user.room);
        assert(privateRoom._id === res.body.data.user.room);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('У пользователя есть поле rooms со списком созданных комнат', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(testUser.phone === res.body.data.user.phone);
        assert('string' === typeof res.body.data.user.room);
        assert(privateRoom._id === res.body.data.user.room);
        assert(Array.isArray(res.body.data.user.rooms));
        assert(2 === res.body.data.user.rooms.length);
        assert(room._id === res.body.data.user.rooms[0]);
        assert(privateRoom._id === res.body.data.user.rooms[1]);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Подключение второго пользователя к сокету', function (done) {
    var socketURL = 'http://localhost:' + config.get('SOCKET_PORT');
    otherSocket = oio.connect(socketURL);
    otherSocket.on('connect', function () {
      done();
    });
  });


  it('Инициализация сокета у второго пользователя — связывание сессии и сокета', function (done) {
    otherSocket.on('ready', function (data) {
      done();
    });
    otherSocket.emit('init', {session_key: otherSession_key});
  });


  it('Выход из одной комнаты и вход в другую. Проверка системного сообщения (вход пользователя)', function (done) {

    var next = new Countdown(2, done);
    var finished = false;
    // Subscribe to message
    otherSocket.on('service-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('new roommate' === res.data.message.type);
        assert(testUser._id === res.data.message.user); // Популяризовать?
        assert(room._id === res.data.message.room);
        assert('number' === typeof res.data.message.create_at);
        next();
      }
    });

    request(app)
      .post('/room/enter')
      .send({
        session_key: session_key,
        room: {
          id: room._id
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('undefined' === typeof res.body.data.room.password);
        assert('object' === typeof res.body.data.room);
        assert('SUP' === res.body.data.room.name);
        assert(testUser._id === res.body.data.room.admin);
        assert(false === res.body.data.room.is_private);
        assert(2 === res.body.data.room.users.length);
        next(err);
      });
  });


  it('Выход из одной комнаты и вход в другую. Проверка системного сообщения (выход пользователя)', function (done) {

    var next = new Countdown(2, done);
    var finished = false;
    // Subscribe to message
    otherSocket.on('service-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('roommate quits' === res.data.message.type);
        assert(testUser._id === res.data.message.user); // Популяризовать?
        assert(room._id === res.data.message.room);
        assert('number' === typeof res.data.message.create_at);
        next();
      }
    });

    request(app)
      .post('/room/enter')
      .send({
        session_key: session_key,
        room: {
          id: privateRoom._id,
          password: 'Wassup!?'
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('undefined' === typeof res.body.data.room.password);
        next(err);
      });
  });


  it('Выход из одной комнаты и вход в другую. Проверка системного сообщения (вход пользователя)', function (done) {

    var next = new Countdown(2, done);
    var finished = false;
    // Subscribe to message
    otherSocket.on('service-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('new roommate' === res.data.message.type);
        assert(testUser._id === res.data.message.user); // Популяризовать?
        assert(room._id === res.data.message.room);
        next();
      }
    });

    request(app)
      .post('/room/enter')
      .send({
        session_key: session_key,
        room: {
          id: room._id
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('undefined' === typeof res.body.data.room.password);
        assert('object' === typeof res.body.data.room);
        assert('SUP' === res.body.data.room.name);
        assert(testUser._id === res.body.data.room.admin);
        assert(false === res.body.data.room.is_private);
        assert(2 === res.body.data.room.users.length);
        next(err);
      });
  });


  it('Посещенная комната добавилась в историю посещений пользователя (теперь 2 комнаты)', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('shuvalov-anton' === res.body.data.user.nickname);
        assert('undefined' === typeof res.body.data.user.password);
        assert('object' === typeof res.body.data.user.visitedRooms);
        assert(privateRoom._id === res.body.data.user.visitedRooms[0]);
        assert(room._id === res.body.data.user.visitedRooms[1]);
        done(err);
      });
  });


  it('Отправка сообщения вторым пользователем и получение в фиде обоих пользователей через сокет', function (done) {
    var finished;
    var finished2;
    var next = new Countdown(3, done);
    socket.on('message', function (res) {
      if (finished) { return; }
      finished = true;
      assert('object' === typeof res.data);
      assert('undefined' === typeof res.data.error);
      assert('Hello gays!' === res.data.message.text);
      assert(otherTestUser._id === res.data.message.author);
      assert(room._id === res.data.message.room);
      assert('number' === typeof res.data.message.create_at);
      next();
    });
    otherSocket.on('message', function (res) {
      if (finished2) { return; }
      finished2 = true;
      assert('object' === typeof res.data);
      assert('undefined' === typeof res.data.error);
      assert('Hello gays!' === res.data.message.text);
      assert(otherTestUser._id === res.data.message.author);
      assert(room._id === res.data.message.room);
      assert('number' === typeof res.data.message.create_at);
      next();
    });
    request(app)
      .post('/room/sendMessage')
      .send({
        session_key: otherSession_key,
        message: {
          room_id: room._id,
          text: 'Hello gays!'
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.message);
        assert('undefined' === typeof res.body.data.error);
        assert('Hello gays!' === res.body.data.message.text);
        assert('number' === typeof res.body.data.message.create_at);
        assert(room._id === res.body.data.message.room);
        assert(otherTestUser._id === res.body.data.message.author);
        messageToServiceMessagesTest = res.body.data.message;
        next(err);
      });
  });


  it('У пользователя есть поле room равное активной (public) комнате', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(testUser.phone === res.body.data.user.phone);
        assert('string' === typeof res.body.data.user.room);
        assert(room._id === res.body.data.user.room);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Кик пользователя доступен только модератору', function (done) {
    request(app)
      .post('/room/kick')
      .send({
        session_key: otherSession_key,
        room_id: room._id,
        user_id: otherTestUser._id
      })
      // Все ок
      .expect(403)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Кик пользователя', function (done) {
    var next = new Countdown(3, done);
    var finished = false;
    var finished2 = false;

    // Subscribe to message
    otherSocket.on('service-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('kick' === res.data.message.type);
        assert(otherTestUser._id === res.data.message.user);
        assert(testUser._id === res.data.message.author);
        assert(room._id === res.data.message.room);
        assert('number' === typeof res.data.message.create_at);

        next();
      }
    });

    socket.on('service-message', function (res) {
      if (!finished2) {
        finished2 = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('kick' === res.data.message.type);
        assert(otherTestUser._id === res.data.message.user);
        assert(testUser._id === res.data.message.author);
        assert(room._id === res.data.message.room);
        assert('number' === typeof res.data.message.create_at);
        assert(messageToServiceMessagesTest._id === res.data.message.ref_message._id);
        assert('Hello gays!' === res.data.message.ref_message.text);
        next();
      }
    });
    request(app)
      .post('/room/kick')
      .send({
        session_key: session_key,
        room_id: room._id,
        user_id: otherTestUser._id,
        ref_message: messageToServiceMessagesTest._id
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        next(err);
      });
  });


  it('После кика активная комната пользователя сброшена в undefined', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: otherTestUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(otherTestUser.phone === res.body.data.user.phone);
        assert('undefined' === typeof res.body.data.user.room);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Нет кикнутого пользователя', function (done) {
      request(app)
        .post('/room/get')
        .send({
          session_key: session_key,
          room_id: room._id
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {

          // Запрос
          assert('undefined' === typeof res.body.error);
          assert(Array.isArray(res.body.data.rooms));
          assert('number' === typeof res.body.data.count); // Общее к-во комнат
          assert(!~res.body.data.rooms[0].users.indexOf(otherTestUser._id.toString())); // Нет кикнутого пользователя
          assert(1 === res.body.data.rooms[0].users.length); // Общее к-во комнат

          // Комната
          assert('undefined' === typeof res.body.data.rooms[0].password);
          assert(room._id === res.body.data.rooms[0]._id);
          done(err);
        });
  });


  it('После кика пользователь входит в чат без ограничения', function (done) {

    var next = new Countdown(2, done);
    var finished = false;
    // Subscribe to message
    socket.on('service-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('new roommate' === res.data.message.type);
        assert(otherTestUser._id === res.data.message.user); // Популяризовать?
        assert(room._id === res.data.message.room);
        next();
      }
    });

    request(app)
      .post('/room/enter')
      .send({
        session_key: otherSession_key,
        room: {
          id: room._id
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('undefined' === typeof res.body.data.room.password);
        assert('object' === typeof res.body.data.room);
        assert('SUP' === res.body.data.room.name);
        assert(testUser._id === res.body.data.room.admin);
        assert(false === res.body.data.room.is_private);
        assert(2 === res.body.data.room.users.length);
        next(err);
      });
  });


  it('Вход в переполненную комнату', function (done) {
    request(app)
      .post('/room/enter')
      .send({
        session_key: thirdSession_key,
        room: {
          id: room._id
        }
      })
      // Все ок
      .expect(423)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Назначение модератора не администратором', function (done) {
    request(app)
      .post('/room/add-moderator')
      .send({
        session_key: otherSession_key,
        room_id: room._id,
        user_id: randomObjectID
      })
      .expect(403)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Назначение модератора администратором', function (done) {

    var next = new Countdown(2, done);
    var finished = false;
    // Subscribe to message
    socket.on('service-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('new moderator' === res.data.message.type);
        assert(otherTestUser._id === res.data.message.user);
        assert(testUser._id === res.data.message.author);
        assert(room._id === res.data.message.room);
        assert('number' === typeof res.data.message.create_at);
        next();
      }
    });

    request(app)
      .post('/room/add-moderator')
      .send({
        session_key: session_key,
        user_id: otherTestUser._id,
        room_id: room._id
      })
      .expect(201)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        next(err);
      });
  });


  it('Модератор добавился в комнату', function (done) {
      request(app)
        .post('/room/get')
        .send({
          session_key: session_key,
          room_id: room._id
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          // Запрос
          assert('undefined' === typeof res.body.error);
          // Комната
          assert('undefined' === typeof res.body.data.rooms[0].password);
          assert(room._id === res.body.data.rooms[0]._id);
          assert(otherTestUser._id === res.body.data.rooms[0].moderators[0]);
          done(err);
        });
  });


  it('Молчание на пользователя может кастовать только модератор', function (done) {
    request(app)
      .post('/room/silence')
      .send({
        session_key: thirdSession_key,
        room_id: room._id,
        user_id: otherTestUser._id,
        finished: (+new Date() + 1000) // timestamp
      })
      // Все ок
      .expect(403)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Молчание пользователя', function (done) {
    var endDate = (+new Date() + 1000)+0.056114;
    var next = new Countdown(2, done);
    var finished = false;
    // Subscribe to message
    otherSocket.on('service-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('silence' === res.data.message.type);
        assert(testUser._id === res.data.message.author);
        assert(otherTestUser._id === res.data.message.user);
        assert(room._id === res.data.message.room);
        assert('Shut ur mouth!' === res.data.message.text);
        assert(endDate === res.data.message.finished);
        assert('number' === typeof res.data.message.create_at);
        assert(messageToServiceMessagesTest._id === res.data.message.ref_message._id);
        assert('Hello gays!' === res.data.message.ref_message.text);
        next();
      }
    });

    request(app)
      .post('/room/silence')
      .send({
        session_key: session_key,
        room_id: room._id,
        user_id: otherTestUser._id,
        finished: endDate, // timestamp
        text: 'Shut ur mouth!',
        ref_message: messageToServiceMessagesTest._id
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        next(err);
      });

  });


  it('При молчании активная комната пользователя не сбрасывается', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: otherTestUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(otherTestUser.phone === res.body.data.user.phone);
        assert(room._id === res.body.data.user.room);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Пользователь не может писать сообщения, пока не кончится молчание', function (done) {
    request(app)
      .post('/room/sendMessage')
      .send({
        session_key: otherSession_key,
        message: {
          room_id: room._id,
          text: 'SILENCE!'
        }
      })
      // Все ок
      .expect(403)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Пользователь может писать сообщения, когда молчание заканчивается', function (done) {
    setTimeout(function () {
      request(app)
        .post('/room/sendMessage')
        .send({
          session_key: otherSession_key,
          message: {
            room_id: room._id,
            text: 'Hello gays!'
          }
        })
        // Все ок
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          assert('undefined' === typeof res.body.error);
          assert('object' === typeof res.body.data.message);
          assert('undefined' === typeof res.body.data.error);
          assert('Hello gays!' === res.body.data.message.text);
          assert('number' === typeof res.body.data.message.create_at);
          assert(room._id === res.body.data.message.room);
          assert(otherTestUser._id === res.body.data.message.author);
          done(err);
        });
    }, 1000);
  });


/**
 * ПОВТОРНЫЙ ТЕСТ МОЛЧАНИЯ
 */


  it('Молчание пользователя (Повторный тест)', function (done) {
    var endDate = (+new Date() + 1000)+0.0564;
    var next = new Countdown(2, done);
    var finished = false;
    // Subscribe to message
    otherSocket.on('service-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('silence' === res.data.message.type);
        assert(testUser._id === res.data.message.author);
        assert(otherTestUser._id === res.data.message.user);
        assert(room._id === res.data.message.room);
        assert('Shut ur mouth!' === res.data.message.text);
        assert(endDate === res.data.message.finished);
        assert('number' === typeof res.data.message.create_at);
        assert(messageToServiceMessagesTest._id === res.data.message.ref_message._id);
        assert('Hello gays!' === res.data.message.ref_message.text);
        next();
      }
    });

    request(app)
      .post('/room/silence')
      .send({
        session_key: session_key,
        room_id: room._id,
        user_id: otherTestUser._id,
        finished: endDate, // timestamp
        text: 'Shut ur mouth!',
        ref_message: messageToServiceMessagesTest._id
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        next(err);
      });

  });


  it('При молчании активная комната пользователя не сбрасывается (Повторный тест)', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: otherTestUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(otherTestUser.phone === res.body.data.user.phone);
        assert(room._id === res.body.data.user.room);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Пользователь не может писать сообщения, пока не кончится молчание (Повторный тест)', function (done) {
    request(app)
      .post('/room/sendMessage')
      .send({
        session_key: otherSession_key,
        message: {
          room_id: room._id,
          text: 'SILENCE!'
        }
      })
      // Все ок
      .expect(403)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Пользователь может писать сообщения, когда молчание заканчивается (Повторный тест)', function (done) {
    setTimeout(function () {
      request(app)
        .post('/room/sendMessage')
        .send({
          session_key: otherSession_key,
          message: {
            room_id: room._id,
            text: 'Hello gays!'
          }
        })
        // Все ок
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          assert('undefined' === typeof res.body.error);
          assert('object' === typeof res.body.data.message);
          assert('undefined' === typeof res.body.data.error);
          assert('Hello gays!' === res.body.data.message.text);
          assert('number' === typeof res.body.data.message.create_at);
          assert(room._id === res.body.data.message.room);
          assert(otherTestUser._id === res.body.data.message.author);
          done(err);
        });
    }, 1000);
  });

/**
 *  Повторный тест молчания
 */



  it('Получение списка сообщений', function (done) {
    request(app)
      .post('/room/chat')
      .send({
        session_key: session_key,
        room: room._id,
        skip: -4,
        limit: 4
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.chat));
        assert(4 === res.body.data.chat.length);
        assert('number' === typeof res.body.data.chat[0].create_at);
        done(err);
      });
  });


  it('Получение списка сообщений только с skip', function (done) {
    request(app)
      .post('/room/chat')
      .send({
        session_key: session_key,
        room: room._id,
        skip: 3
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(8 === res.body.data.chat.length); // 8-3=6
        message_to_complaint = res.body.data.chat[0];
        done(err);
      });
  });


  it('Получение списка сообщений с отрицательным skip (для получения первых значений)', function (done) {
    request(app)
      .post('/room/chat')
      .send({
        session_key: session_key,
        room: room._id,
        skip: -2
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.chat));
        assert(2 === res.body.data.chat.length);
        done(err);
      });
  });


  it('Получение списка сообщений с оффсетом и отрицательным лимитом', function (done) {
    request(app)
      .post('/room/chat')
      .send({
        session_key: session_key,
        room: room._id,
        limit: 100,
        skip: -100
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.chat));
        assert(11 === res.body.data.chat.length);
        done(err);
      });
  });


  it('Получение списка сообщений с оффсетом и отрицательным лимитом', function (done) {
    request(app)
      .post('/room/chat')
      .send({
        session_key: session_key,
        room: room._id,
        limit: 100,
        skip: -200
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.chat));
        assert(11 === res.body.data.chat.length);
        done(err);
      });
  });


  it('Получение списка сообщений пользователем, который не находится в чате', function (done) {
    request(app)
      .post('/room/chat')
      .send({
        room: room._id,
        session_key: thirdSession_key,
        limit: 4,
        offset: 1
      })
      .expect(403)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        assert('undefined' == typeof res.body.data);
        done(err);
      });
  });


  it('Оставить жалобу на сообщение', function (done) {
    request(app)
      .post('/complaints/new')
      .send({
        session_key: session_key,
        message: message_to_complaint._id,
        text: 'You are just dirt!'
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data);
        assert(message_to_complaint._id === res.body.data.complaint.message[0]._id);
        assert(message_to_complaint.text === res.body.data.complaint.message[0].text);
        assert('You are just dirt!' === res.body.data.complaint.text);
        assert(testUser._id === res.body.data.complaint.author);
        done(err);
      });
  });


  it('Получить список жалоб по комнате', function (done) {
    request(app)
      .post('/complaints/')
      .send({
        // TODO: Убрать за Basic-AUTH
        room: room._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data);
        assert(Array.isArray(res.body.data.complaints));
        assert(1 === res.body.data.complaints.length);

        assert(message_to_complaint._id === res.body.data.complaints[0].message[0]._id);
        assert(message_to_complaint.text === res.body.data.complaints[0].message[0].text);
        assert('You are just dirt!' === res.body.data.complaints[0].text);

        done(err);
      });
  });


  it('Отправка личного сообщения и получение в фиде через сокет', function (done) {
    var next = new Countdown(3, done);
    var finished = false;
    var finished2 = false;

    // Subscribe to message
    socket.on('direct-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('Hello TestUser!' === res.data.message.text);
        assert('number' === typeof res.data.message.create_at);
        assert(otherTestUser._id === res.data.message.author);
        assert(testUser._id === res.data.message.user);
        next();
      }
    });

    otherSocket.on('direct-message', function (res) {
      if (!finished2) {
        finished2 = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('Hello TestUser!' === res.data.message.text);
        assert('number' === typeof res.data.message.create_at);
        assert(otherTestUser._id === res.data.message.author);
        assert(testUser._id === res.data.message.user);
        next();
      }
    });

    request(app)
      .post('/user/sendMessage')
      .send({
        session_key: otherSession_key,
        message: {
          user: testUser._id,
          text: 'Hello TestUser!'
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.message);
        assert('Hello TestUser!' === res.body.data.message.text);
        assert('number' === typeof res.body.data.message.create_at);
        assert(otherTestUser._id === res.body.data.message.author);
        assert(testUser._id === res.body.data.message.user);
        next(err);
      });
  });


  it('Отправка еще пары личных сообщений', function (done) {
    var next = new Countdown(3, done);

    request(app)
      .post('/user/sendMessage')
      .send({
        session_key: otherSession_key,
        message: {
          user: testUser._id,
          text: 'Hello again!'
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.message);
        assert('Hello again!' === res.body.data.message.text);
        assert('number' === typeof res.body.data.message.create_at);
        assert(otherTestUser._id === res.body.data.message.author);
        assert(testUser._id === res.body.data.message.user);
        next(err);
      });

    request(app)
      .post('/user/sendMessage')
      .send({
        session_key: thirdSession_key,
        message: {
          user: testUser._id,
          text: 'Do U fucn ignoren me bich?!'
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.message);
        assert('Do U fucn ignoren me bich?!' === res.body.data.message.text);
        assert('number' === typeof res.body.data.message.create_at);
        assert(thirdTestUser._id === res.body.data.message.author);
        assert(testUser._id === res.body.data.message.user);
        next(err);
      });

    request(app)
      .post('/user/sendMessage')
      .send({
        session_key: session_key,
        message: {
          user: otherTestUser._id,
          text: 'Ou... Sorry brou'
        }
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.message);
        assert('Ou... Sorry brou' === res.body.data.message.text);
        assert('number' === typeof res.body.data.message.create_at);
        assert(testUser._id === res.body.data.message.author);
        assert(otherTestUser._id === res.body.data.message.user);
        next(err);
      });
  });


  it('Получение списка личных сообщений', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: session_key
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.messages));
        assert(testUser._id === res.body.data.messages[0].user);
        done(err);
      });
  });


  it('Получение списка личных сообщений с лимитом в 2', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: session_key,
        limit: 2,
        skip: 0
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.messages));
        assert(2 === res.body.data.messages.length);
        done(err);
      });
  });


  it('Получение количества непрочитанных личных сообщений', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: session_key,
        countOnly: true
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('number' === typeof res.body.data.messages);
        assert(3 === res.body.data.messages);
        done(err);
      });
  });


  it('Получение списка всех пользователей, которые отправляли личные сообщения', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: session_key,
        distinct: true
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // TODO: Не возвращает список пользователей, которым автор написал, но они ему — еще нет
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.users));
        assert(2 === res.body.data.users.length);
        done(err);
      });
  });

  it('Получение списка диалогов', function (done) {
    request(app)
      .post('/user/dialogs')
      .send({
        session_key: session_key
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.dialogs));
        assert('string' === typeof res.body.data.dialogs[0].user);
        assert('string' === typeof res.body.data.dialogs[0].last_message.text);
        assert('number' === typeof res.body.data.dialogs[0].last_message.create_at);
        assert('number' === typeof res.body.data.dialogs[0].unread);
        done(err);
      });
  });


  it('Получение списка диалогов с неправильной сессией', function (done) {
    request(app)
      .post('/user/dialog')
      .send({
        session_key: randomObjectID
      })
      .expect(440)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Получение диалога с пользователем', function (done) {
    request(app)
      .post('/user/dialog')
      .send({
        session_key: session_key,
        user: otherTestUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.dialog));
        assert('number' === typeof res.body.data.dialog[0].create_at);
        assert('string' === typeof res.body.data.dialog[0].user);
        assert('string' === typeof res.body.data.dialog[0].text);
        done(err);
      });
  });


  it('Получение диалога с пользователем', function (done) {
    request(app)
      .post('/user/dialog')
      .send({
        session_key: session_key,
        user: otherTestUser._id,
        limit: 1
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.dialog));
        assert(1 === res.body.data.dialog.length);
        assert('string' === typeof res.body.data.dialog[0].user);
        assert('string' === typeof res.body.data.dialog[0].text);
        limitMessage = res.body.data.dialog[0];
        done(err);
      });
  });

  it('Получение диалога с пользователем', function (done) {
    request(app)
      .post('/user/dialog')
      .send({
        session_key: session_key,
        user: otherTestUser._id,
        limit: 1,
        skip: 1
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.dialog));
        assert(1 === res.body.data.dialog.length);
        assert('string' === typeof res.body.data.dialog[0].user);
        assert('string' === typeof res.body.data.dialog[0].text);
        assert(limitMessage._id !== res.body.data.dialog[0]._id);
        done(err);
      });
  });


  it('Получение диалога с пользователем с неверной сессией', function (done) {
    request(app)
      .post('/user/dialogs')
      .send({
        session_key: randomObjectID
      })
      .expect(440)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });



  it('Получение списка личных сообщений (по автору)', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: session_key,
        author: thirdTestUser._id,
        limit: 10,
        skip: 0
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.messages));
        assert(1 === res.body.data.messages.length);
        message_to_read = res.body.data.messages[0];
        done(err);
      });
  });


  it('Получение списка отправленных личных сообщений', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: otherSession_key,
        user: testUser._id,
        limit: 10,
        offset: 0
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.messages));
        assert(2 === res.body.data.messages.length);
        done(err);
      });
  });


  it('Получение последних 2 личных сообщений', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: session_key,
        limit: 2
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.messages));
        assert(2 === res.body.data.messages.length);
        done(err);
      });
  });


  it('Указание и автора и пользователя в личных сообщениях — 400-ая ошибка', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: otherSession_key,
        user: testUser._id,
        author: thirdTestUser._id,
        limit: 10,
        offset: 0
      })
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        assert('undefined' === typeof res.body.data);
        done(err);
      });
  });


  it('По умолчанию личное сообщение отмечено как не прочитанное', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: session_key,
        author: thirdTestUser._id,
        limit: 10,
        offset: 0
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.messages));
        assert(1 === res.body.data.messages.length);
        assert(true === res.body.data.messages[0].unread);
        done(err);
      });
  });


  it('Отметить сообщение как прочитанное может только получатель', function (done) {
    request(app)
      .post('/user/messages/mark-as-read')
      .send({
        session_key: otherSession_key,
        message: message_to_read._id
      })
      .expect(404)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });

  it('Отметить сообщение как прочитанное', function (done) {

    var next = new Countdown(2, done);
    var finished = false;

    // Subscribe to message
    socket.on('read-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert(message_to_read._id === res.data.message._id);
        assert('string' === typeof res.data.message.text);
        assert('number' === typeof res.data.message.create_at);
        assert(thirdTestUser._id === res.data.message.author);
        assert(testUser._id === res.data.message.user);
        next();
      }
    });

    request(app)
      .post('/user/messages/mark-as-read')
      .send({
        session_key: session_key,
        message: message_to_read._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        next(err);
      });
  });


  it('Отметка «прочитано» корректно сохраняется', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: session_key,
        author: thirdTestUser._id,
        limit: 10,
        offset: 0
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.messages));
        assert(1 === res.body.data.messages.length);
        assert(false === res.body.data.messages[0].unread);
        done(err);
      });
  });


  it('Удаление модератора администратором', function (done) {

    var next = new Countdown(2, done);
    var finished = false;
    // Subscribe to message
    socket.on('service-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('remove moderator' === res.data.message.type);
        assert(otherTestUser._id === res.data.message.user);
        assert(testUser._id === res.data.message.author);
        assert(room._id === res.data.message.room);
        assert('number' === typeof res.data.message.create_at);
        next();
      }
    });

    request(app)
      .post('/room/remove-moderator')
      .send({
        session_key: session_key,
        user_id: otherTestUser._id,
        room_id: room._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        next(err);
      });
  });



  it('Модератор удален', function (done) {
      request(app)
        .post('/room/get')
        .send({
          session_key: session_key,
          room_id: room._id
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          // Запрос
          assert('undefined' === typeof res.body.error);
          // Комната
          assert('undefined' === typeof res.body.data.rooms[0].password);
          assert(room._id === res.body.data.rooms[0]._id);
          assert(0 === res.body.data.rooms[0].moderators.length);
          done(err);
        });
  });



  it('Пользователь может удалять только свои сообщения, чужие сообщения не находятся', function (done) {
    request(app)
      .post('/user/messages/remove')
      .send({
        session_key: session_key,
        message: message_to_read._id,
      })
      .expect(404)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('При удалении сообщения не его автором оно не удаляется', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: session_key,
        author: thirdTestUser._id,
        limit: 10,
        offset: 0
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.messages));
        assert(1 === res.body.data.messages.length);
        done(err);
      });
  });


  it('Удаление личного сообщения автором', function (done) {
    request(app)
      .post('/user/messages/remove')
      .send({
        session_key: thirdSession_key,
        message: message_to_read._id,
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        done(err);
      });
  });


  it('При удалении сообщения его автором оно удаляется', function (done) {
    request(app)
      .post('/user/messages')
      .send({
        session_key: session_key,
        author: thirdTestUser._id,
        limit: 10,
        offset: 0
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.messages));
        assert(0 === res.body.data.messages.length);
        done(err);
      });
  });


  it('Удаление диалога без указанного пользователя', function (done) {
    request(app)
      .post('/user/remove-dialog')
      .send({
        session_key: session_key,
      })
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Удаление диалога', function (done) {
    request(app)
      .post('/user/remove-dialog')
      .send({
        session_key: session_key,
        user: otherTestUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        done(err);
      });
  });


  it('Удаление второго диалога', function (done) {
    request(app)
      .post('/user/remove-dialog')
      .send({
        session_key: session_key,
        user: thirdTestUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        done(err);
      });
  });


  it('Получение отсутствующего списка диалогов первого пользователя', function (done) {
    request(app)
      .post('/user/dialogs')
      .send({
        session_key: session_key
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.dialogs));
        done(err);
      });
  });

  it('Первым в списке комнат идет комната-город', function (done) {
      request(app)
        .post('/room/get')
        .send({
          session_key: session_key
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          assert('undefined' === typeof res.body.error);
          assert('Perm' === res.body.data.rooms[0].name);
          done(err);
        });
  });

  it('Первым в списке комнат идет комната-город 2', function (done) {
      request(app)
        .post('/room/get')
        .send({
          session_key: otherSession_key
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          assert('undefined' === typeof res.body.error);
          assert('Moscow' === res.body.data.rooms[0].name);
          done(err);
        });
  });

  it('Получение списка комнат без параметров', function (done) {
      request(app)
        .post('/room/get')
        .send({
          session_key: session_key
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {

          // Запрос
          assert('undefined' === typeof res.body.error);
          assert(Array.isArray(res.body.data.rooms));
          assert('number' === typeof res.body.data.count); // Общее к-во комнат

          // Комната
          assert('undefined' === typeof res.body.data.rooms[1].password);
          assert('object' === typeof res.body.data.rooms[1]);
          assert('string' === typeof res.body.data.rooms[1].name);
          assert('string' === typeof res.body.data.rooms[1].admin);
          assert('boolean' === typeof res.body.data.rooms[1].is_private);
          assert('undefined' === typeof res.body.data.rooms[1].chat);
          assert('number' === typeof res.body.data.rooms[1].users.length);
          assert(0 === res.body.data.rooms[1].users.length); // Выход из приватной комнаты, после входа в другую
          done(err);
        });
  });


  it('Получение списка комнат по id', function (done) {
      request(app)
        .post('/room/get')
        .send({
          session_key: session_key,
          room_id: room._id
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {

          // Запрос
          assert('undefined' === typeof res.body.error);
          assert(Array.isArray(res.body.data.rooms));
          assert('number' === typeof res.body.data.count); // Общее к-во комнат
          assert(1 === res.body.data.count); // Общее к-во комнат

          // Комната
          assert('undefined' === typeof res.body.data.rooms[0].password);
          assert(room._id === res.body.data.rooms[0]._id);
          done(err);
        });
  });


  it('Получение списка комнат с пустым именем', function (done) {
      request(app)
        .post('/room/get')
        .send({
          name: '',
          session_key: session_key
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {

          // Запрос
          assert('undefined' === typeof res.body.error);
          assert(Array.isArray(res.body.data.rooms));
          assert('number' === typeof res.body.data.count); // Общее к-во комнат

          // Комната
          assert('undefined' === typeof res.body.data.rooms[1].password);
          assert('object' === typeof res.body.data.rooms[1]);
          assert('string' === typeof res.body.data.rooms[1].name);
          assert('string' === typeof res.body.data.rooms[1].admin);
          assert('boolean' === typeof res.body.data.rooms[1].is_private);
          assert('undefined' === typeof res.body.data.rooms[1].chat);
          assert('number' === typeof res.body.data.rooms[1].users.length);
          done(err);
        });
  });


  it('Получение списка комнат с сортировкой по дате (desc)', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        sort: {
          create_at: 'desc'
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Запрос
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        assert('number' === typeof res.body.data.count); // Общее к-во комнат

        // Комната
        assert('Perm' === res.body.data.rooms[0].name);
        assert('Moscow' === res.body.data.rooms[1].name);
        assert('_SUP' === res.body.data.rooms[2].name);
        assert('SUP' === res.body.data.rooms[3].name);
        done(err);
      });
  });


  it('Получение списка комнат с сортировкой по дате (asc)', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        sort: {
          create_at: 'asc'
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Запрос
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        assert('number' === typeof res.body.data.count); // Общее к-во комнат

        // Комната
        assert('Perm' === res.body.data.rooms[0].name);
        assert('SUP' === res.body.data.rooms[1].name);
        assert('_SUP' === res.body.data.rooms[2].name);
        assert('Moscow' === res.body.data.rooms[3].name);
        done(err);
      });
  });


  it('Получение списка комнат с фильтром по приватности', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        filter: {
          privated: true
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Запрос
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        assert(3 === res.body.data.count); // Общее к-во комнат

        // Комната
        assert('Perm' === res.body.data.rooms[0].name);
        assert('Moscow' === res.body.data.rooms[1].name);
        assert('SUP' === res.body.data.rooms[2].name);
        done(err);
      });
  });


  it('Получение списка комнат с фильтром по наполненности', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        filter: {
          filled: true
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Запрос

        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        assert(3 === res.body.data.count); // Общее к-во комнат

        // Комната
        assert('Perm' === res.body.data.rooms[0].name);
        done(err);
      });
  });


  it('Получение списка комнат с сортировкой по дате (asc) и смещением в 1 элемент', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        per_page: 1,
        page: 2,
        sort: {
          create_at: 'asc'
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        console.log(res.body);
        // Запрос
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        assert(4 === res.body.data.count); // Общее к-во комнат

        // Комната
        assert('Perm' === res.body.data.rooms[0].name);
        done(err);
      });
  });


  it('Получение списка комнат по имени "sup" с сортировкой по дате (asc)', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        name: 'sup',
        sort: {
          create_at: 'asc'
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Запрос
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        assert(2 === res.body.data.count); // Общее к-во комнат

        // Комната
        assert('SUP' === res.body.data.rooms[0].name);
        assert('_SUP' === res.body.data.rooms[1].name);
        done(err);
      });
  });


  it('Получение списка комнат по имени "_sup" с сортировкой по дате (asc)', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        name: '_sup',
        sort: {
          create_at: 'asc'
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Запрос
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        assert(1 === res.body.data.count); // Общее к-во комнат

        // Комната
        assert('_SUP' === res.body.data.rooms[0].name);
        done(err);
      });
  });


  it('Получение количества комнат по имени "_sup" с сортировкой по дате (asc)', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        name: '_sup',
        sort: {
          create_at: 'asc'
        },
        filter: {
          countOnly: true
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // Запрос
        assert('undefined' === typeof res.body.error);
        assert('undefined' === typeof res.body.data.rooms);
        assert(1 === res.body.data.count); // Общее к-во комнат
        done(err);
      });
  });


  it('Получение списка комнат с сортировкой по пользователям (desc)', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        sort: {
          users: 'desc'
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // Запрос
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        assert(4 === res.body.data.count); // Общее к-во комнат
        // Комната
        assert('Perm' === res.body.data.rooms[0].name);
        assert('SUP' === res.body.data.rooms[1].name);
        done(err);
      });
  });


  it('Получение списка комнат с сортировкой по пользователям (asc)', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        sort: {
          users: 'asc'
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // Запрос
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        assert(4 === res.body.data.count); // Общее к-во комнат

        // Комната
        assert('Perm' === res.body.data.rooms[0].name);
        assert('_SUP' === res.body.data.rooms[1].name);
        done(err);
      });
  });


  it('Получение списка комнат с сортировкой по дате (asc) и смещением в 1 элемент', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        per_page: 1,
        page: 2,
        sort: {
          create_at: 'asc'
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Запрос
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        // assert(2 === res.body.data.count); // Общее к-во комнат
        // Комната
        assert('Perm' === res.body.data.rooms[0].name);
        assert('_SUP' === res.body.data.rooms[1].name);
        done(err);
      });
  });


  it('Получение списка комнат (во все поля)', function (done) {
    request(app)
      .post('/room/get')
      .send({
        session_key: session_key,
        name: 'sup', // Регистро-независимый поиск на вхождение в подстроку
        page: 1, // Пагинация
        per_page: 40, // Дефолтное значение
        sort: {
          create_at: -1, // Сортировать можно по любым полям модели
          users: 1 // Если ODM поддерживает сортировку таких полей
        },
        filter: {
          filled: true, // Фильтровать заполненные
          privated: true, // Фильтровать приватные
          countOnly: false // Только количество, без самих комнат
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {

        // Запрос
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.rooms));
        assert('number' === typeof res.body.data.rooms.length);
        assert('number' === typeof res.body.data.count); // Общее к-во комнат
        assert(1 === res.body.data.count);

        // Комната
        assert('undefined' === typeof res.body.data.rooms[0].password);
        assert('object' === typeof res.body.data.rooms[0]);
        assert('string' === typeof res.body.data.rooms[0].name);
        assert('string' === typeof res.body.data.rooms[0].admin);
        assert('boolean' === typeof res.body.data.rooms[0].is_private);
        assert('number' === typeof res.body.data.rooms[0].users.length);
        done(err);
      });
  });


  it('Бан пользователя доступен только модератору', function (done) {
    request(app)
      .post('/room/ban')
      .send({
        session_key: otherSession_key,
        room_id: room._id,
        user_id: otherTestUser._id
      })
      // Все ок
      .expect(403)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Получение списка подарков', function (done) {
    request(app)
      .post('/gifts')
      .send({
        session_key: session_key
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.gifts));
        giftToGive = res.body.data.gifts[0];
        done(err);
      });
  });


  it('Покупка подарка', function (done) {


    var next = new Countdown(3, done);
    var finished = false;
    var finished2 = false;

    // Subscribe to message
    socket.on('gift-message', function (res) {
      if (!finished) {
        finished = true;
        assert('undefined' === typeof res.data.error);
        assert(testUser._id === res.data.message.author);
        assert(room._id === res.data.message.room);
        assert(otherTestUser._id === res.data.message.user);
        next();
      }
    });

    // Subscribe to message
    otherSocket.on('gift-message', function (res) {
      if (!finished2) {
        finished = true;
        assert('undefined' === typeof res.data.error);
        assert(testUser._id === res.data.message.author);
        assert(room._id === res.data.message.room);
        assert(otherTestUser._id === res.data.message.user);
        next();
      }
    });

    request(app)
      .post('/gifts/send')
      .send({
        session_key: session_key,
        gift: giftToGive._id,
        user: otherTestUser._id,
        text: 'It\'s for you <3'
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.gift);
        assert(giftToGive.name === res.body.data.gift.name);
        assert(giftToGive.price === res.body.data.gift.price);
        next(err);
      });
  });


  it('У пользователя списываются деньги за подарок', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(testUser.phone === res.body.data.user.phone);
        assert('number' === typeof res.body.data.user.balance);
        assert(200-giftToGive.price === res.body.data.user.balance); // TODO: fix it
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Покупка подарка без достаточного количества денег', function (done) {
    request(app)
      .post('/gifts/send')
      .send({
        session_key: session_key,
        gift: giftToGive._id,
        user: otherTestUser._id,
        text: 'It\'s for you <3'
      })
      // Все ок
      .expect(402)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('У пользователя есть подарок', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: otherTestUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(giftToGive.name === res.body.data.user.gifts[0].name);
        assert(giftToGive.price === res.body.data.user.gifts[0].price);
        assert(1 === res.body.data.user.gifts.length);
        done(err);
      });
  });


  it('Бесплатные монеты в соц.сетях (vk)', function (done) {
   request(app)
      .post('/user/free-coins')
      .send({
        session_key: session_key,
        type: 'vk'
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        done(err);
      });
  });


  it('Бесплатные монеты в соц.сетях только один раз в день (vk)', function (done) {
   request(app)
      .post('/user/free-coins')
      .send({
        session_key: session_key,
        type: 'vk'
      })
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Пользователю начисляются деньги за репосты (vk)', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(testUser.phone === res.body.data.user.phone);
        assert('number' === typeof res.body.data.user.balance);
        assert(53 === res.body.data.user.balance); // TODO: fix it
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Бесплатные монеты в соц.сетях (facebook)', function (done) {
   request(app)
      .post('/user/free-coins')
      .send({
        session_key: session_key,
        type: 'facebook'
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        done(err);
      });
  });


  it('Бесплатные монеты в соц.сетях только один раз в день (facebook)', function (done) {
   request(app)
      .post('/user/free-coins')
      .send({
        session_key: session_key,
        type: 'facebook'
      })
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Пользователю начисляются деньги за репосты (facebook)', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(testUser.phone === res.body.data.user.phone);
        assert('number' === typeof res.body.data.user.balance);
        assert(56 === res.body.data.user.balance); // TODO: fix it
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Бесплатные монеты в соц.сетях (twitter)', function (done) {
   request(app)
      .post('/user/free-coins')
      .send({
        session_key: session_key,
        type: 'twitter'
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        done(err);
      });
  });


  it('Бесплатные монеты в соц.сетях только один раз в день (twitter)', function (done) {
   request(app)
      .post('/user/free-coins')
      .send({
        session_key: session_key,
        type: 'twitter'
      })
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Пользователю начисляются деньги за репосты (twitter)', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(testUser.phone === res.body.data.user.phone);
        assert('number' === typeof res.body.data.user.balance);
        assert(59 === res.body.data.user.balance); // TODO: fix it
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Бесплатные монеты в соц.сетях (mail.ru)', function (done) {
   request(app)
      .post('/user/free-coins')
      .send({
        session_key: session_key,
        type: 'mailru'
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        done(err);
      });
  });


  it('Бесплатные монеты в соц.сетях только один раз в день (mail.ru)', function (done) {
   request(app)
      .post('/user/free-coins')
      .send({
        session_key: session_key,
        type: 'mailru'
      })
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Пользователю начисляются деньги за репосты (mail.ru)', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(testUser.phone === res.body.data.user.phone);
        assert('number' === typeof res.body.data.user.balance);
        assert(62 === res.body.data.user.balance); // TODO: fix it
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Бан пользователя', function (done) {

    var next = new Countdown(2, done);
    var finished = false;
    // Subscribe to message
    otherSocket.on('service-message', function (res) {
      if (!finished) {
        finished = true;
        assert('object' === typeof res.data);
        assert('undefined' === typeof res.data.error);
        assert('ban' === res.data.message.type);
        assert(testUser._id === res.data.message.author); // Популяризовать?
        assert(otherTestUser._id === res.data.message.user); // Популяризовать?
        assert(room._id === res.data.message.room);
        assert(messageToServiceMessagesTest._id === res.data.message.ref_message._id);
        assert('Hello gays!' === res.data.message.ref_message.text);
        next();
      }
    });

    request(app)
      .post('/room/ban')
      .send({
        session_key: session_key,
        room_id: room._id,
        user_id: otherTestUser._id,
        ref_message: messageToServiceMessagesTest._id
      })
      // Все ок
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        next(err);
      });

  });


  it('После бана активная комната пользователя сброшена в undefined', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: otherSession_key,
        user_id: otherTestUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('object' === typeof res.body.data.user);
        assert(otherTestUser.phone === res.body.data.user.phone);
        assert('undefined' === typeof res.body.data.user.room);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('После бана пользователь не может войти в чат', function (done) {
    request(app)
      .post('/room/enter')
      .send({
        session_key: otherSession_key,
        room: {
          id: room._id
        }
      })
      // Все ок
      .expect(403)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        assert('undefined' === typeof res.body.data);
        done(err);
      });
  });


  it('Нет забаненного пользователя', function (done) {
      request(app)
        .post('/room/get')
        .send({
          session_key: session_key,
          room_id: room._id
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {

          // Запрос
          assert('undefined' === typeof res.body.error);
          assert(Array.isArray(res.body.data.rooms));
          assert('number' === typeof res.body.data.count); // Общее к-во комнат
          assert(!~res.body.data.rooms[0].users.indexOf(otherTestUser._id.toString())); // Нет кикнутого пользователя
          assert(1 === res.body.data.rooms[0].users.length); // Общее к-во комнат

          // Комната
          assert('undefined' === typeof res.body.data.rooms[0].password);
          assert(room._id === res.body.data.rooms[0]._id);
          done(err);
        });
  });


  it('Удаление комнаты не от лица администратора', function (done) {
    request(app)
      .post('/room/remove')
      .send({
        session_key: otherSession_key,
        room: {
          id: room._id
        }
      })
      // Не авторизован
      .expect(403)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Удаление комнаты администратором', function (done) {
    request(app)
      .post('/room/remove')
      .send({
        session_key: session_key,
        room: {
          id: room._id
        }
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        done(err);
      });
  });


  it('Посещенная комната удалилась из истории посещений пользователя (осталась 1 комната)', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('undefined' === typeof res.body.data.user.password);
        assert('object' === typeof res.body.data.user.visitedRooms);
        assert(privateRoom._id === res.body.data.user.visitedRooms[0]);
        assert(1 === res.body.data.user.visitedRooms.length);
        done(err);
      });
  });


  it('Уделенные комнаты удаляются и из списка созданных комнат (осталась: 1)', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.user.rooms));
        assert(1 === res.body.data.user.rooms.length);
        assert(privateRoom._id === res.body.data.user.rooms[0]);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Удаление приватной комнаты администратором', function (done) {
    request(app)
      .post('/room/remove')
      .send({
        session_key: session_key,
        room: {
          id: privateRoom._id
        }
      })
      // Не авторизован
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        done(err);
      });
  });


  it('Уделенные комнаты удаляются и из списка созданных комнат (осталась: 0)', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert(Array.isArray(res.body.data.user.rooms));
        assert(0 === res.body.data.user.rooms.length);
        assert('undefined' === typeof res.body.data.user.password);
        done(err);
      });
  });


  it('Посещенная комната удалилась из истории посещений пользователя (осталась: 0)', function (done) {
   request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key,
        user_id: testUser._id
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('undefined' === typeof res.body.error);
        assert('shuvalov-anton' === res.body.data.user.nickname);
        assert('undefined' === typeof res.body.data.user.password);
        assert('object' === typeof res.body.data.user.visitedRooms);
        assert(0 === res.body.data.user.visitedRooms.length);
        done(err);
      });
  });


  it('Удаление несуществующей/удаленной комнаты', function (done) {
    request(app)
      .post('/room/remove')
      .send({
        session_key: session_key,
        room: {
          id: room._id
        }
      })
      // Комнаты уже нет
      .expect(404)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        assert('string' === typeof res.body.error);
        done(err);
      });
  });


  it('Отключение сокета', function (done) {
    socket.disconnect();
    setTimeout(function () {
      mongoose.model('Session').findById(session_key, function (err, session) {
        assert(!session.sockets.length);
        done(err);
      });
    }, 1000);
  });


  it('Выход из аккаунта', function (done) {
    request(app)
      .post('/init/exit')
      .send({
        session_key: session_key
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // Должны получить session key
        assert('undefined' === typeof res.body.error);
        done(err);
      });
  });


  it('Сессия разлогиневшегося пользователя удалена', function (done) {
    request(app)
      .post('/init/getUser')
      .send({
        session_key: session_key
      })
      // Сессия истекла
      .expect(440)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        // Должны получить ошибку
        assert('string' === typeof res.body.error);
        done(err);
      });
  });

});
