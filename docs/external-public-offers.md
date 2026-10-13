# Oferte externe — județul Călărași

Modul distinct de anunțurile originale ale utilizatorilor. Citește pagina publică indexului imobiliar Anuntul.ro pentru județul Călărași, extrage **doar fapte minimale** (tip, localitate, preț), generează un text informativ nou și indică prin link sursa originală. **Nu descarcă imagini, nu copiază descrieri, nu importă telefoane/emailuri.**

## Limite obligatorii
- Maximum 2 referințe noi per zi locală Europe/Bucharest, procesare programată la 10:15 și 16:15.
- Oferte numai din localitățile listei județului Călărași și din indexul județului al sursei. Prețul provine din index, poate fi schimbat la sursă.
- De-duplicare prin `sourceUrl` unic, plus comparație cu anunțurile proprii active.
- Exclus **olteniteanul.ro** și toate paginile Facebook Oltenițeanul; test automat inclus.
- Rezultatele nu pretind disponibilitate confirmată și îndrumă către sursa originală pentru informațiile complete.
- Referințele expiră automat după 30 de zile (dacă nu sunt retrase înainte).
- Anunțurile utilizatorilor, Stripe, autentificarea, SMS-urile și durata anunțurilor originale rămân neschimbate.

## API
`GET /api/oferte-externe?limit=6` public, read-only. Nu modifică date.
`GET /api/oferte-externe/status` și `POST /api/oferte-externe/run` numai cu cheia existentă `x-admin-key`. Comanda admin respectă aceeași limită de 2/zi și nu este necesară pentru funcționarea normală.

## Activare
Implicit modulul este pornit odată cu deploy-ul backendului, deoarece fluxul este public și nu cere chei. Variabila `PUBLIC_OFFERS_ENABLED=false` îl dezactivează imediat după repornirea aplicației. Dacă nu sunt oferte eligibile sau sursa nu poate fi accesată, modulul nu inventează referințe și nu afectează fluxul existent.

La prima lansare verificați în Render logul «RSS Oferte externe» și endpointul public. Mecanismul depinde de structura paginii furnizorului; dacă site-ul schimbă HTML-ul ori limitează accesul, automatizarea poate importa zero oferte până la ajustare.

**Observație:** această integrare este un index de linkuri și informații factuale, nu republicarea integrală a anunțurilor unui terț. Revizuiți condițiile de utilizare ale sursei pentru exploatarea comercială continuă.
