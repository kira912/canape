# Canapé

Chercher un film ou une série **uniquement sur les plateformes où on a un compte**, puis ouvrir directement l'app de la plateforme.

PWA d'abord (tests iOS / Android), React Native ensuite — même code Expo.

```
apps/api         NestJS — proxy TMDB (+ Streaming Availability), foyer + favoris (Prisma/Postgres), sert aussi la PWA
apps/mobile      Expo Router — app native + export web (PWA)
packages/shared  Contrats zod + règle « regardable chez nous »
```

## Démarrer

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # renseigner TMDB_API_KEY
pnpm db:up                               # Postgres (docker) sur le port 5434
pnpm db:migrate                          # crée les tables
```

- **Clé TMDB** (gratuite) : themoviedb.org → Paramètres → API. La clé v3 ou le jeton v4 fonctionnent.
- **Clé Streaming Availability** (optionnelle, quota gratuit sur RapidAPI) : donne les liens directs vers le titre
  sur chaque plateforme. Sans elle, les boutons ouvrent la recherche de la plateforme.

### Dev

```bash
pnpm dev:api     # http://localhost:3333/api
pnpm dev:web     # PWA en dev sur http://localhost:8081
pnpm dev:mobile  # Expo Go / dev client
```

### Tester la PWA sur les téléphones

L'installation et le service worker exigent du HTTPS. L'API sert la PWA sur la même origine, donc un seul tunnel suffit :

```bash
pnpm build                                  # shared + api + export web (apps/mobile/dist)
pnpm --filter @canape/api start             # PWA + API sur :3333
cloudflared tunnel --url http://localhost:3333   # ou ngrok http 3333
```

Puis ouvrir l'URL https sur le téléphone :
- **iOS** (Safari) : Partager → « Sur l'écran d'accueil »
- **Android** (Chrome) : menu → « Installer l'application »

## Déployer sur Vercel

Un seul projet Vercel, à la racine du monorepo : la PWA est servie par le CDN, l'API NestJS tourne en fonction
(`api/index.js` → `apps/api/dist/serverless.js`) sur la même origine (`/api`). Tout est décrit dans `vercel.json`.

1. **Base de données** : Vercel → Storage / Marketplace → **Neon** (Postgres), reliée au projet, région
   **AWS Frankfurt (`eu-central-1`)** — la même que les fonctions (`"regions": ["fra1"]` dans `vercel.json`),
   sinon chaque requête SQL traverse l'Atlantique (fonctions Vercel par défaut à Washington).
2. **Variables d'environnement** (Production, et Preview avec une base séparée) :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | URL **poolée** Neon (host `…-pooler…`) + `?sslmode=require&pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | URL **directe** Neon (migrations) |
   | `TMDB_API_KEY` | clé TMDB |
   | `STREAMING_AVAILABILITY_API_KEY` | optionnelle |
   | `LLM_API_KEY` | optionnelle — clé Groq **gratuite**, active la recherche IA et le Match assisté |
   | `ANTHROPIC_API_KEY` | optionnelle, payante — utilise Claude à la place (prioritaire si renseignée) |
   | `AI_DAILY_LIMIT` | optionnelle — plafond d'appels IA par jour pour toute l'app (défaut 1000, `0` = IA coupée) |
   | `CRON_SECRET` | chaîne aléatoire (`openssl rand -hex 32`) — protège la purge quotidienne des données inactives |
   | `EXPO_PUBLIC_CONTACT_EMAIL` | e-mail de contact affiché dans les pages légales (obligatoire) |
   | `SITE_URL` | optionnelle — domaine public (`https://…`) ; sinon le domaine de production Vercel |

3. **Importer le repo** (GitHub) ou `vercel deploy` depuis la racine. Réglages du projet : Root Directory = racine,
   Framework = Other ; le reste vient de `vercel.json`.

