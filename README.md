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

1. **Base de données** : Vercel → Storage / Marketplace → **Neon** (Postgres), reliée au projet.
2. **Variables d'environnement** (Production, et Preview avec une base séparée) :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | URL **poolée** Neon (host `…-pooler…`) + `?sslmode=require&pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | URL **directe** Neon (migrations) |
   | `TMDB_API_KEY` | clé TMDB |
   | `STREAMING_AVAILABILITY_API_KEY` | optionnelle |

3. **Importer le repo** (GitHub) ou `vercel deploy` depuis la racine. Réglages du projet : Root Directory = racine,
   Framework = Other ; le reste vient de `vercel.json`.

Le build (`pnpm vercel-build`) compile `shared`, génère Prisma, **applique les migrations** (`prisma migrate deploy`),
compile l'API puis exporte la PWA. pnpm 11 est forcé via `npx pnpm@11.25.0` (les réglages de `pnpm-workspace.yaml`
ne sont pas compris par les versions plus anciennes).

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

## Foyer et favoris

- Premier lancement : **créer le foyer** (prénom + couleur) ou le **rejoindre** avec le code d'invitation à 6
  caractères (Foyer → Partager). Pas de mot de passe : chaque appareil reçoit un jeton de session.
- Rejoindre avec un prénom déjà présent dans le foyer = se reconnecter à ce profil (nouveau téléphone, réinstallation).
- Les **plateformes** sont celles du foyer (partagées).
- **Favoris** : une *liste commune* (avec la pastille de qui a ajouté le titre) et *ma liste* pour chacun.
  Les titres regardables chez vous sont affichés en premier.

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
