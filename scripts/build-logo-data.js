/* =============================================================================
   build-logo-data.js — zet PureMinds-zeshoek-logo.png om naar js/logo-data.js
   -----------------------------------------------------------------------------
   Opent iemand index.html direct vanaf schijf (file://), dan markeert Chrome
   een canvas als "besmet" zodra er een lokaal PNG-bestand op getekend wordt,
   en werkt downloaden niet meer. Daarom staat het logo ook als data-URL in
   js/logo-data.js. Via een server (npm start) wordt gewoon de PNG gebruikt.

   Vervang je het logo, draai dan:  npm run logo
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'PureMinds-zeshoek-logo.png');
const target = path.join(root, 'js', 'logo-data.js');

const base64 = fs.readFileSync(source).toString('base64');
const out = `/* Gegenereerd door scripts/build-logo-data.js uit PureMinds-zeshoek-logo.png.
   Niet met de hand wijzigen: vervang de PNG en draai \`npm run logo\`. */
window.PM_LOGO_DATA = 'data:image/png;base64,${base64}';
`;

fs.writeFileSync(target, out);
console.log(`logo-data.js geschreven (${Math.round(out.length / 1024)} KB)`);
