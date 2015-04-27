# JustChat API

### Ошибки

Ошибки API передаются с помощью [HTTP STATUS_CODES][0]. Описание ошибки
указывается в поле ответа — `.error`. Обычно оно соответствует HTTP статусу
ошибки, за исключением 500-ой. В случае с 500-ой ошибкой я передаю в поле
`.error` содержимое `error.message` ошибки, которая произошла в одном из
компонентов системы (mongo, express, http и тд.). При необходимости я могу
парсить 500-ую ошибку на сервере и отвечать более точным кодом.

### Регистрация

Пользователь получит уведомление по СМС, в котором будет указан пароль
для входа в приложение. Но если на моем счете кончатся деньги — может не получить =)

Если номер уже зарегистрирован — произойдет повторная генерация пароля и отправка
SMS.

```bash
  [POST] '/init/reg'
  # Запрос:
  {
    phone: "+79223438450", # Можно и без «+»
    # Можно указывать и другие поля модели, если их нужно заполнить при регистрации
  }
  201 # Created — успешный ответ
  200 # OK — успешный ответ (Повторная регистрация)
  {} # Тело ответа пустое

  # Возможные ошибки
  500 # Server Error
```

### Авторизация

Получение `session_key`, которым нужно подписывать остальные запросы.

```bash
  [POST] '/init/auth'
  # Запрос:
  {
    phone: '+79223438450',
    key: 1234 # Пароль, полученный по СМС
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      session_key: "52ee29b565e203779f2e37f3",
      user: {
        _id: "52efb7baf009c900003731c7",
        __v: "0",
        phone: "79124901694",
        create_at: "2014-02-03T15:37:30.126Z"
      }
    }
  }

  # Возможные ошибки
  400 # Client Error — Ошибка валидации данных клиента (тут — невалидный телефон)
  401 # Unauthorized — неверный логин || пароль
  500 # Server Error
```


### Инвайты

```bash
  [POST] '/init/invite'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    phons: ["+79223438450", 89223434451], # Можно и без «+»
    # Можно указывать и другие поля модели, если их нужно заполнить при регистрации
  }
  200 # Created — успешный ответ
  {} # Тело ответа пустое

  # Возможные ошибки
  500 # Server Error
```


### Обновление данных пользователя

```bash
  [POST] '/init/edit'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    user: {
      # Любые поля модели, которые нужно обновить.
      # Поля, не существующие в модели, будут отброшены валидатором
      nickname: 'shuvalov-anton',
      location: 'Perm',
      dob: '1990-02-08',
      gender: 0 #
    };
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      user: {
        _id: "52efb7baf009c900003731c7",
        __v: "0", # Версионность. Уберу
        phone: "79124901694",
        nickname: 'shuvalov-anton',
        location: 'Perm',
        dob: '1990-2-8',
        gender: 0,
        create_at: "2014-02-03T15:37:30.126Z",
        # Возможны и другие поля модели
      }
    }
  }

  # Возможные ошибки
  400 # Client Error — Ошибка валидации данных клиента
  440 # Login Timeout — Сессия истекла
  500 # Server Error
```

### Пополнение баланса


```bash
  [POST] '/user/updateBalance'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    balance: 200,
    secret: secret
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      user: UserSchema
    }
  }

  # Возможные ошибки
  403 # Не совпадает подпись и сумма
  440 # Login Timeout — Сессия истекла
  500 # Server Error
```

Вычисление секрета:

    var SECRET_KEY = 'JHFGLJfgbkg*&@:EVJHV/l12p';
    var balance = 100;
    return crypto
      .createHash('md5')
      .update(SECRET_KEY + balance)
      .digest('hex');


### Получение информации о пользователе по ID

