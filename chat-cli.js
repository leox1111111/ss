#!/usr/bin/env node
// chat-cli.js
// Terminalowy klient czatu (Node.js, wymaga Node 18+). Dziala na Windows, macOS i Linux
// bez PowerShell. Wiadomosci innych pojawiaja sie na biezaco, wpisywanie dziala rownolegle.
//
// Uzycie:
//   node chat-cli.js
//   node chat-cli.js --server https://twoja-nazwa.onrender.com --nick Tomek

const readline = require('readline');

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let lastId = 0;
  let interval = null;

  rl.on('line', async (line) => {
    const text = line.trim();
    if (text.toLowerCase() === 'exit') {
      if (interval) clearInterval(interval);
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
    if (interval) clearInterval(interval);
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

  async function poll() {
    try {
      const res = await fetch(`${server}/api/messages?after=${lastId}`);
      const data = await res.json();
      for (const m of data) {
        const time = new Date(m.time).toLocaleTimeString();
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
        console.log(`[${time}] ${m.nick}: ${m.text}`);
        lastId = m.id;
      }
      if (data.length > 0) rl.prompt(true);
    } catch (e) {
      // cichy blad polaczenia - sprobujemy przy kolejnym pollu
    }
  }

  await poll();
  interval = setInterval(poll, 2000);

  rl.setPrompt('> ');
  rl.prompt();
}

main();
