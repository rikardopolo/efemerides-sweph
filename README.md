# efemerides-sweph

Wrapper HTTP _stateless_ de [Swiss Ephemeris](https://www.astro.com/swisseph/) en
**modo Moshier**. Un solo endpoint —`POST /api/calc`— que devuelve hechos
astronómicos crudos (posiciones eclípticas, velocidad, declinación, cúspides de
casas y ángulos). Sin interpretación, sin base de datos, sin almacenamiento de
datos de nacimiento.

Construido para **[tejidosderealidad.com](https://tejidosderealidad.com)** como
servicio de efemérides aislado. Este repositorio existe para cumplir la AGPL-3.0 de
`sweph`: el cómputo de efemérides queda separado, abierto y verificable.

## Licencia

**AGPL-3.0-only.** `sweph` (Swiss Ephemeris) es AGPL; este servicio hereda esa
licencia. El código fuente completo está aquí; desplegarlo como servicio en red
obliga a ofrecer ese fuente a sus usuarios (AGPL §13). Ver [`LICENSE`](./LICENSE).

## API

### `POST /api/calc`

Cabecera obligatoria: `x-api-key: <EPHEMERIS_API_KEY>`. Sin key válida → `401`.

**Request**

```json
{
  "year": 1990, "month": 1, "day": 15,
  "hourUT": 19.5,
  "lat": 3.4516, "lon": -76.5320,
  "houseSystem": "P",
  "bodies": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
}
```

- `hourUT` — hora decimal en **UT** (la zona horaria la resuelve el cliente).
- `lat` `+N/-S`, `lon` `+E/-W`.
- `houseSystem` — uno de `P W K R C O E` (Placidus por defecto).
- `bodies` — opcional. Array de ids de cuerpo de Swiss Ephemeris (`SE_*`):
  `0=Sol 1=Luna 2=Mercurio 3=Venus 4=Marte 5=Júpiter 6=Saturno 7=Urano
  8=Neptuno 9=Plutón 10=Nodo medio`. Por defecto, esos 11.

**Response `200`**

```json
{
  "jdUt": 2447907.3125,
  "ephemeris": "moshier",
  "engine": "swiss-ephemeris 2.10.03",
  "houseSystem": "P",
  "planets": [
    { "id": 0, "longitude": 295.3, "latitude": 0.0, "distance": 0.98,
      "speed": 1.01, "declination": -21.2 }
  ],
  "houses": [/* 12 cúspides, grados eclípticos */],
  "angles": { "asc": 0, "mc": 0, "armc": 0, "vertex": 0 }
}
```

Cada cuerpo: `longitude`, `latitude` (eclípticas), `distance` (UA), `speed`
(°/día; `<0` = retrógrado) y `declination` (ecuatorial). Los ángulos y cúspides van
en grados eclípticos crudos; derivar signo/casa es responsabilidad del cliente.

Errores: `400` (input inválido), `401` (sin key), `405` (no-POST), `500` (cálculo).

## Despliegue (Vercel)

```bash
vercel deploy --prod
vercel env add EPHEMERIS_API_KEY production   # define la clave de acceso
```

Runtime Node 20.x (función serverless). `sweph` es un addon nativo: Vercel compila
el prebuilt `linux-x64` en el build. Estado: ninguno (cada request es independiente).

## Desarrollo local

```bash
npm install
EPHEMERIS_API_KEY=dev npm run smoke   # cálculo de la carta-fixture, imprime el JSON
```