```bash
  [POST] '/init/getUser'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    user_id: "52efb7baf009c900003731c7" # _id нужного пользователя
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      user: {
        _id: "52efb7baf009c900003731c7",
        __v: "0", # Версионность. Уберу
        phone: "79124901694",
        nickname: "root", # Никнейм
        location: "Russia, Perm", # Строка с городом
        photo: "/uploads/randomsymbols.jpg" # Аватар
        room: "52efb7baf009c900003731c7", # Активная комната
        rooms: ["52efb7baf009c900003731c7", "52efb7baf009c900003731c7"], # Созданные комнаты
        visitedRooms: ["52efb7baf009c900003731c7", "52efb7baf009c900003731c7"], # Посещенные комнаты
        gender: 0/1 # Пол
        create_at: "2014-02-03T15:37:30.126Z",
        # Другие поля модели
      }
    }
  }

  # Возможные ошибки
  404 # Not Found — Пользователь не найден
  440 # Login Timeout — Сессия истекла
  500 # Server Error
```


### Создание комнаты

```bash
  [POST] '/room/create'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    room: {
      name: "foo"
      password: "baz"
      # Допустимо указывать и другие параметры модели
    }
  }
  201 # Created — успешный ответ
  # Ответ:
  {
    data: {
      room: {
        _id: "52efb7baf009c900003731c7",
        name: "foo",
        is_private: true,
        admin: "52efb7baf009c900003731c7",
        users: [], # Список _id пользователей
        moderators: [], # Список модераторов
        created_at: "2014-02-03T15:37:30.126Z" // Время создания комнаты
        # Другие поля модели
      }
    }
  }

  # Возможные ошибки
  409 # Conflict — Конфликт уникальных полей (_id). Возможен в будущем, если мы сделаем какие-то поля уникальными
  440 # Login Timeout — Сессия истекла
  500 # Server Error
```

### Вход в комнату

```bash
  [POST] '/room/enter'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    room: {
      id: "52ee29b565e203779f2e37f3"
      password: "baz"
    }
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      room: {
        _id: "52efb7baf009c900003731c7",
        name: "foo",
        is_private: true,
        admin: "52efb7baf009c900003731c7",
        users: ["52efb7baf009c900003731c7"], # Список _id пользователей
        silently: {
            "52efb7baf009c900003731c7": 12345678910 # Таймстамп и id пользователя
        },
        banned: ["52efb7baf009c900003731c7", "52efb7baf009c900003731c7"],
        visiters: ["52efb7baf009c900003731c7", "52efb7baf009c900003731c7"],
        moderators: [], # Список модераторов
        # Другие поля модели
      }
    }
  }

  # Возможные ошибки
  401 # Unauthorized — неверный пароль
  404 # Not Found — комната не найдена
  440 # Login Timeout — Сессия истекла
  500 # Server Error
```

### Получение списка комнат

```bash
  [POST] '/room/get'
  # Запрос
  {
    room_id: room_id # ID комнаты
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
      countOnly: false // при `true` вернется только количество, без самих комнат
    }
  }
  200 # OK — успешный ответ
  # Ответ
  {
    data: {
      rooms: [{
        _id: "52efb7baf009c900003731c7",
        name: "foo",
        chat: undefined,
        is_private: true,
        admin: "52efb7baf009c900003731c7",
        users: [], # Список _id пользователей
        moderators: [], # Список модераторов
        created_at: timestamp // Время создания комнаты
        # Другие поля модели
      }, {
        # other rooms
      }]
    }
  }
```

### Удаление комнаты

```bash
  [POST] '/room/remove'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    room: {
      id: "52ee29b565e203779f2e37f3"
    }
  }
  200 # OK — успешный ответ
  # ответ:
  {}

  # Возможные ошибки
  401 # Unauthorized — недостаточно прав. Не админ.
  404 # Not Found — комната не найдена
  440 # Login Timeout — Сессия истекла
  500 # Server Error
```


### Отправка сообщения

```bash
  [POST] '/room/sendMessage'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    message: {
      room_id: "52ee29b565e203779f2e37f3",
      text: 'SUP'
    }
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      message: {
        room: "52ee29b565e203779f2e37f3",
        text: 'SUP',
        author: "52ee29b565e203779f2e37f3",
        create_at: timestamp
      }
    }
  }

  # Возможные ошибки
  403 # Unauthorized — Пользователь не в комнате, или на пользователя наложено молчание
  404 # Not Found — комната не найдена
  440 # Login Timeout — Сессия истекла
  500 # Server Error
```


