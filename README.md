# On Air Atlas

Mapa de lugares imposibles. Tocás cualquier punto del mapa y la app te imagina la session de On Air ahí: concepto, artista, quién decide, los números con los rubros de la hoja de producción, el mail de apertura en la voz de Felipe y los prompts del teaser.

## Qué hace

- **Mapa oscuro con los pines** de las sessions hechas (Boeing 737, Capuchinos, cultivo en La Rioja, ECU Rosario, Las Palapas), las que están en conversación y las imaginadas. Los pines a ojo se ven punteados: se arrastran para corregirlos.
- **Tocar el mapa crea un lugar.** Busca el nombre y la ciudad solo (Nominatim), vos elegís si es público o privado.
- **Los números.** Calculadora con los rubros reales de una session de 600 a 1.000 personas y quién cubre cada uno según los toggles: tercero paga el internacional, técnica en canje, lugar por Forum o por la barra, barra propia. Devuelve bruto, neto tras ticketing y derechos, lo que pagan los tickets, lo que pone OAM y el veredicto: cierra, sale justo o no cierra. Más los cuatro escenarios de la hoja.
- **Imaginar acá.** Gemini toma el lugar y los números y devuelve título, título del video, por qué el lugar, tensión, formato, plano de apertura, artista por tier, track del lugar, quién decide, cómo se pide, riesgos, el mail de apertura y los dos prompts del teaser (placa y video) con el método anti look IA.
- **Test de las seis.** Dueño, artefacto, fecha, a quién llega, qué cambia, qué queda. Hasta que no está 6/6 no está lista para mandar.
- **Copiar ficha / bajar .md.** Todo en un markdown listo para pegar en la carpeta del plan.

Todo queda en localStorage del navegador. Nada sale de ahí salvo lo que se manda a Gemini para imaginar y la consulta de nombre a Nominatim al tocar el mapa.

## Stack

- Next.js 16 + TypeScript + Tailwind
- Leaflet con tiles oscuros de CARTO
- Gemini via API route server-side (`/api/imaginar`), la key nunca llega al cliente
- Sin backend, sin cuenta

## Correr

```bash
cp .env.local.example .env.local
# poner GEMINI_API_KEY (gratis en https://aistudio.google.com/app/apikey)
npm install
npm run dev
```

## Deploy en Vercel

Importar el repo, agregar `GEMINI_API_KEY` en Environment Variables, deploy. Cada push re-deploya.

## Estructura

```
app/
  page.tsx                  ← mapa + panel (lista, nuevo lugar, ficha)
  api/imaginar/route.ts     ← Gemini: concepto, mail en tu voz, prompts
components/
  Mapa.tsx                  ← Leaflet, pines por estado, arrastrar para corregir
  Presupuesto.tsx           ← rubros, toggles, veredicto, escenarios
  Ficha.tsx                 ← todo lo de un lugar
lib/
  presupuesto.ts            ← la hoja de producción en código
  voz.ts                    ← reglas de voz que se le inyectan a Gemini
  lugares.ts                ← sessions hechas y defaults
  markdown.ts               ← export de la ficha
```

## Próximo

- [ ] Sumar Chatmu para audiencia por país del artista sugerido
- [ ] Sync a Drive (carpeta OAM 2027) en vez de copiar a mano
- [ ] Foto real del lugar como referencia para la placa
- [ ] Ventanas de fondos con fecha de cierre sobre el mapa (Ibermúsicas, mecenazgos, entes)
