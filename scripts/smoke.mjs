// Smoke local del handler /api/calc (sin Vercel). Calcula la carta-fixture y
// imprime el JSON. Uso: EPHEMERIS_API_KEY=dev node scripts/smoke.mjs
import handler from '../api/calc.js';

const fixture = {
  year: 1990, month: 1, day: 15, hourUT: 19.5,
  lat: 3.4516, lon: -76.5320, houseSystem: 'P',
  bodies: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

const key = process.env.EPHEMERIS_API_KEY ?? 'dev';
const req = { method: 'POST', headers: { 'x-api-key': key }, body: fixture };

let statusCode = 0;
const res = {
  status(c) { statusCode = c; return this; },
  json(obj) {
    console.log('HTTP', statusCode);
    console.log(JSON.stringify(obj, null, 2));
    if (statusCode !== 200) process.exitCode = 1;
  },
};

await handler(req, res);