### Подключение к сокету

Сокет работает на 8000 порту используется для получения уведомлений о сообщениях
в комнате, диалогах, системных сообщениях и тд. Отправка сообщений происходит
через API.

Не знаю, как на iOS. На JS так:

```js
socket = io.connect(productionURL:4000);
socket.on('connect', function () {
  // …
});
```

### Связывание сессии и сокета

```js
// Нужно отправить серверу событие `init`, и объект с `session_key`.
socket.emit('init', {session_key: "52efb7baf009c900003731c7"});
// После связывания сервер отправит клиенту событие `ready`.
socket.on('ready', function (data) {
  // Теперь можно работать через сокет
});
```

### Получение сообщений

```bash
  [socket] 'message'
  # Ответ:
  {
    error: null,
    text: 'SUP',
    author: "52efb7baf009c900003731c7",
    created_at: "2014-02-03T15:37:30.126Z"
  }
```

### Выход из аккаунта

```bash
  [POST] '/init/exit'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
  }
  200 # OK — успешный ответ
  # Ответ:
  {}

  # Возможные ошибки
  500 # Server Error
```


### Загрузка изображений

```bash
  [POST] '/upload'
  # Заголовок — `photo` (?)
  201 # успешный ответ
  # Ответ:
  {
    url: 'uploads/2320698041ffde36f7616a7c7877cfdf.png' // Расширение файла оригинальное
  }
  # Возможные ошибки
  500 # Server Error
```


### Сервисные сообщения

#### Kick

У кикнутого пользователя сбрасывается текущая комната, и для написания сообщений
нужно перезайти в комнату.

```bash
  [POST] '/room/kick'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    room_id: "52ee29b565e203779f2e37f3", # Комната
    user_id: "52ee29b565e203779f2e37f3", # Кого кикать
    ref_message: "52ee29b565e203779f2e37f3" # Ссылка на сообщение
  }
  200 # OK — успешный ответ
  # Ответ:
  {}

  # Возможные ошибки
  500 # Server Error
```

Уведомление в сокет:

```bash
  [socket] 'service-message'
  # Ответ:
  {
    error: null,
    type: "kick"
    room: "52efb7baf009c900003731c7" # Комната
    user: "52efb7baf009c900003731c7" # Кого
    author: "52efb7baf009c900003731c7", # Кто кикнул
    created_at: "2014-02-03T15:37:30.126Z",
    ref_message: MessageSchema
  }
```


#### silence

Запрос на отправку сообщения у пользователя, на которого наложили тишину, будет
возвращать ошибку `403` до того, как время тишины не истечет.

Кроме того, при запросе комнаты будет возвращаться информация о пользователях,
которые не могут писать в чат.


```bash
  [POST] '/room/silence'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    room_id: "52ee29b565e203779f2e37f3", # Комната
    user_id: "52ee29b565e203779f2e37f3", # Кого кикать
    finished: (+new Date() + 1000) # timestamp, когда сможет говорить
    text: "Комментарий",
    ref_message: "52ee29b565e203779f2e37f3" # Ссылка на сообщение
  }
  200 # OK — успешный ответ
  # Ответ:
  {}

  # Возможные ошибки
  500 # Server Error
  403 # Нет права на действие
```

Уведомление в сокет:

```bash
  [socket] 'service-message'
  # Ответ:
  {
    error: null,
    type: "silence"
    room: "52efb7baf009c900003731c7" # Комната
    user: "52efb7baf009c900003731c7" # Кого
    author: "52efb7baf009c900003731c7", # Кто
    text: "Комментарий"
    created_at: "2014-02-03T15:37:30.126Z"
    ref_message: MessageSchema
  }
```


#### ban

