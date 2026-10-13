# Publicare automată — numai județul Călărași

## Scop și starea inițială
Backendul poate **primi de la parteneri autorizați**, valida și publica maximum **2 oferte reale/zi calendaristică** (Europe/Bucharest). Nu generează proprietăți fictive și NU extrage anunțuri de pe OLX/Storia sau alte platforme fără permisiune.

**Fail closed:** implicit `AUTOPUBLISH_ENABLED` este dezactivat. Fără o sursă autorizată, cheia de acces și oferte reale, nimic nu se publică. Nu schimbă regulile conturilor gratuite, plățile Stripe sau anunțurile utilizatorilor.

## Configurare în Render → Environment (backend)
- `AUTHORIZED_IMPORT_SOURCES_JSON`: JSON cu ID-ul și cheia secretă de minimum 32 de caractere pentru **fiecare partener care ne-a dat acordul**, ex. `{"agentie_exemplu":"inlocuieste-cu-o-cheie-aleatorie-de-minimum-32-caractere"}`.
- `AUTOPUBLISH_ENABLED=true`: numai **după** configurare/testare și acord scris al partenerului.
- `ADMIN_KEY`: existentă, pentru endpointurile administrative.
- `ADMIN_EMAIL`: opțional; implicit oltenitaimobiliare@gmail.com.
- Verifică existența indexurilor MongoDB unice (ImportOffer: sourceId+externalId; Listing: importSourceId+importExternalId). Necesită `autoIndex` sau creare explicită a indexurilor.

## Contract tehnic al partenerului
`POST https://api.oltenitaimobiliare.ro/api/authorized-import/sources/agentie_exemplu/offers`

Header: `Authorization: Bearer CHEIA_SECRETĂ_A_PARTENERULUI` și `Content-Type: application/json`.

Exemplu, cu **date demonstrative**, nu ofertă reală:
```json
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
```

**Nu reutiliza datele demonstrative pentru publicare.** Furnizorul trebuie să garanteze că are dreptul să publice anunțul, textul, imaginile și datele de contact, că oferta este reală și că își menține disponibilitatea. Retragerea se face cu aceeași `externalId` și `available:false`; sistemul ascunde oferta deja importată. Revocarea drepturilor se transmite prin `rightsGranted:false`.

Formatele acceptate: categorie `Apartamente`, `Garsoniere`, `Case`, `Terenuri`, `Spatii comerciale`, `Garaje`; tip `vand` / `inchiriez`. Sunt necesare telefon românesc, 1–10 imagini HTTPS, preț în euro, titlu și descriere detaliate. Se acceptă numai localități din lista centrală existentă a site-ului, plus județul Călărași declarat explicit.

## Publicare și monitorizare
- Importul pune ofertele în coadă (nu le publică pe loc). Programarea verifică la oră fixă între 09:00–21:00, fusul Europe/Bucharest; nu depășește 2 publicări într-o zi.
- Pentru a evita publicarea unor anunțuri vechi, o ofertă din coadă trebuie reconfirmată în ultimele 7 zile; publicările expiră după 30 de zile.
- Verificarea duplicatelor: identificator extern unic și index unic, plus potrivire după telefon/imagini, descriere, titlu, categorie, localitate și preț.
- Admin: `GET /api/authorized-import/status` cu header `x-admin-key: ...`. Include publicări azi, oferte în așteptare, număr surse.
- Admin: `POST /api/authorized-import/run` cu același header, pentru test controlat (respectă plafonul zilnic și activarea).
- Rulează teste de validare: `node --test test/authorized-import.test.js`.

## Ce lipsește pentru anunțuri publice reale
1. Acordul și fluxul tehnic de la **cel puțin o agenție/proprietar** din județ.
2. Configurarea cheii și `AUTOPUBLISH_ENABLED=true` în Render, după audit/test pe mediu de test.
3. Deploy-ul codului după verificarea importului (PR, verificare indexuri). Dacă nu există oferte valide într-o zi, **nu se inventează anunțuri**.


## Conector automat Lukian CRM (pull, fără intervenție zilnică)

Sursă de documentație: https://lukian.ai/ro/portaluri-imobiliare/feed-api

