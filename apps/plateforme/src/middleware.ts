import { NextResponse, type NextRequest } from "next/server";
import { cheminServi, DEPLOIEMENT, EST_DEDIE, IDENTITE } from "@/lib/espace";

/**
 * Chaque adresse ne sert que son espace.
 *
 * Masquer un lien ne protège rien : une adresse se tape. Sur un déploiement
 * dédié, un chemin qui appartient à l'AUTRE espace est renvoyé vers la porte
 * de celui-ci — on refuse, on ne cache pas, et on ne glisse jamais un compte
 * dans un espace qui n'est pas le sien.
 *
 * Le contrôle réel des droits reste fait par le backend à chaque appel ;
 * ici on empêche seulement une adresse d'exister là où elle n'a pas lieu d'être.
 */
export function middleware(requete: NextRequest) {
  if (!EST_DEDIE) return NextResponse.next();

  const { pathname } = requete.nextUrl;
  if (cheminServi(pathname)) return NextResponse.next();

  // La racine d'un déploiement dédié mène directement à sa porte : il n'y a
  // pas de portail à choisir quand l'adresse a déjà choisi.
  const destination = requete.nextUrl.clone();
  destination.pathname = IDENTITE[DEPLOIEMENT].porte;
  return NextResponse.redirect(destination, 307);
}

export const config = {
  // On laisse passer les ressources : seules les pages sont concernées.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