```bash
  [POST] '/room/ban'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    room_id: "52ee29b565e203779f2e37f3", # Комната
    user_id: "52ee29b565e203779f2e37f3", # Кого
    ref_message: "52ee29b565e203779f2e37f3" # Ссылка на сообщение
  }
  200 # OK — успешный ответ
  # Ответ:
  {}

  # Возможные ошибки
  500 # Server Error
  403 # Нет права на действие
```

Уведомление в сокет:

```bash
  [socket] 'service-message'
  # Ответ:
  {
    error: null,
    type: "ban"
    room: "52efb7baf009c900003731c7" # Комната
    user: "52efb7baf009c900003731c7" # Кого
    author: "52efb7baf009c900003731c7", # Кто
    created_at: "2014-02-03T15:37:30.126Z",
    ref_message: MessageSchema
  }
```


### Жалоба

```bash
  [POST] '/complaints/new'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    message: "52ee29b565e203779f2e37f3",
    text: "Комментарий к жалобе"
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    complaint: {
      author: "52ee29b565e203779f2e37f3",
      room: "52ee29b565e203779f2e37f3",
      message: { 
        # Пример жалобы на сервисное сообщение(sic!), но вообще, тут может быть любое сообщение
        _id: '530a30c649b9733ae9af7145',
        room: '530a30c649b9733ae9af7143',
        user: '530a30c649b9733ae9af713e',
        type: 'new roommate',
        create_at: '2014-02-23T17:32:54.683Z' 
      },
      create_at: "2014-02-23T17:30:50.084Z"
    }
  }

  # Возможные ошибки
  500 # Server Error
  403 # Нет права на действие
```

### История сообщений

```bash
  [POST] '/room/chat'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    room: "52ee29b565e203779f2e37f3", # Комната
    skip: -200, # откуда брать: отрицательное — n последних сообщений, положительное — взять сообщения после n.
                # Если -n больше, чем длина массива — это значит, что сообщения выберутся с нулевого
    limit: 100 # По умолчанию, 100. Положительное число
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      chat: [MessageSchema]
    }
  }

  # Возможные ошибки
  500 # Server Error
  403 # Нет права на действие
```


### Личные сообщения


##### Отправка личного сообщения

```bash
  [POST] '/user/sendMessage'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    message: {
      user: "52ee29b565e203779f2e37f3",
      text: "Dude!"
    }
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      message: [MessageSchema]
    }
  }

  # Возможные ошибки
  500 # Server Error
  403 # Unauthorized
  400 # Empty `user` || empty `text`
```

Уведомление в сокет:

```bash
  [socket] 'direct-message'
  # Ответ:
  {
    error: null,
    type: "direct-message"
    author: "52efb7baf009c900003731c7" # Кто
    user: "52efb7baf009c900003731c7", # Кому
    text: "Dude!",
    created_at: "2014-02-03T15:37:30.126Z"
  }
```

##### Получение списка личных сообщений

Личные сообщения, в отличии от чатов, сотрируются по дате. По этому запрос с 
`limit: 100` вернет 100 последних(!) сообщений.

```bash
  [POST] '/user/messages'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    limit: 4, # По умолчанию, 100.
    offset: 0 # Не обязательный параметр, отступ. Положительное число
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      messages: [MessageSchema]
    }
  }

  # Возможные ошибки
  500 # Server Error
  400 # Указаны одновременно поля `user` и `author`
  403 # Нет права на действие
```

##### Получение списка диалогов

Этот метод возвращает исключительно диалоги: пользователь, последнее сообщение,
количество непрочитанных сообщений.

```bash
  [POST] '/user/dialogs'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3"
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      dialogs: [{ 
          user: '5319c3af858a35c2a1e889a9',
          last_message: MessageSchema,
          unread: 2
        },
        ...
      ]
    }
  }

  # Возможные ошибки
  500 # Server Error
  403 # Нет права на действие
```


##### Получение диалога с пользователем

Cообщения, в отличии от чатов, сотрируются по дате. По этому запрос с 
`limit: 100` вернет 100 последних(!) сообщений.

