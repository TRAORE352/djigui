Données de test créées directement dans la base, en attendant l'espace administrateur.
Aucune vraie donnée de donneur ici.

| Fichier | Contenu | À appliquer |
|---|---|---|
| `seed.sql` | zones, sites, types de produits, règles, premiers comptes agents (`ChangeMoi2026!`) | en premier |
| `demo-donneur.sql` | compte fictif de l'application des donneurs : `70 00 00 01` / `donneur2026`, avec historique, alertes et notifications | après `seed.sql` |

Sur une base existante, appliquez-les avec le script du dépôt (il lit `DATABASE_URL` dans
`backend/.env` et n'affiche jamais la chaîne de connexion) :

```bash
node backend/scripts/appliquer-sql.mjs supabase/seed/demo-donneur.sql
```

`demo-donneur.sql` est rejouable : il supprime puis recrée uniquement les lignes du compte de
démonstration (identifiants fixes), pour repartir d'une démonstration propre après un test où
quelqu'un a répondu à l'alerte ou changé le mot de passe.
