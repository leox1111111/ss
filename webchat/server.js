// server.js
// Prosty serwer czatu: REST API + hosting statycznej strony.
// Wiadomości trzymane w pamięci i zapisywane do pliku messages.json (persystencja po restarcie).

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'messages.json');
const WALLPAPER_FILE = path.join(__dirname, 'wallpaper.json');
const FAKELOCK_FILE = path.join(__dirname, 'fakelock.json');
const MAX_MESSAGES = 500; // limit historii trzymanej w pamięci/pliku
const SHUTDOWN_KEY = process.env.SHUTDOWN_KEY || 'zmien-to-haslo'; // klucz do awaryjnego wyłączenia

app.use(express.json());
app.use((req, res, next) => {
  // CORS: pozwala front-endowi hostowanemu na innym originie (np. GitHub Pages)
  // rozmawiac z tym backendem. Jesli chcesz zawezic, zamien '*' na konkretny
  // adres, np. 'https://twoj-login.github.io'.
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Wczytanie historii przy starcie
let messages = [];
let nextId = 1;
try {
  if (fs.existsSync(DATA_FILE)) {
    messages = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (messages.length > 0) {
      nextId = messages[messages.length - 1].id + 1;
    }
  }
} catch (e) {
  console.error('Nie udało się wczytać messages.json:', e.message);
}

function persist() {
  fs.writeFile(DATA_FILE, JSON.stringify(messages.slice(-MAX_MESSAGES)), (err) => {
    if (err) console.error('Błąd zapisu messages.json:', err.message);
  });
}

// Bardzo prosta walidacja/oczyszczanie tekstu
function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

// Tapeta (wspólna dla wszystkich, trzymana w wallpaper.json)
let wallpaper = { type: 'color', value: '#f4f4f4' };
try {
  if (fs.existsSync(WALLPAPER_FILE)) {
    wallpaper = JSON.parse(fs.readFileSync(WALLPAPER_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Nie udało się wczytać wallpaper.json:', e.message);
}

function persistWallpaper() {
  fs.writeFile(WALLPAPER_FILE, JSON.stringify(wallpaper), (err) => {
    if (err) console.error('Błąd zapisu wallpaper.json:', err.message);
  });
}

// GET /api/wallpaper -> aktualna tapeta
app.get('/api/wallpaper', (req, res) => {
  res.json(wallpaper);
});

// POST /api/wallpaper  { type: 'color'|'image', value }
app.post('/api/wallpaper', (req, res) => {
  const type = req.body.type === 'image' ? 'image' : 'color';
  const value = sanitize(req.body.value, 500);

  if (!value) {
    return res.status(400).json({ error: 'Brak wartości tapety.' });
  }
  if (type === 'color' && !/^#[0-9a-fA-F]{3,8}$/.test(value)) {
    return res.status(400).json({ error: 'Kolor musi być w formacie hex, np. #ff00aa.' });
  }
  if (type === 'image' && !/^https?:\/\//i.test(value)) {
    return res.status(400).json({ error: 'Adres obrazka musi zaczynać się od http(s)://' });
  }

  wallpaper = { type, value };
  persistWallpaper();
  res.status(200).json(wallpaper);
});

// Fakelock (prank) — nakładka udająca zablokowany ekran, wspólna dla wszystkich
let fakelock = { active: false, text: 'Ekran zablokowany' };
try {
  if (fs.existsSync(FAKELOCK_FILE)) {
    fakelock = JSON.parse(fs.readFileSync(FAKELOCK_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Nie udało się wczytać fakelock.json:', e.message);
}

function persistFakelock() {
  fs.writeFile(FAKELOCK_FILE, JSON.stringify(fakelock), (err) => {
    if (err) console.error('Błąd zapisu fakelock.json:', err.message);
  });
}

// GET /api/fakelock -> aktualny stan
app.get('/api/fakelock', (req, res) => {
  res.json(fakelock);
});

// POST /api/fakelock  { active, text? }
app.post('/api/fakelock', (req, res) => {
  const active = !!req.body.active;
  const text = sanitize(req.body.text, 100) || 'Ekran zablokowany';

  fakelock = { active, text };
  persistFakelock();
  res.status(200).json(fakelock);
});

// GET /api/messages?after=ID  -> zwraca wiadomości nowsze niż ID
app.get('/api/messages', (req, res) => {
  const after = parseInt(req.query.after, 10) || 0;
  const result = messages.filter(m => m.id > after);
  res.json(result);
});

// POST /api/messages  { nick, text }
app.post('/api/messages', (req, res) => {
  const nick = sanitize(req.body.nick, 30) || 'anonim';
  const text = sanitize(req.body.text, 500);

  if (!text) {
    return res.status(400).json({ error: 'Puste wiadomości nie są zapisywane.' });
  }

  const msg = {
    id: nextId++,
    nick,
    text,
    time: new Date().toISOString()
  };

  messages.push(msg);
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(-MAX_MESSAGES);
  }
  persist();

  res.status(201).json(msg);
});

// POST /api/shutdown  { key }
// Awaryjne wyłączenie procesu serwera. Wymaga klucza (env SHUTDOWN_KEY).
app.post('/api/shutdown', (req, res) => {
  const key = sanitize(req.body.key, 200);

  if (key !== SHUTDOWN_KEY) {
    return res.status(403).json({ error: 'Zły klucz.' });
  }

  res.status(200).json({ ok: true, message: 'Serwer wyłącza się.' });
  console.log('Awaryjny shutdown wywołany przez API.');
  setTimeout(() => process.exit(0), 200); // krótkie opóźnienie, żeby odpowiedź zdążyła dojść
});

app.listen(PORT, () => {
  console.log(`Serwer czatu działa na porcie ${PORT}`);
});