```bash
  [POST] '/user/dialog'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    user: "52ee29b565e203779f2e37f3",
    [skip: 1000], # default 0
    [limit: 10000], # default 100
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      dialog: [MessageSchema]
    }
  }

  # Возможные ошибки
  500 # Server Error
  403 # Нет права на действие
```


##### Удаление диалога

Этот метод возвращает исключительно диалоги: пользователь, последнее сообщение,
количество непрочитанных сообщений.

```bash
  [POST] '/user/remove-dialog'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    user: "52ee29b565e203779f2e37f3"
  }
  200 # OK — успешный ответ
  # Ответ:
  {}

  # Возможные ошибки
  500 # Server Error
  400 # Не указан `user`
  403 # Нет права на действие
```


##### Получение количества непрочитанных личных сообщений

Скомбинировав этот пример с примером выше, можно узнать, какие из отправленных
сообщений прочитал пользователь, а какие нет.

```bash
  [POST] '/user/messages'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    countOnly: true,
    limit: 4, # По умолчанию, 100.
    offset: 0 # Не обязательный параметр, отступ. Положительное число
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      messages: [MessageSchema]
    }
  }

  # Возможные ошибки
  500 # Server Error
  400 # Указаны одновременно поля `user` и `author`
  403 # Нет права на действие
```


##### Получение списка личных сообщений от конкретного пользователя

```bash
  [POST] '/user/messages'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    author: "52ee29b565e203779f2e37f3", # От кого
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      messages: [MessageSchema]
    }
  }

  # Возможные ошибки
  500 # Server Error
  400 # Указаны одновременно поля `user` и `author`
  403 # Нет права на действие
```


##### Получение списка отправленных пользователю личных сообщений

```bash
  [POST] '/user/messages'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    user: "52ee29b565e203779f2e37f3", # Кому
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      messages: [MessageSchema]
    }
  }

  # Возможные ошибки
  500 # Server Error
  400 # Указаны одновременно поля `user` и `author`
  403 # Нет права на действие
```


##### Отметить сообщение как прочитанное

```bash
  [POST] '/user/messages/mark-as-read'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    message: "52ee29b565e203779f2e37f3"
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
      message: MessageSchema
    }
  }

  # Возможные ошибки
  500 # Server Error
  400 # Нет поля `message`
  403 # Нет права на действие
  404 # Нет сообщения, удовлетворяющего {_id и user}

```

Уведомление в сокет:

```bash
  [socket] 'read-message'
  # Ответ:
  {
    error: null,
    data: MessageSchema
  }
```


##### Удаление сообщения

```bash
  [POST] '/user/messages/remove'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    message: "52ee29b565e203779f2e37f3"
  }
  200 # OK — успешный ответ
  # Ответ:
  {}

  # Возможные ошибки
  500 # Server Error
  404 # У пользователя нет сообщения с указанным ID
  403 # Нет права на действие
```


### Назначение модератора

```bash
  [POST] '/room/add-moderator'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    user_id: "52ee29b565e203779f2e37f3", # кого
    room_id: "52ee29b565e203779f2e37f3", # где
  }
  201 # OK — успешный ответ
  # Ответ:
  {}

  # Возможные ошибки
  500 # Server Error
  403 # Нет права на действие
```

Уведомление в сокет:

```bash
  [socket] 'service-message'
  # Ответ:
  {
    error: null,
    type: "new moderator"
    room: "52efb7baf009c900003731c7" # Комната
    user: "52efb7baf009c900003731c7" # Кого
    author: "52efb7baf009c900003731c7", # Кто
    created_at: "2014-02-03T15:37:30.126Z"
    ref_message: MessageSchema
  }
```

### Уделение модератора

```bash
  [POST] '/room/remove-moderator'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    user_id: "52ee29b565e203779f2e37f3", # кого
    room_id: "52ee29b565e203779f2e37f3", # где
  }
  200 # OK — успешный ответ
  # Ответ:
  {}

  # Возможные ошибки
  500 # Server Error
  403 # Нет права на действие
```