Serverul poate citi automat `GET /api/v2/portals/{portal}/feed.json` de pe `api.lukian.ai`, mapând datele în formatul intern, apoi rulează publicarea zilnică, maxim două anunțuri/zi.

**IMPORTANT:** acest endpoint necesită o cheie emisă de Lukian pentru portal. Documentația publică NU înseamnă că s-a primit o cheie și nici că toate agențiile au aprobat republicarea. Este nevoie de acord explicit pentru texte, fotografii și afișarea telefonului agentului.

### Activare, o singură dată, după obținerea contractului/accesului

În Render → Environment → backend:

```env
AUTOPUBLISH_ENABLED=true
AUTHORIZED_LUKIAN_FEEDS_JSON=[{"sourceId":"lukian_calarasi","portal":"SLUG_EMIS_DE_LUKIAN","apiKey":"CHEIE_PRIMITA_DE_LA_LUKIAN_MIN_16_CARACTERE","consentReference":"ACORD-CONTRACTUAL-REAL","rightsConfirmed":true,"activeOnlyConfirmed":true,"allowedAgencyIds":["ID_REAL_AGENTIE"]}]
```

**Atenție:** valorile sunt șabloane, nu chei sau agenții reale. Nu publica cheia în GitHub. Pentru a completa `rightsConfirmed`, acordul trebuie să precizeze drepturile asupra anunțurilor/fotografiilor și datele de contact. `allowedAgencyIds` conține doar agențiile care au autorizat publicarea pe oltenitaimobiliare.ro. Pentru alimentare neîntreruptă, furnizorul trebuie să aibă efectiv proprietăți active în județul Călărași.

Schema feedului Lukian v2 documentată conține `location.city` dar **nu garantează `location.county`**. În lipsa județului per proprietate, automatizarea NU publică nimic din acel rând. Doar dacă furnizorul certifică în scris că feedul/contul conține EXCLUSIV proprietăți în județul Călărași se poate adăuga `"countyScopeConfirmed":"Călărași"`. Orice județ diferit menționat explicit în feed blochează oferta oricum.

Dacă furnizorul confirmă că feedul este complet la fiecare citire și că ofertele eliminate lipsesc din snapshot, se poate adăuga `"completeSnapshotConfirmed":true`. Numai atunci o ofertă dispărută din feed este retrasă după minimum 24 de ore. Altfel rămâne valabilă doar cât timp feedul o reconfirmă, cu expirare automată după cel mult 30 de zile de la ultima actualizare. Retragerea explicită prin status se aplică imediat.

- Cronul serverului: de la 09:00 la 21:00, o dată pe oră, `Europe/Bucharest`, citește feedul și apoi încearcă publicarea (maximum 2 pe zi).
- Prioritizează proprietățile actualizate recent și nu depășește 1.000 de înregistrări procesate per feed/rulare.
- Verificări: localitate/județ, sursă, agenții licențiate, fotografii, telefon, preț EUR, lipsă duplicat, statut activ.
- Sync fără duplicare: dacă oferta este deja publicată, se actualizează anunțul existent; nu se creează altul.
- Monitorizare: `GET /api/authorized-import/status` (admin) indică și `authorizedLukianFeedsConfigured`.
- Test manual: `POST /api/authorized-import/run` (admin) face pull și publicare, respectând siguranțele.
- Fără `AUTOPUBLISH_ENABLED=true` sau fără `AUTHORIZED_LUKIAN_FEEDS_JSON` valid => **zero importuri**.

### Cerere de acces de trimis furnizorului

Subiect: Parteneriat portal local OltenitaImobiliare.ro – feed imobiliar Călărași

Bună ziua,
Administrăm OltenitaImobiliare.ro, un portal imobiliar dedicat exclusiv județului Călărași. Dorim integrarea unui feed JSON/Push cu proprietăți reale și active din județ, pentru afișare cu numele și telefonul agenției. Ne puteți confirma dacă există oferte disponibile pentru județul Călărași, condițiile de acces API pentru portal, drepturile de republicare a textelor/fotografiilor și modul de sincronizare a ofertelor retrase? Implementarea tehnică este pregătită; ne-ar ajuta un cont de test și documentele contractuale pentru acord.

Mulțumim,
Echipa OltenitaImobiliare.ro
