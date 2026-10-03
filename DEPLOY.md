# Sales Jarvis / SPIN: jaettava Netlify-demo

Tämä itsenäinen paketti säilyttää olemassa olevan redesignin ja kahdeksan fiktiivistä B2B-ostajaa. Sama core-moottori tekee paikallisen kvalifioinnin, lähteistetyn luonnoksen ja sisäisen handoffin. Jokainen selain tallentaa oman tilansa localStorageen; tiimin muutokset eivät synkronoidu toisiinsa.

1. Pura lähde-ZIP ja avaa `netlify-demo/`: `npm run build && npm test`.
2. Nopein julkaisu: vedä **dist/** Netlify Dropiin. Koodin jakamista varten jaa erillinen lähde-ZIP tai liitä tämä kansio tiimin Git-repoon. Build command `node build.mjs`, publish directory `dist`; `netlify.toml` on mukana.
3. Jo tunnistetussa oikeassa Netlify-tilissä CLI-julkaisu: `netlify deploy --dir=dist --prod`. Tämä julkaisee sivun ulkoisesti; omistaja tekee sen hyväksytyssä tilissä.
4. Paikallinen preview: `npm start` → `http://127.0.0.1:4330`. Avaa CRM → Demo Pulse Gym → Review qualification → Prepare follow-up → Record founder handoff. Follow-ups ja Completed work näyttävät tallennetun tuloksen. Lähdepainike avaa alkuperäisen fiktiivisen keskustelun.
5. Jaetun sivun linkki on käytettävä demo, ei koodieditori. Muokkaa lähteitä `src/`-kansiossa, aja build ja julkaise uudelleen. Demotilan palautus: poista vain sivun `sales-jarvis-fictional-netlify-v1` localStorage-avain selaimen kehittäjätyökaluista.

Versio on **guided offline demo**. Live ElevenLabs, mikrofonisessio, API-avaimet, Keychain, private imports, sähköpostin lähetys ja ulkoinen CRM eivät kuulu pakettiin. Tuotteen ainesosat, kliiniset hyödyt, hinnat ja saatavuus pysyvät UNKNOWN. Luonnos ja handoff eivät lähetä mitään asiakkaalle.

`src/vendor/core.mjs` ja UI ovat paikallisen sovelluksen snapshotteja. `build.mjs` poistaa Node/filesystem-adapterin, tuottaa puhtaan selaimen action-moottorin ja lisää localStorage/fetch-adapterin. Se ei lue käyttäjän runtimea eikä avaimia. `PROVENANCE.json`, kuvalähteet ja Inter-fontin lisenssi säilyvät paketissa.

Viralliset ohjeet: https://docs.netlify.com/build/configure-builds/file-based-configuration/ ja https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/ .
