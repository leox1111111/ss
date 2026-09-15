// ecosystem.config.js
// Konfiguracja PM2: po awaryjnym shutdownie (process.exit w server.js)
// proces wstaje sam po restart_delay, bez interwencji w panelu Render.
module.exports = {
  apps: [
    {
      name: 'webchat',
      script: './server.js',
      autorestart: true,
      restart_delay: 3000,   // 3s przerwy przed ponownym startem
      max_restarts: 50,      // limit w krótkim czasie, żeby nie zapętlić się w nieskończoność przy realnej awarii
      min_uptime: '5s'       // uznaje restart za "udany" dopiero po 5s działania
    }
  ]
};