Le build (`pnpm vercel-build`) compile `shared`, génère Prisma, **applique les migrations** (`prisma migrate deploy`),
compile l'API puis exporte la PWA. pnpm 11 est forcé via `npx pnpm@11.25.0` (les réglages de `pnpm-workspace.yaml`
ne sont pas compris par les versions plus anciennes).

### Mise en production

- **Avant d'ouvrir au public** : renseigner l'éditeur et le contact dans `apps/mobile/src/constants/site.ts`
  (ou `EXPO_PUBLIC_CONTACT_EMAIL`) — le build affiche un avertissement tant que le placeholder est là — et relire
  les textes de `apps/mobile/src/legal/` (changer `legalUpdatedAt` à chaque modification).
- **Domaine** : l'ajouter dans Vercel → Domains. Les URLs canoniques, le sitemap et l'image de partage utilisent
  `SITE_URL`, sinon `VERCEL_PROJECT_PRODUCTION_URL`.
- **Google Search Console** : déclarer le domaine puis soumettre `https://<domaine>/sitemap.xml`.
- Les déploiements Preview ont un `robots.txt` qui interdit tout (et Vercel ajoute `X-Robots-Tag: noindex`).

### Légal (RGPD / LCEN)

- Pages publiques `/legal/legal-notice`, `/legal/privacy`, `/legal/terms` (FR qui fait foi + EN), liées depuis
  l'accueil, le profil et chaque page légale.
- Pas de cookie ni de traceur : uniquement du stockage local strictement nécessaire → pas de bandeau de consentement.
  Ajouter un outil d'audience ou de pub imposerait un bandeau **et** une mise à jour de la politique.
- **Droit à l'effacement** : Profil/Foyer → « Supprimer mes données » (`DELETE /api/household/member`) supprime le
  membre et tout ce qu'il a créé ; le foyer part avec son dernier membre.
- **Durée de conservation** : un appareil inutilisé 12 mois est déconnecté, un foyer sans plus aucun appareil est
  supprimé — Vercel Cron appelle `GET /api/cron/purge` chaque nuit (`crons` dans `vercel.json`, `CRON_SECRET`).
  `Session.lastUsedAt` est rafraîchi au plus une fois par jour.
- Sous-traitants cités dans la politique : Vercel, Neon, Groq ou Anthropic, TMDB/YouTube (images). En changer
  ⇒ mettre la politique à jour.

### SEO

- `/welcome` sert de landing page (fonctionnalités + CTA) ; `index.html` contient aussi une version statique de ce
  contenu pour les robots sans JavaScript, masquée dès que l'app démarre.
- Titre, description, canonical et Open Graph par page via `<Seo>` (`expo-router/head`) ; valeurs par défaut,
  image de partage (`public/og-image.png`, 1200×630) et JSON-LD `WebApplication` dans `public/index.html`.
- `robots.txt` et `sitemap.xml` sont générés par `apps/mobile/scripts/build-web.mjs` (pages publiques uniquement ;
  les écrans du foyer sont `noindex`).

### Limites de débit

Compteurs à fenêtre fixe dans Postgres (`RateLimit`, partagés par toutes les instances serverless, purgés par le
cron), par empreinte hachée de l'IP : `@RateLimit("…")` sur la route, politiques dans
`apps/api/src/rate-limit/rate-limit.service.ts`. Création / join / code de secours / pairing : quelques essais par
quart d'heure ; catalogue : 300 req/min (seules les requêtes non servies par le CDN arrivent jusqu'à l'API). Si la
base ne répond pas, le catalogue reste accessible (les autres routes en ont besoin de toute façon).

Appels TMDB : timeout 6 s, 16 en parallèle max par instance, un retry sur 429 court, ids inconnus mémorisés 10 min.

### Sécurité navigateur

