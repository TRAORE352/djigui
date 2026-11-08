#!/usr/bin/env bash
# Recopie le contrat d'API (source de vérité : packages/contrat-api) dans
# chaque application.
#
# Pourquoi cette copie : chaque app Next.js est déployée séparément sur
# Vercel, depuis son propre dossier. Une dépendance `file:../../packages/...`
# sort de la racine du projet déployé et n'est pas installée. Chaque app
# dépend donc de `file:./contrat-api`, un miroir du paquet partagé.
#
# À lancer après toute modification du contrat :
#   ./scripts/synchroniser-contrat.sh
set -euo pipefail

racine="$(cd "$(dirname "$0")/.." && pwd)"
source_contrat="$racine/packages/contrat-api"

for app in "$racine"/apps/*/; do
  cible="$app/contrat-api"
  [ -d "$cible" ] || continue
  mkdir -p "$cible/src" "$cible/exemples"
  cp "$source_contrat/src/index.ts" "$cible/src/index.ts"
  cp "$source_contrat/package.json" "$cible/package.json"
  cp "$source_contrat/tsconfig.json" "$cible/tsconfig.json"
  # Les exemples JSON ne sont pas tous présents partout : on reflète la source.
  if [ -d "$source_contrat/exemples" ]; then
    rm -rf "$cible/exemples"
    cp -r "$source_contrat/exemples" "$cible/exemples"
  fi
  echo "Contrat synchronisé : $(basename "$app")"
done

echo "Terminé. Vérifiez avec : npm run typecheck"
