#!/usr/bin/env node
// chat-cli.js
// Terminalowy klient czatu (Node.js, wymaga Node 18+). Dziala na Windows, macOS i Linux
// bez PowerShell. Nowe wiadomosci przychodza przez WebSocket natychmiast (bez odpytywania
// co X sekund); jesli polaczenie WS padnie, przelacza sie na polling zapasowy co 5s.
//
// Uzycie:
//   node chat-cli.js
//   node chat-cli.js --server https://twoja-nazwa.onrender.com --nick Tomek

const readline = require('readline');
const { WebSocket } = require('ws');

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let lastId = 0;
  let fallbackInterval = null;
  let ws = null;
  let closing = false;

  rl.on('line', async (line) => {
    const text = line.trim();
    if (text.toLowerCase() === 'exit') {
      closing = true;
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (ws) try { ws.close(); } catch (e) {}
      rl.close();
      return;
    }
    if (text) {
      try {
        await fetch(`${server}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nick, text })
        });
      } catch (e) {
        console.log('[nie udalo sie wyslac wiadomosci]');
      }
    }
    rl.prompt();
  });

  rl.on('close', () => {
    if (fallbackInterval) clearInterval(fallbackInterval);
    console.log('Rozlaczono.');
    process.exit(0);
  });

  let server = getArg('--server') || 'https://ss-zecl.onrender.com';
  let nick = getArg('--nick') || 'vic00';
  server = server.trim().replace(/\/+$/, '');
  nick = nick.trim() || 'anonim';

  console.log('===================================');
  console.log(`  Polaczono jako ${nick}`);
  console.log("  Pisz wiadomosc i Enter. 'exit' konczy.");
  console.log('===================================');

  function printMessage(m) {
    const time = new Date(m.time).toLocaleTimeString();
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    console.log(`[${time}] ${m.nick}: ${m.text}`);
    lastId = m.id;
    rl.prompt(true);
  }

  async function loadHistory() {
    try {
      const res = await fetch(`${server}/api/messages?after=${lastId}`);
      const data = await res.json();
      for (const m of data) printMessage(m);
    } catch (e) {
      // cichy blad polaczenia
    }
  }

  function connectWs() {
    if (closing) return;
    const url = server.replace(/^http/, 'ws') + '/ws';
    ws = new WebSocket(url);

    ws.on('open', () => {
      if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval = null; }
    });
    ws.on('message', (data) => {
      try {
        const m = JSON.parse(data.toString());
        if (m.id > lastId) printMessage(m);
      } catch (e) {}
    });
    ws.on('close', () => {
      if (closing) return;
      if (!fallbackInterval) fallbackInterval = setInterval(loadHistory, 5000);
      setTimeout(connectWs, 3000);
    });
    ws.on('error', () => { try { ws.close(); } catch (e) {} });
  }

  await loadHistory();
  connectWs();

  rl.setPrompt('> ');
  rl.prompt();
}

main();