Уведомление в сокет:

```bash
  [socket] 'service-message'
  # Ответ:
  {
    error: null,
    type: "remove moderator"
    room: "52efb7baf009c900003731c7" # Комната
    user: "52efb7baf009c900003731c7" # Кого
    author: "52efb7baf009c900003731c7", # Кто
    created_at: "2014-02-03T15:37:30.126Z"
    ref_message: MessageSchema
  }
```


### Подарки

В модели пользователя есть массив {gifts: [SendedGiftSchema]}, который
содержит список всех подаренных подарков

#### Получение списка подарков

```bash
  [POST] '/gifts'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
  }
  200 # OK — успешный ответ
  # Ответ:
  {
    data: {
     gifts: [GiftSchema]
    }
  }

  # Возможные ошибки
  500 # Server Error
```

#### Дарение подарка

```bash
  [POST] '/gifts/send'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    gift: "52ee29b565e203779f2e37f3", # id подарка,
    user: "52ee29b565e203779f2e37f3", # кому?
    text: "It's for you <3" # Комментарий к подарку
  }
  200 # OK — успешный ответ
  # Ответ:
  {}

  # Возможные ошибки
  500 # Server Error
  402 # Не хватает денег
```

```bash
  [socket] 'gift-message'
  # Ответ:
  {
    error: null,
    room: "52efb7baf009c900003731c7" # Комната
    user: "52efb7baf009c900003731c7" # Кому
    author: "52efb7baf009c900003731c7", # Кто
    created_at: "2014-02-03T15:37:30.126Z",
  }
```

### Бесплатные монеты

#### Получение монет

```bash
  [POST] '/user/free-coins'
  # Запрос:
  {
    session_key: "52ee29b565e203779f2e37f3",
    type: "mailru" # mailru | vk | facebook | twitter
  }
  200 # OK — успешный ответ
  # Ответ:
  {}

  # Возможные ошибки
  500 # Server Error
  400 # С момента предыдущей публикации прошло меньше 24 часов
```




### Модели

#### User

```bash
var UserSchema = new mongoose.Schema({
  phone: {
    type: Number,
    unique: true,
    required: true
  },
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
  create_at: {
    type: Date,
    default: Date.now
  }
});
```


#### Room

```bash
var RoomSchema = new mongoose.Schema({
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
  silently: {
    user_id: timestamp # Дата окончания тишины, после которой сообщения будут отправлятся.
  },
  chat: [MessageSchema],
  create_at: {
    type: Date,
    default: Date.now
  }
  is_private: boolean # Виртуальное поле
});
```

#### Message

```bash
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
  ref_message: {}, # Нестрогое поле для хранения сообщений
  create_at: {
    type: Date,
    default: Date.now
  },
  user: {
    type: String,
    ref: 'User'
  },
  type: String # Тип системного сообщения
});
```


#### Complaint

```bash
var ComplaintSchema = new mongoose.Schema({
  author: {
    type: String,
    ref: 'User'
  },
  room: {
    type: String,
    ref: 'Room'
  },
  create_at: {
    type: Date,
    default: Date.now
  },
  message: [MessageSchema]
});
```

#### Gift

```bash
var GiftSchema = new mongoose.Schema({
  name: String,
  image: String,
  price: Number,
  create_at: {
    type: Date,
    default: Date.now
  }
});
```

#### SendedGift

```bash
var SendedGiftSchema = new mongoose.Schema({
  name: String,
  image: String,
  text: String,
  price: Number,
  create_at: {
    type: Date,
    default: Date.now
  },
  author: {
    type: String,
    ref: 'User'
  }
});
```




[0]: https://ru.wikipedia.org/wiki/%D0%A1%D0%BF%D0%B8%D1%81%D0%BE%D0%BA_%D0%BA%D0%BE%D0%B4%D0%BE%D0%B2_%D1%81%D0%BE%D1%81%D1%82%D0%BE%D1%8F%D0%BD%D0%B8%D1%8F_HTTP