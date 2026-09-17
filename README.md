# Pure Minds Post Maker

Interne tool om Instagram- en LinkedIn-posts te maken in de huisstijl van Pure
Minds. Je kiest een template, vult tekst en foto in, en downloadt de post
direct als PNG of JPG. Het is plain HTML, CSS en JavaScript: geen buildstap en
geen externe libraries. De posts worden getekend op een HTML5 Canvas.

## Starten

```bash
npm start            # http://localhost:3000
```

Je kunt `index.html` ook direct openen. Het logo zit dan als ingebedde kopie in
`js/logo-data.js`, zodat downloaden blijft werken.

## De vijf templates

| Template | Waarvoor | Zeshoek |
|---|---|---|
| **Standaard foto** | Een strakke fotopost | Foto op volledig beeld, of de foto *in* een grote zeshoek |
| **Foto met tekst** | Iets aankondigen | Cyaan lijn-zeshoek rechtsboven, patroon in het verloop |
| **Pure blog post** | Een nieuwe blog, met cta-zin en magenta knop | Foto in een zeshoek rechtsboven |
| **Pure case post** | "Voor {klant} hebben wij {diensten} gedaan" + resultaat | Klantlogo in een witte zeshoek |
| **Info carousel** | Diepgaande info over meerdere slides | Slidenummer in zeshoek, zeshoek-voortgang, halve zeshoek als swipe-pijl |

Carousel: elke slide heeft een schakelaar **Laatste slide**. Die verbergt de
swipe-indicator (voortgang, "swipe →" en de pijl aan de rechterrand). De tool
waarschuwt als de laatste slide die schakelaar nog niet aan heeft.

## Vaste ontwerpregels

Deze regels gelden voor alle templates en staan in `GRID` in `js/templates.js`:

- ontwerpraster van 1080 px breed, 88 px marge rondom
- cyaan balk van 12 px bovenaan (zoals op elk artboard in het brandbook)
- label linksboven: cyaan zeshoekje + Open Sans Bold in hoofdletters
- alle posts zijn donker: inkt (#303030) of een foto met een donker verloop
- **logo rechtsonder**, in elk template op exact dezelfde plek, wit en zonder
  vlak erachter
- voetregel links op de hoogte van het logo: `pureminds.nl` of de swipe-indicator
- koppen in Open Sans ExtraBold (-2% tracking), met de cyaan punt uit "Pure Minds."
- nadruk met `**woord**` in cyaan
- magenta alleen voor de hoofdactie (de blogknop)

Kleuren en typografie komen uit `PureMinds-Brandbook-v1.svg`. De interface
gebruikt hetzelfde designsysteem als `SEO-contentGap-Analyzer` en
`Landingpage-AdsOptimizer`.

## Export

| Formaat | 1080 px (Instagram) | 1200 px (LinkedIn) | 2160 px |
|---|---|---|---|
| 1:1 | 1080 × 1080 | 1200 × 1200 | 2160 × 2160 |
| 4:5 | 1080 × 1350 | 1200 × 1500 | 2160 × 2700 |
| 9:16 (story) | 1080 × 1920 | 1200 × 2133 | 2160 × 3840 |

In het storyformaat liggen label en logo 250 px van de boven- en onderrand,
buiten de balken van de Instagram-interface. Standaard is 1:1.

**download alle slides** downloadt elke carousel-slide als een los bestand,
met het slidenummer in de bestandsnaam. `Ctrl`+`S` downloadt direct.
**kopieer** zet de post als PNG op het klembord.

## Structuur

```
index.html                   interface
css/styles.css               interface-stijl (Pure Minds designsysteem)
js/templates.js              raster, zeshoek-helpers, tekstopmaak en de 5 templates
js/app.js                    toestand, velden, foto-upload, slides, export
js/logo-data.js              ingebed logo (gegenereerd: npm run logo)
assets/brand/                Open Sans, kleurlogo voor de header, favicon
PureMinds-zeshoek-logo.png   het logo op de posts
PureMinds-zeshoek-logo*.svg  het logo als vector (wit, zwart)
PureMinds-Brandbook-v1.svg   brandbook met kleuren, typografie en vormtaal
server/server.js             kleine statische server (npm start)
render.yaml                  Render Blueprint voor hosting
```

Vervang je `PureMinds-zeshoek-logo.png`, draai dan `npm run logo`.

Teksten en instellingen worden in `localStorage` onthouden. Foto's niet, omdat
ze daar te groot voor zijn.
