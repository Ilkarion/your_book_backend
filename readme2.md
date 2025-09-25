# JWT + Cookies + Refresh (Конспект)

## Общая схема работы с регистрацией, логином и токенами
** Когда юзер входит на сайт всегда проверяю токеныи если он уже был зареганый и не вылогинивался то /api/me и если есть токен то запрос вернет данные пользователя а если нету токена тогда сделает рефреш токена.

1. **Регистрация**
   - Пользователь вводит email и пароль.
   - Сервер хеширует пароль и сохраняет пользователя в базе.
   - Создаётся confirmToken для подтверждения email(nodemailer).
   - Отправляется письмо с подтверждением через SMTP. Протокол отправки писем (Simple Mail Transfer Protocol).

2. **Подтверждение email**
   - Пользователь кликает на ссылку с токеном.
   - Сервер проверяет токен и помечает email как подтверждённый.

3. **Логин**
   - Пользователь вводит email и пароль.
   - Сервер проверяет хеш пароля в базе и подтверждение email.
   - Генерируются токены:
     - **Access Token** – короткоживущий, для авторизации запросов.
     - **Refresh Token** – долгоживущий, для обновления access.
   - Токены отправляются в **httpOnly cookies** | **httpOnly** – нельзя прочитать из JS, только сервером.

4. **Использование токенов**
   - /api/me - тоесть когда user залогинился и закрыл сайт не вылогинившись то при следующем входе мы не требуем  пользователя снова залогинится потому что в куках уже есть его токен поэтому иы сами подгружаем его данные with help этого запроса
   - `/api/me` – проверка текущего пользователя по access token.
   - Каждый запрос к защищённым данным проверяет access token.
   - Если access истёк → вызывается `/api/refresh`, чтобы получить новый access без участия пользователя.

5. **Silent Refresh (фоновые обновления)**
   - После логина или загрузки страницы фронт ставит таймер на обновление access перед истечением.
   - Если вкладка спит(браузер может остановить таймер) и таймер не сработал → используется перехватчик запросов на 401.

6. **Interceptor / fetch wrapper**
   - Если запрос возвращает 401 → вызываем `/api/refresh` → повторяем запрос.
   - Гарантирует, что пользователь никогда не потеряет сессию и не делает лишних действий.

7. **Logout**
   - Сервер удаляет cookies access и refresh.
   - Пользователь разлогинен, нужно снова логиниться.

## Полезные моменты

- `sameSite: "Strict"` – куки доступны только с твоего сайта.  
- `secure` – true только в продакшене (HTTPS).  
- `maxAge` – время жизни куки (access 15 мин, refresh 7 дней).  
- `RequestInit` – интерфейс параметров fetch (метод, headers, тело, куки и т.д.).

##Пример Silent Refresh in Frontend:

```javascript

import jwtDecode from "jwt-decode";

function startTokenRefreshTimer(accessToken: string) {
  const payload = jwtDecode<{ exp: number }>(accessToken); // exp = unix time (sec)
  const expiresInMs = payload.exp * 1000 - Date.now();
  const refreshBeforeMs = expiresInMs - 120 * 1000; // за 2 мин до конца

  if (refreshBeforeMs > 0) {
    setTimeout(async () => {
      await fetch("/api/refresh", { method: "POST", credentials: "include" });
      // получаем новый access cookie (сервер сам выставит)
      // Можно снова вызвать /api/me чтобы обновить данные
    }, refreshBeforeMs);
  }
}

```
---
```javascript
//Frontend usage of api/ping request
"use client";
import { useEffect, useRef } from "react";

export default function PingProvider({ children }: { children: React.ReactNode }) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const doPing = () => {
    fetch("https://your-backend.onrender.com/api/ping").catch(() => {});
    // сброс таймера
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(doPing, 10 * 60 * 1000);
  };

  useEffect(() => {
    // первый ping сразу
    doPing();

    // ping только если вкладка активна
    const handleVisibility = () => {
      if (!document.hidden) doPing();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // перехват fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const res = await originalFetch(...args);
        doPing(); // сброс таймера при любом запросе
        return res;
      } catch (err) {
        doPing();
        throw err;
      }
    };

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.fetch = originalFetch; // восстанавливаем fetch при размонтировании
    };
  }, []);

  return <>{children}</>;
}

---

import PingProvider from "./components/PingProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PingProvider>{children}</PingProvider>
      </body>
    </html>
  );
}
```

## Explanation of frontend api/ping request:

# useRef()

   useRef — это специальный React-хук, который создаёт объект, который сохраняется между рендерами компонента.

Синтаксис:

const intervalRef = useRef<NodeJS.Timeout | null>(null);

Возвращает объект:

{
  current: null
}

То есть у любого объекта, созданного через useRef(), есть свойство .current, которое можно менять.

В нашем случае мы используем .current, чтобы хранить идентификатор таймера, чтобы потом его очищать.
* ref — это как коробочка на полке, куда ты кладёшь что-то и достаёшь потом. React её не трогает, она всегда на месте.

# clearInterval()
Не «пауза», а удаляется, т.е. больше не будет вызывать функцию.


## use client / use server
Если родительский компонент помечен "use client", а вложенный компонент (child) помечен "use server" → вложенный компонент всё равно будет серверным.

React/Next.js позволяет так делать: клиентский компонент может рендерить серверный компонент внутри.

Но обратного не работает: серверный компонент не может напрямую рендерить клиентский без обёртки "use client".