`vercel.json` pose une **Content-Security-Policy** stricte (`script-src 'self'`, images TMDB/YouTube, réseau local
pour la TV) : aucun script inline — ce qui doit tourner avant le bundle est dans `public/boot.js`. Le serveur local
(`pnpm --filter @canape/api start`) applique les mêmes en-têtes, pour tester la PWA comme en production. Ajouter
un service tiers (images, script, API appelée depuis le navigateur) ⇒ l'ajouter à la CSP.

### Logs

Une ligne JSON par requête API (`"msg":"request"` : id, route sans query string, statut, durée, nombre d'appels
TMDB) et par appel IA (`"msg":"ai_call"` : type, fournisseur, foyer, durée, succès) — dans les logs Vercel. L'en-tête
`X-Request-Id` de la réponse permet de retrouver la ligne d'un bug signalé.

### Cache

| Quoi | Navigateur | CDN Vercel |
|---|---|---|
| `/_expo/static/*`, `/assets/*` (noms hashés) | 1 an, immutable | 1 an |
| `/icons/*` | 1 jour (+ SWR 7 j) | idem |
| `index.html`, `sw.js`, `manifest.json` | revalidé à chaque fois | idem |
| `GET /api/providers`, `/api/genres/*` | 1 h | 24 h (+ SWR 7 j) |
| `GET /api/search`, `/api/discover` | 5 min | 1 h (+ SWR 1 j) |
| `GET /api/titles/*` | 5 min | 6 h (+ SWR 1 j) |
| `/api/household*`, `/api/favorites*`, toute écriture, toute erreur | `private, no-store` | jamais |

- La langue est dans l'URL (`?lang=`), donc le CDN ne mélange jamais les langues ; la recherche est envoyée en
  minuscules pour maximiser les hits.
- Côté app, React Query garde les réponses en mémoire (`staleTime` alignés sur ces durées).
- Le service worker ne touche jamais `/api` ; il garde l'app shell pour le hors-ligne. Changer sa stratégie ⇒
  incrémenter `CACHE` dans `apps/mobile/public/sw.js`.

## Tests

```bash
pnpm test                                    # unitaires (shared, api, mobile)
docker compose exec postgres createdb -U canape canape_test   # une fois
TEST_DATABASE_URL=postgresql://canape:canape@localhost:5434/canape_test \
  pnpm --filter @canape/api test:integration # vraie app + Postgres : isolation des foyers, effacement, pairing, limites
```

La base d'intégration est **vidée** à chaque passage : son nom doit contenir `test`, sinon la suite est ignorée.

## IA

- **Recherche en langage naturel** (✨ dans la barre de recherche) : Claude transforme la phrase en critères
  (type, genres, durée, note, époque, mots-clés TMDB, « dans le style de »), l'API les résout avec TMDB sur les
  plateformes du foyer. L'IA ne propose jamais de titre elle-même.
- **Match assisté** : chacun écrit son envie, Claude propose des critères de compromis + une phrase d'explication.
- **Fournisseur** : Groq gratuit par défaut (`LLM_API_KEY`, modèle `openai/gpt-oss-120b` en JSON Schema strict ;
  tout service compatible OpenAI via `LLM_BASE_URL` / `LLM_MODEL`), ou Claude si `ANTHROPIC_API_KEY` est renseignée
  (`effort: "low"`, `fallbacks: "default"`). Réponses toujours revalidées par zod.
- 40 appels/heure/foyer et `AI_DAILY_LIMIT` appels/jour au total (compteurs en base, partagés par toutes les
  instances), interprétations en cache 24 h. Sans clé, les fonctions IA répondent 503 et le reste marche.

## Foyer et favoris

- Premier lancement : **créer le foyer** (prénom + couleur) ou le **rejoindre** avec le code d'invitation à 6
  caractères (Foyer → Partager). Pas de mot de passe : chaque appareil reçoit un jeton de session.
- Le code d'invitation ne crée que de **nouveaux** membres (un prénom déjà présent → 409) : il est court et partagé,
  il ne doit jamais ouvrir un profil existant. Il peut être changé (Foyer → « Changer de code »).
