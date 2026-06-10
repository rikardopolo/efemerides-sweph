// POST /api/calc — wrapper HTTP de Swiss Ephemeris en modo Moshier.
//
// Stateless por diseño: sin base de datos, sin logs de datos natales, sin PII.
// Devuelve únicamente hechos astronómicos crudos (posiciones eclípticas, velocidad,
// declinación, cúspides y ángulos). Toda interpretación vive fuera de este servicio.
//
// Los números en modo Moshier (SEFLG_MOSEPH | SEFLG_SPEED) son deterministas y, para
// una misma versión de `sweph`, bit-idénticos a un cálculo nativo con esos flags.
import sweph from 'sweph';

const C = sweph.constants;
const FLAG = C.SEFLG_MOSEPH | C.SEFLG_SPEED;     // eclíptica + velocidad (idéntico al caller)
const FLAG_EQ = FLAG | C.SEFLG_EQUATORIAL;       // ecuatorial → declinación en data[1]

// Cuerpos por defecto: 7 clásicos + 3 transpersonales + Nodo medio (ids SE_* de sweph:
// 0=Sol 1=Luna 2=Mercurio 3=Venus 4=Marte 5=Júpiter 6=Saturno 7=Urano 8=Neptuno
// 9=Plutón 10=Nodo medio). El cliente envía sus ids; este default es para uso directo.
const DEFAULT_BODIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const HOUSE_SYSTEMS = new Set(['P', 'W', 'K', 'R', 'C', 'O', 'E']);

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function validate(b) {
  if (!b || typeof b !== 'object') return 'el cuerpo debe ser un objeto JSON';
  if (!isInt(b.year, -3000, 3000)) return 'year fuera de rango';
  if (!isInt(b.month, 1, 12)) return 'month debe ser un entero 1..12';
  if (!isInt(b.day, 1, 31)) return 'day debe ser un entero 1..31';
  if (typeof b.hourUT !== 'number' || !(b.hourUT >= 0) || b.hourUT >= 24) return 'hourUT debe estar en [0, 24)';
  if (typeof b.lat !== 'number' || b.lat < -90 || b.lat > 90) return 'lat debe estar en [-90, 90]';
  if (typeof b.lon !== 'number' || b.lon < -180 || b.lon > 180) return 'lon debe estar en [-180, 180]';
  if (b.houseSystem !== undefined && !HOUSE_SYSTEMS.has(b.houseSystem)) return 'houseSystem inválido';
  if (b.bodies !== undefined) {
    if (!Array.isArray(b.bodies) || b.bodies.length === 0 || b.bodies.length > 64) return 'bodies debe ser un array no vacío (máx 64)';
    if (!b.bodies.every((x) => isInt(x, 0, 20))) return 'bodies debe contener ids de cuerpo válidos (0..20)';
  }
  return null;
}

// Body robusto: Vercel Node suele parsear JSON en req.body; cubrimos string y stream.
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  if (!chunks.length) return null;
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no soportado. Usar POST.' });
    return;
  }

  // AUTH: la AGPL obliga a publicar el código, no a regalar cómputo.
  const expected = process.env.EPHEMERIS_API_KEY;
  if (!expected || req.headers['x-api-key'] !== expected) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const body = await readBody(req);
  const err = validate(body);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }

  const hsys = body.houseSystem ?? 'P';
  const bodies = body.bodies ?? DEFAULT_BODIES;

  try {
    const jd = sweph.julday(body.year, body.month, body.day, body.hourUT, C.SE_GREG_CAL);

    const h = sweph.houses(jd, body.lat, body.lon, hsys);
    if (h.error) throw new Error(`houses: ${h.error}`);
    const cusps = h.data.houses;   // 12 cúspides
    const pts = h.data.points;     // [asc, mc, armc, vertex, ...]

    const planets = bodies.map((id) => {
      // Llamada eclíptica: misma firma y flags que el caller → data[0..3] idénticos.
      const r = sweph.calc_ut(jd, id, FLAG);
      if (r.error && (!r.data || !r.data.length)) throw new Error(`calc_ut(${id}): ${r.error}`);
      // Llamada ecuatorial: independiente, solo para exponer la declinación (Capa 4 futura).
      const eq = sweph.calc_ut(jd, id, FLAG_EQ);
      const declination = (eq.error && (!eq.data || eq.data.length < 2)) ? null : eq.data[1];
      return {
        id,
        longitude: r.data[0],
        latitude: r.data[1],
        distance: r.data[2],
        speed: r.data[3],
        declination,
      };
    });

    res.status(200).json({
      jdUt: jd,
      ephemeris: 'moshier',
      engine: `swiss-ephemeris ${sweph.version ? sweph.version() : ''}`.trim(),
      houseSystem: hsys,
      planets,
      houses: cusps,
      angles: { asc: pts[0], mc: pts[1], armc: pts[2], vertex: pts[3] },
    });
  } catch {
    // No registrar datos natales ni el detalle: solo un error genérico.
    res.status(500).json({ error: 'Error de cálculo de efemérides' });
  }
}
