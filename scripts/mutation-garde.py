#!/usr/bin/env python3
"""
Mutation du garde de session, avec PREUVE que le mutant est bien servi.

Piège rencontré : en mode dev, le serveur Next peut continuer à servir le
bundle précédent après l'édition du fichier. La mutation passe alors sur du
code qui ne tourne pas, le test reste vert, et le « mutant survivant » est en
réalité un mutant jamais posé — une conclusion fausse dans les deux sens.

D'où deux garde-fous :
  1. le mutant porte un MARQUEUR observable (`data-mutant` sur <html>) ;
     s'il est absent de la page, on refuse de conclure quoi que ce soit ;
  2. le serveur front est redémarré avec un `.next` vide avant mesure.

Le fichier est restauré dans un `finally`, et l'arbre est comparé à lui-même
par empreinte du diff — un dépôt de travail porte légitimement des
modifications non commises, donc « git diff vide » serait la mauvaise
assertion.
"""
import hashlib
import os
import pathlib
import shutil
import signal
import subprocess
import time
import urllib.request

RACINE = pathlib.Path("/root/don-de-sang")
APP = RACINE / "apps/plateforme"
CIBLE = APP / "src/components/Coquille.tsx"
FRONT = "http://localhost:3001"

ANCRE = '      : a.roles.some((r) => r.startsWith("agent_"));'
MUTANT = (
    '      : a.roles.length >= 0; // MUTANT : garde de l\'espace agent neutralisé\n'
    '    if (typeof document !== "undefined") '
    'document.documentElement.dataset.mutant = "pose";'
)


def empreinte() -> str:
    d = subprocess.run(["git", "diff"], cwd=RACINE,
                       capture_output=True, text=True).stdout
    return hashlib.sha256(d.encode()).hexdigest()[:12]


def tuer_front() -> None:
    """Arrête next-server par NOM d'exécutable.

    `pkill -f "next dev"` tuerait le shell qui exécute cette commande.
    """
    out = subprocess.run(["ps", "-eo", "pid,comm"],
                         capture_output=True, text=True).stdout
    for ligne in out.splitlines():
        p = ligne.split()
        if len(p) == 2 and p[1].startswith("next"):
            try:
                os.kill(int(p[0]), signal.SIGKILL)
            except ProcessLookupError:
                pass
    time.sleep(3)


def demarrer_front() -> bool:
    shutil.rmtree(APP / ".next", ignore_errors=True)
    subprocess.Popen(
        ["npm", "run", "dev:plateforme"], cwd=RACINE,
        stdout=open("/tmp/dds-front-mut.log", "w"), stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    for _ in range(60):
        time.sleep(5)
        try:
            urllib.request.urlopen(f"{FRONT}/agent", timeout=90)
            return True
        except Exception:
            continue
    return False


def sonde() -> tuple[str, str]:
    """Retourne (marqueur, chemin final) après visite de /agent en admin."""
    r = subprocess.run(["node", "/root/don-de-sang/scripts/sonde-mutant.js"],
                       capture_output=True, text=True, timeout=300)
    marqueur, chemin = "ERREUR", "ERREUR"
    for l in r.stdout.splitlines():
        if l.startswith("marqueur="):
            marqueur = l.split("=", 1)[1].strip()
        if l.startswith("chemin="):
            chemin = l.split("=", 1)[1].strip()
    if marqueur == "ERREUR":
        print(r.stdout[-800:], r.stderr[-400:])
    return marqueur, chemin


def main() -> None:
    octets = CIBLE.read_bytes()
    texte = octets.decode("utf-8")
    assert ANCRE in texte, f"ancre introuvable dans {CIBLE} — mutant vide"
    avant = empreinte()

    try:
        CIBLE.write_text(texte.replace(ANCRE, MUTANT), encoding="utf-8")
        print("1. Mutant écrit (garde de l'espace agent neutralisé).")
        tuer_front()
        if not demarrer_front():
            print("   ABANDON : le front n'a pas redémarré.")
            return
        print("2. Front redémarré sur un .next vide.")

        marqueur, chemin = sonde()
        print(f"3. marqueur={marqueur}  chemin={chemin}")
        if marqueur != "pose":
            print("   NON CONCLUANT : le mutant n'est pas servi, "
                  "aucun verdict possible sur le test.")
            return
        if chemin.startswith("/agent"):
            print("   MUTANT TUABLE : sans le garde, l'admin entre dans /agent.")
            # Un mutant « tuable » n'est pas un mutant TUÉ : seule la suite
            # exécutée sous mutation peut le prouver.
            r = subprocess.run(
                ["node", "scripts/verif-espaces.js", "/tmp/mut-shots"],
                cwd=RACINE, capture_output=True, text=True, timeout=900)
            for l in r.stdout.splitlines():
                if "admin sur /agent" in l or "ECHEC" in l or "passent" in l:
                    print("     " + l.strip())
            print(f"   => suite exit={r.returncode} : "
                  f"{'MUTANT TUÉ' if r.returncode != 0 else 'MUTANT SURVIVANT'}")
        else:
            print("   MUTANT SURVIVANT : un AUTRE mécanisme redirige "
                  f"(chemin={chemin}) ; le garde de Coquille n'est pas seul.")
    finally:
        CIBLE.write_bytes(octets)
        tuer_front()
        demarrer_front()
        apres = empreinte()
        print(f"4. arbre {avant} -> {apres} "
              f"({'restauré' if avant == apres else 'DIVERGENT'})")


if __name__ == "__main__":
    main()