- Retrouver son profil sur un nouvel appareil : QR code (ci-dessous) ou **code de secours** personnel
  (16 caractères, ~79 bits, stocké haché, affiché une seule fois ; Foyer → « Utiliser Canapé sur un autre appareil »,
  puis Accueil → « Retrouver mon profil »).
- Foyer → « Déconnecter mes autres appareils » supprime toutes les sessions du membre sauf celle-ci.
- Les **plateformes** sont celles du foyer (partagées).
- **Favoris** : une *liste commune* (avec la pastille de qui a ajouté le titre) et *ma liste* pour chacun.
  Les titres regardables chez vous sont affichés en premier.

### Connexion par QR code (comme Discord)

- **Nouvel appareil** (déconnecté) : Accueil → « Se connecter avec un autre appareil » affiche un QR code
  (`<origine>/pair/<id>`) et interroge l'API toutes les 2 s.
- **Appareil connecté** : Profil/Foyer → « Scanner un QR code » (`/scan`, expo-camera), puis validation sur
  `/pair/[id]` (aussi atteignable en scannant avec l'appareil photo du système si le navigateur est connecté).
- Sécurité : le QR ne contient que l'id ; il faut une session pour valider, et le **secret** resté sur le nouvel
  appareil pour recevoir la session. Le nouvel appareil affiche aussi **deux chiffres** à choisir parmi trois sur
  l'appareil qui valide (un lien d'appairage envoyé par quelqu'un d'autre ne se valide donc pas en un geste) ; un
  mauvais choix annule la demande. Valable 5 min, utilisable une seule fois (`DevicePairing`, purgé par le cron).
- Web : le décodage passe par `BarcodeDetector` natif, sinon par zxing en WebAssembly, servi depuis notre domaine
  (`/zxing_reader.wasm`, copié au build) plutôt que depuis le CDN jsDelivr. La caméra exige HTTPS (ou localhost).
- Natif : nécessite un nouveau build (module natif `expo-camera`, permission caméra dans `app.json`).

## Langues

- Textes de l'app : `apps/mobile/src/i18n/locales/` — `fr.ts` est la référence, les autres locales ont le même type
  (une clé manquante = erreur de compilation).
- Langue : celle du téléphone par défaut, modifiable par appareil dans Foyer → Langue.
- Les contenus TMDB (titres, résumés, genres, bandes-annonces) suivent la langue de l'app via l'en-tête
  `Accept-Language` ; les disponibilités restent celles de la **France**.
- **Ajouter une langue** : créer `locales/<code>.ts` (typé `Translations`), l'enregistrer dans `i18n/index.ts`
  (`resources` + `LANGUAGE_NAMES`), puis l'ajouter à `SUPPORTED_LANGUAGES` et `TMDB_LOCALES`
  (`packages/shared/src/i18n.ts`).

## Règles métier

- **Regardable** = offre `abonnement`, `gratuit` ou `gratuit avec pub` sur une plateforme cochée.
  Location / achat / autres plateformes → derrière « Voir aussi ailleurs ».
- **Séries** : disponibilité saison par saison (TMDB expose les plateformes par saison) ; badge
  « Partiellement dispo » quand seules certaines saisons sont regardables.
- **Liens** : lien direct (Streaming Availability) → recherche de la plateforme → page « où regarder » TMDB.

## À vérifier sur appareil

- Le lien direct ouvre-t-il bien l'app (Netflix, Prime…) depuis la PWA installée sur iOS ?
- Les URLs de recherche des plateformes (`apps/api/src/links/platforms.ts`) ne sont pas documentées officiellement.

## Prochaine étape

« Déjà vu » par membre (le foyer et ses membres sont en place).

Données : [TMDB](https://www.themoviedb.org) · Disponibilités : JustWatch (via TMDB).
