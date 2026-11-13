# Application des donneurs (PWA)

Responsables : Hanaa, Johanne. Port local : **3000**.

## Lancer

```bash
# depuis la racine du dépôt
npm install
cp apps/donneur/.env.example apps/donneur/.env.local     # Windows : copy apps\donneur\.env.example apps\donneur\.env.local
npm run dev:donneur
```

Ouvrir http://localhost:3000, puis passer le navigateur en mode téléphone (F12 → icône téléphone).

### Mode démonstration (semaines 3 et 4)

Avec `NEXT_PUBLIC_UTILISER_EXEMPLES=true`, l'application n'appelle aucun serveur : le **simulateur**
(`src/lib/simulateur.ts`) rejoue les exemples JSON de `packages/contrat-api` et garde ce que vous faites
(réponses aux alertes, pause, inscription…) dans le navigateur.

| Pour | Saisir |
|---|---|
| Se connecter au compte de démonstration | `70 00 00 01` / `donneur2026` |
| Tout code reçu « par WhatsApp » | `123456` |
| Suivre une demande de collecte déjà acceptée | `CAMP-2026-0007` / `70 11 22 33` |
| Repartir de zéro | Profil → « Réinitialiser la démonstration » |

### Brancher le vrai backend (semaine 5)

`NEXT_PUBLIC_UTILISER_EXEMPLES=false` et `NEXT_PUBLIC_API_URL=<adresse du backend>`. Aucun écran ne change :
toutes les routes sont dans `src/lib/api.ts` et suivent le contrat `packages/contrat-api`.

### Compte fictif de démonstration (vrai backend)

Le simulateur ne sert plus en ligne : le code de vérification part par WhatsApp et n'arrive
jamais sur un numéro fictif. Pour tester ou démontrer l'application déployée, utilisez le
compte ci-dessous — il existe dans la base, déjà vérifié, avec un historique et des alertes.

| Adresse | Téléphone | Mot de passe |
|---|---|---|
| https://mydjigui.vercel.app | `70 00 00 01` | `donneur2026` |

Ce que le compte contient : 5 dons « apte » + 1 ajournement (Mes dons), éligibilité en cours
(Ma carte), 1 alerte ouverte à laquelle répondre et 1 alerte close déjà répondue, 3
notifications dont 1 non lue.

Le compte est décrit par `supabase/seed/demo-donneur.sql`. Le script est rejouable : il remet
le compte dans son état de départ sans toucher aux autres lignes de la base.

```bash
node backend/scripts/appliquer-sql.mjs supabase/seed/demo-donneur.sql
```

### Tester l'installation (PWA)

L'agent de service n'est actif qu'en production : `npm run build -w @dds/donneur` puis `npm run start -w @dds/donneur`.

## Écrans

| Écran | Route | Fichier |
|---|---|---|
| D1 Ouverture | `/` | `src/app/page.tsx` |
| D2 Bienvenue | `/bienvenue` | `src/app/bienvenue/page.tsx` |
| D3 Inscription (3 étapes) | `/inscription` | `src/app/inscription/page.tsx` |
| D4 Vérification du numéro | `/verification` | `src/app/verification/page.tsx` |
| D5 Connexion | `/connexion` | `src/app/connexion/page.tsx` |
| D6 Mot de passe oublié | `/mot-de-passe-oublie` | `src/app/mot-de-passe-oublie/page.tsx` |
| D7 Nouveau mot de passe | `/nouveau-mot-de-passe` | `src/app/nouveau-mot-de-passe/page.tsx` |
| D8 Carte de donneur | `/carte` | `src/app/(espace)/carte/page.tsx` |
| D9 Alertes | `/alertes` | `src/app/(espace)/alertes/page.tsx` |
| D10 Réponse à une alerte | `/alertes/[id]` | `src/app/(espace)/alertes/[id]/page.tsx` |
| D11 Historique | `/historique` | `src/app/(espace)/historique/page.tsx` |
| D12 Centres | `/centres` | `src/app/(espace)/centres/page.tsx` |
| D13 Profil (pause, préférences, mot de passe) | `/profil` | `src/app/(espace)/profil/page.tsx` |
| D14 Notifications | `/notifications` | `src/app/(espace)/notifications/page.tsx` |
| C0 Organiser une collecte (public) | `/campagnes` | `src/app/campagnes/page.tsx` |
| C1 Proposer une collecte (public) | `/campagnes/proposer` | `src/app/campagnes/proposer/page.tsx` |
| C2 Suivre une demande (public) | `/campagnes/suivi` | `src/app/campagnes/suivi/page.tsx` |
| Hors connexion | `/hors-connexion` | `src/app/hors-connexion/page.tsx` |
| Installer l'application | `/installation` | `src/app/installation/page.tsx` |

## Organisation

```
src/
  app/              un dossier par écran ; (espace)/ = écrans connectés (garde de session + barre du bas)
  components/       Bouton, Champs, Messages, Etat, BlocGroupe, Goutte, ReponseAlerte, BarreNavigation…
  lib/
    api.ts          LE seul endroit qui parle au backend (bascule simulateur / réseau)
    simulateur.ts   faux backend des semaines 3-4
    session.ts      jeton de connexion, vérification en cours
    regles.ts       groupes, motifs, créneaux, validations de saisie
    format.ts       dates, numéros, pluriels
public/
  manifest.json, service-worker.js, icones/
```

## Fusion des deux prototypes

| Repris de | Quoi |
|---|---|
| DJIGUI | Identité visuelle (couleurs, bloc de groupe, goutte), inscription en 3 étapes, numéro saisi deux fois, réponse « Je viens / Je ne peux pas » de même poids avec motif, créneau et moyen de déplacement, agent de service, guide d'installation |
| CNTS-Registering | Délai entre deux dons (3 mois homme, 4 mois femme) dans le simulateur, groupes rares, accord de recontact, motif d'ajournement jamais affiché |
| Cahier des charges | Vérification du numéro et mot de passe oublié par WhatsApp (remplacent la question de sécurité de DJIGUI), mise en pause des alertes, réinitialisation par un agent, page hors connexion |

## Campagnes de collecte (C0 à C2)

Pages publiques, sans compte : une école, une association, une entreprise ou un groupe de jeunes propose
une collecte au CNTS (structure, responsable, lieu, date, nombre de donneurs, équipements disponibles).
La demande reçoit une référence `CAMP-AAAA-NNNN` ; le responsable la suit avec cette référence et son numéro.
Accès : écran de bienvenue (D2) pour un visiteur, onglet « Collectes » de la barre du bas pour un donneur connecté (le profil se rejoint alors par l’icône en haut de chaque écran).

Reprise de la page « Demandes » du prototype CNTS-Registering. **Ajout hors calendrier, à valider en équipe** :
il faut aussi l'écran de traitement côté CNTS dans `apps/plateforme` (routes `/gestion/campagnes/demandes`
décrites dans le contrat) et les valeurs à confirmer avec le CNTS (`DELAI_MIN_CAMPAGNE_JOURS`, `PARTICIPANTS_MINIMUM`
dans `src/lib/regles.ts`).

## Reste à faire (calendrier)

- S5-S6 : brancher le vrai backend (`NEXT_PUBLIC_UTILISER_EXEMPLES=false`) et tester sur Android et iPhone.
- S6 : abonnement aux notifications push (l'agent de service sait déjà les afficher ; il manque la clé du serveur).
- S7 : finitions sur petits écrans, messages d'erreur réels du backend.
