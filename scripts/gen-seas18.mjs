// Genera api/seas18-data.js (base64 embebido) desde ephe/seas_18.se1.
// El .se1 se embebe en el bundle como módulo JS (nft siempre incluye los imports) para
// garantizar que viaja al lambda de Vercel; includeFiles no copiaba el binario a la función.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'lib'), { recursive: true }); // lib/ (NO api/: api/*.js sería otra función Vercel)
const b64 = readFileSync(join(root, 'ephe', 'seas_18.se1')).toString('base64');
const header = `// AUTO-GENERADO por scripts/gen-seas18.mjs — NO editar a mano.
// seas_18.se1 (Swiss Ephemeris · asteroides 1800-2400 d.C., incluye Quirón #2060) embebido en
// base64 para garantizar que viaja en el bundle del lambda de Vercel (includeFiles no copiaba el
// binario a la función). En cold start se materializa en os.tmpdir() y se apunta el ephe path ahí.
// Fuente: Astrodienst (github.com/aloistr/swisseph/raw/master/ephe/seas_18.se1), uso libre.
// Regenerar: node scripts/gen-seas18.mjs
`;
writeFileSync(join(root, 'lib', 'seas18-data.js'), `${header}export const SEAS18_B64 = '${b64}';\n`);
console.log('lib/seas18-data.js generado ·', b64.length, 'chars base64 (de', readFileSync(join(root, 'ephe', 'seas_18.se1')).length, 'bytes)');
