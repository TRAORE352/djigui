# DJIGUI

**L'espoir arrive à temps.**

Plateforme numérique de don de sang et de traçabilité. Quand un centre
de transfusion manque de sang d'un groupe, il prévient les donneurs
compatibles de la zone concernée, qui répondent oui ou non en une touche.

Projet Give Back — bourse de la Fondation Mastercard, 2iE, Ouagadougou.
Conventions de développement : voir `CLAUDE.md`.

---

## Deux projets

| Dossier | Rôle | Port |
|---|---|---|
| `backend/` | Couche de service : Express + MariaDB, SQL écrit à la main | 4000 |
| `frontend/` | Couche de présentation : Next.js, application installable | 3000 |

Les deux ne communiquent que par l'interface de programmation, en JSON.

---

## Installation, la première fois

**Prérequis :** Node.js 18 ou plus, XAMPP avec MySQL démarré.

### 1. La base de données

Ouvrez phpMyAdmin, onglet **Importer**, et importez dans cet ordre :

1. `backend/sql/01-creation.sql` — crée la base et ses dix-huit tables
2. `backend/sql/02-parametres.sql` — les valeurs réglables

Ne créez pas la base à la main avant l'import : le script s'en charge,
avec le bon encodage.

### 2. Le backend

```bash
cd backend
copy .env.example .env
```

Ouvrez `.env` et remplissez deux choses :

- `DB_UTILISATEUR` et `DB_MOT_DE_PASSE` — avec XAMPP par défaut :
  `root` et un mot de passe vide
- `JWT_SECRET` — une longue suite de caractères au hasard, sans espace

Puis :

```bash
npm install
npm run verifier        # dit en français ce qui manque encore
npm run creer-admin     # à lancer deux fois : deux administrateurs
npm run dev
```

Le service répond sur http://localhost:4000. Ouvrez cette adresse dans
un navigateur : elle affiche l'état complet de l'installation.

### 3. Le frontend

Dans un **second** terminal :

```bash
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
```

L'application s'ouvre sur http://localhost:3000.

### 4. Les premières données

La base démarre volontairement vide (contrainte C3 du cahier des
charges : aucun fichier de remplissage). Tout se saisit par les écrans.

1. Allez sur **http://localhost:3000/gestion/connexion**
2. Connectez-vous avec le compte administrateur créé à l'étape 2
3. Ouvrez **Structures et zones** :
   - créez d'abord votre structure (le centre de transfusion) ;
     ses huit seuils de stock sont créés en même temps
   - créez ensuite vos zones, quartier par quartier

**Sans zone, personne ne peut s'inscrire comme donneur.** C'est la
première chose à faire.

4. Un donneur peut alors s'inscrire depuis http://localhost:3000, sur
   un téléphone ou dans le navigateur.

---

## Les trois espaces

| Adresse | Pour qui | État |
|---|---|---|
| `/` | Le donneur, sur son téléphone | En place |
| `/gestion/connexion` | Les agents du centre | Connexion en place, écrans de travail à venir |
| `/administration` | Les deux administrateurs | Comptes, structures et zones en place |

---

## Quand quelque chose ne marche pas

Avant de chercher ailleurs, lancez le diagnostic :

```bash
cd backend && npm run verifier
```

Ou ouvrez **http://localhost:4000** dans un navigateur.

| Ce que vous voyez | Ce que c'est | Le remède |
|---|---|---|
| « Le service ne répond pas » | Le backend n'est pas lancé | `cd backend && npm run dev` |
| « MariaDB ne répond pas » | MySQL est arrêté | Démarrez MySQL dans XAMPP |
| « Identifiants de base refusés » | `.env` mal rempli | Vérifiez `DB_UTILISATEUR` et `DB_MOT_DE_PASSE` |
| « La base djigui n'existe pas » | Import non fait | Importez `01-creation.sql` |
| La liste des zones est vide | Aucune zone créée | Administration, Structures et zones |
| Le frontend démarre sur 3001 | Un ancien serveur tourne | Fermez-le, ou gardez : les deux ports sont autorisés |
| Les accents sont cassés | Base créée à la main | Refaites l'import sans créer la base avant |

---

## Ce que le projet respecte

- SQL écrit à la main, sans outil de génération, avec des paramètres liés
- Frontend et backend séparés, reliés uniquement par l'interface
- Aucun fichier de remplissage : toute donnée entre par un écran
- Aucun identifiant dans le code : tout passe par `.env`
- Mots de passe et réponses de sécurité en condensat, jamais en clair
- Toute action sensible inscrite au journal, refus compris
