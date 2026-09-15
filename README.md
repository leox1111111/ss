# Prosty czat: strona WWW + klient .bat

## Co jest w środku
- `server.js`, `package.json` — serwer (Node.js/Express), API czatu + hosting strony
- `public/index.html` — strona WWW z czatem (dla przeglądarki)
- `chat.bat`, `poll.ps1`, `send.ps1` — klient terminalowy Windows (nick + pisanie w konsoli)

## 1. Wdrożenie serwera w internecie (Render.com, darmowy plan)

1. Załóż konto na render.com.
2. Wrzuć folder `webchat` (bez `node_modules`) do repozytorium na GitHub.
3. W Render: New -> Web Service -> wskaż to repo.
4. Ustawienia:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Po wdrożeniu Render poda adres publiczny, np. `https://twoja-nazwa.onrender.com`.
6. Otwórz ten adres w przeglądarce — powinna pojawić się strona czatu.

Uwaga: darmowy plan Render usypia serwer po bezczynności — pierwsze zapytanie po przerwie może potrwać kilkanaście sekund.

Alternatywy: Railway.app, Fly.io, Cyclic — proces wdrożenia analogiczny (Node.js + `npm start`).

## 2. Test lokalny (przed wdrożeniem)

```
cd webchat
npm install
npm start
```

Otwórz `http://localhost:3000` w przeglądarce.

## Hosting strony na GitHub Pages (opcjonalnie, osobno od backendu)

GitHub Pages serwuje tylko pliki statyczne — nie uruchomi `server.js`. Backend (czat, shutdown, tapeta, fakelock) musi nadal działać na Render (punkt 1), a GitHub Pages może hostować tylko sam front-end (`public/index.html`) pod innym adresem.

1. Wrzuć całe repo (albo samą zawartość `public/`) do repozytorium na GitHub.
2. Włącz GitHub Pages w ustawieniach repo (Settings → Pages), wskazując folder z `index.html` (np. `/public` albo `/docs`, jeśli tak nazwiesz folder).
3. Przy pierwszym wejściu na stronę `*.github.io` `index.html` sam zapyta o adres backendu (Render) i zapamięta go w przeglądarce (localStorage) — nie trzeba nic ręcznie edytować w kodzie.
4. Backend ma teraz włączony CORS (`Access-Control-Allow-Origin: *`), więc przyjmie żądania z innego originu, jakim jest `github.io`.

Jeśli wolisz, żeby strona i backend były na tym samym adresie (prościej, bez pytania o URL), zostaw wszystko tak jak w punkcie 1 — `server.js` już serwuje `index.html` pod `/`.

## 3. Klient terminalowy (Node.js, zalecany) — chat-cli.js

Cross-platformowy klient działający bezpośrednio w terminalu (Windows/macOS/Linux), bez PowerShell. Wymaga Node.js 18+.

Domyślnie łączy się z `https://ss-zecl.onrender.com` jako `vic00`:
```
node chat-cli.js
```
albo z innymi parametrami:
```
node chat-cli.js --server https://inny-adres.onrender.com --nick InnyNick
```

Wiadomości innych osób pojawiają się na bieżąco (odpytywanie co 2s), a pisanie działa równolegle — nie trzeba czekać na swoją kolej jak w `chat.bat` poniżej. `exit` + Enter kończy połączenie.

## 4. Klient .bat (Windows, alternatywa)

1. Skopiuj `chat.bat`, `poll.ps1`, `send.ps1` do jednego folderu na komputerze z Windows.
2. Uruchom `chat.bat`.
3. Naciśnij Enter, żeby zostawić domyślny adres (`https://ss-zecl.onrender.com`) i nick (`vic00`), albo wpisz swoje.
4. Pisz wiadomości — każda wysyłka jednocześnie pokazuje nowe wiadomości od innych.

## Ograniczenie klienta .bat

Czysty `.bat` nie potrafi jednocześnie nasłuchiwać nowych wiadomości i czekać na wpisywany tekst (brak wątków). Klient `chat.bat` odświeża wiadomości tuż przed każdym pytaniem o Twój wpis — to nie jest push w czasie rzeczywistym, tylko odświeżanie "na żądanie".

## Awaryjny shutdown + automatyczny restart

Na stronie jest przycisk "Awaryjny shutdown" (prawy dolny róg), który wywołuje `POST /api/shutdown` z kluczem i zamyka proces serwera (`process.exit`).

- Klucz ustawiany zmienną środowiskową `SHUTDOWN_KEY` (w Render: Environment -> dodaj zmienną). Bez ustawienia obowiązuje domyślny klucz `zmien-to-haslo` — zmień go przed wdrożeniem publicznym.
- Serwer jest uruchamiany przez `pm2-runtime` (`npm start` -> `pm2-runtime start ecosystem.config.js`). Gdy proces padnie (awaryjny shutdown, wyjątek, crash), PM2 sam odpala go ponownie po 3s (`restart_delay` w `ecosystem.config.js`), bez ręcznej interwencji w panelu Render.
- Limit `max_restarts: 50` — zabezpieczenie przed nieskończoną pętlą restartów przy realnej, trwałej awarii (np. zły port, brak zależności).
- Historia wiadomości (`messages.json`) zostaje na dysku (o ile Render nie czyści filesystemu przy restarcie kontenera — do zweryfikowania na koncie) i wczyta się po restarcie.

## Wiadomości na żywo (WebSocket)

Serwer wystawia WebSocket pod `/ws`. Gdy ktoś wyśle wiadomość (przez stronę WWW, `chat-cli.js` albo `curl`/API bezpośrednio), trafia natychmiast do wszystkich podłączonych klientów — bez czekania na kolejne odpytanie.

- Strona WWW i `chat-cli.js` łączą się z `/ws` automatycznie po starcie.
- Jeśli połączenie WS padnie (np. serwer na Render usnął), oba klienty przełączają się chwilowo na polling zapasowy (strona co 5s, `chat-cli.js` co 5s) i próbują połączyć WS ponownie co 3s.
- `chat.bat`/`poll.ps1`/`send.ps1` (Windows) nadal działają na czystym REST (odpytywanie przy każdej turze) — to nie zmienione, bo implementacja WebSocket w czystym `.bat`/PowerShell 5.1 jest dużo bardziej złożona; jeśli zależy Ci na natychmiastowym pushu na Windows, użyj `chat-cli.js` (wymaga Node.js).

## Wersja z prawdziwym push: chat_realtime.ps1

`chat_realtime.ps1` to osobny klient w czystym PowerShell. Działa na osobnym wątku (runspace) odpytującym serwer co 2s w tle, więc nowe wiadomości od innych pojawiają się same, bez wciskania Enter — a pisanie tekstu działa równolegle.

Uruchomienie:
```
powershell -ExecutionPolicy Bypass -File chat_realtime.ps1
```
Skrypt zapyta o adres serwera i nick (albo podaj od razu: `-Server https://... -Nick Tomek`).

Obsługa: pisz normalnie, Enter wysyła, `exit` + Enter kończy.
