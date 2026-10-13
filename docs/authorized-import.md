# Publicare automată — numai județul Călărași

## Scop și starea inițială
Backendul poate **primi de la parteneri autorizați**, valida și publica maximum **2 oferte reale/zi calendaristică** (Europe/Bucharest). Nu generează proprietăți fictive și NU extrage anunțuri de pe OLX/Storia sau alte platforme fără permisiune.

**Fail closed:** implicit \`AUTOPUBLISH_ENABLED\` este dezactivat. Fără o sursă autorizată, cheia de acces și oferte reale, nimic nu se publică. Nu schimbă regulile conturilor gratuite, plățile Stripe sau anunțurile utilizatorilor.

## Configurare în Render → Environment (backend)
- \`AUTHORIZED_IMPORT_SOURCES_JSON\`: JSON cu ID-ul și cheia secretă de minimum 32 de caractere pentru **fiecare partener care ne-a dat acordul**, ex. \`{"agentie_exemplu":"inlocuieste-cu-o-cheie-aleatorie-de-minimum-32-caractere"}\`.
- \`AUTOPUBLISH_ENABLED=true\`: numai **după** configurare/testare și acord scris al partenerului.
- \`ADMIN_KEY\`: existentă, pentru endpointurile administrative.
- \`ADMIN_EMAIL\`: opțional; implicit oltenitaimobiliare@gmail.com.
- Verifică existența indexurilor MongoDB unice (ImportOffer: sourceId+externalId; Listing: importSourceId+importExternalId). Necesită \`autoIndex\` sau creare explicită a indexurilor.

## Contract tehnic al partenerului
\`POST https://api.oltenitaimobiliare.ro/api/authorized-import/sources/agentie_exemplu/offers\`

Header: \`Authorization: Bearer CHEIA_SECRETĂ_A_PARTENERULUI\` și \`Content-Type: application/json\`.

Exemplu, cu **date demonstrative**, nu ofertă reală:
\`\`\`json
{
  "offers": [{
    "externalId": "id-proprietate-la-agentie-123",
    "sourceUrl": "https://agentie-exemplu.ro/anunt/id-proprietate-la-agentie-123",
    "consentReference": "acord-republicare-2026-01",
    "rightsGranted": true,
    "available": true,
    "county": "Călărași",
    "locality": "Oltenița",
    "category": "Case",
    "intent": "vand",
    "title": "Casă de vânzare cu 3 camere în Oltenița",
    "description": "Locuință individuală situată în Oltenița, cu trei camere, teren aferent și informații oferite direct de proprietar prin agenție.",
    "price": 75000,
    "currency": "EUR",
    "phone": "0722123456",
    "email": "exemplu@agentie.ro",
    "images": ["https://agentie-exemplu.ro/fotografii/casa.jpg"]
  }]
}
\`\`\`

**Nu reutiliza datele demonstrative pentru publicare.** Furnizorul trebuie să garanteze că are dreptul să publice anunțul, textul, imaginile și datele de contact, că oferta este reală și că își menține disponibilitatea. Retragerea se face cu aceeași \`externalId\` și \`available:false\`; sistemul ascunde oferta deja importată. Revocarea drepturilor se transmite prin \`rightsGranted:false\`.

Formatele acceptate: categorie \`Apartamente\`, \`Garsoniere\`, \`Case\`, \`Terenuri\`, \`Spatii comerciale\`, \`Garaje\`; tip \`vand\` / \`inchiriez\`. Sunt necesare telefon românesc, 1–10 imagini HTTPS, preț în euro, titlu și descriere detaliate. Se acceptă numai localități din lista centrală existentă a site-ului, plus județul Călărași declarat explicit.

## Publicare și monitorizare
- Importul pune ofertele în coadă (nu le publică pe loc). Programarea verifică la oră fixă între 09:00–21:00, fusul Europe/Bucharest; nu depășește 2 publicări într-o zi.
- Pentru a evita publicarea unor anunțuri vechi, o ofertă din coadă trebuie reconfirmată în ultimele 7 zile; publicările expiră după 30 de zile.
- Verificarea duplicatelor: identificator extern unic și index unic, plus potrivire după telefon/imagini, descriere, titlu, categorie, localitate și preț.
- Admin: \`GET /api/authorized-import/status\` cu header \`x-admin-key: ...\`. Include publicări azi, oferte în așteptare, număr surse.
- Admin: \`POST /api/authorized-import/run\` cu același header, pentru test controlat (respectă plafonul zilnic și activarea).
- Rulează teste de validare: \`node --test test/authorized-import.test.js\`.

## Ce lipsește pentru anunțuri publice reale
1. Acordul și fluxul tehnic de la **cel puțin o agenție/proprietar** din județ.
2. Configurarea cheii și \`AUTOPUBLISH_ENABLED=true\` în Render, după audit/test pe mediu de test.
3. Deploy-ul codului după verificarea importului (PR, verificare indexuri). Dacă nu există oferte valide într-o zi, **nu se inventează anunțuri**.
