"use client";
/**
 * Saisie libre d'un lieu de collecte sur carte (OpenStreetMap).
 *
 * L'agent tape le nom d'un lieu hors centre de santé (une école, un marché…),
 * les résultats de Nominatim s'affichent sur la carte, et il choisit. Aucune
 * clé d'API : OpenStreetMap est gratuit.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search } from "lucide-react";
import Bouton from "@/components/Bouton";

type Resultat = {
  lat: string;
  lon: string;
  display_name: string;
};

/** Centre de la carte au démarrage : Ouagadougou. */
const CENTRE: [number, number] = [12.36, -1.53];

export default function RechercheLieu({ onChoisir }: { onChoisir: (nom: string) => void }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const marqueurs = useRef<L.CircleMarker[]>([]);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // La carte est montée une seule fois ; Leaflet exige un conteneur mesuré.
  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    carte.current = L.map(conteneur.current).setView(CENTRE, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 18,
    }).addTo(carte.current);
    return () => { carte.current?.remove(); carte.current = null; };
  }, []);

  async function chercher() {
    const q = recherche.trim();
    if (q.length < 3 || !carte.current) return;
    setEnCours(true);
    try {
      const rep = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=bf&limit=5`,
        { headers: { Accept: "application/json" } },
      );
      const donnees = (await rep.json()) as Resultat[];
      setResultats(donnees);

      marqueurs.current.forEach((m) => m.remove());
      marqueurs.current = [];
      const bornes: [number, number][] = [];
      for (const r of donnees) {
        const p: [number, number] = [Number(r.lat), Number(r.lon)];
        bornes.push(p);
        marqueurs.current.push(
          L.circleMarker(p, { radius: 7, color: "#0165FF", fillColor: "#0165FF", fillOpacity: 0.9 })
            .addTo(carte.current!),
        );
      }
      if (bornes.length) carte.current.fitBounds(bornes, { padding: [30, 30] });
    } catch {
      setResultats([]);
    } finally {
      setEnCours(false);
    }
  }

  function choisir(r: Resultat) {
    setChoisi(r.display_name);
    onChoisir(r.display_name);
  }

  return (
    <div className="pile">
      <div className="rang" style={{ alignItems: "stretch" }}>
        <input
          className="champ__saisie"
          style={{ flex: 1 }}
          value={recherche}
          placeholder="Tapez le nom du lieu (école, marché…)"
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void chercher(); } }}
        />
        <Bouton variante="secondaire" compact icone={<Search size={16} aria-hidden="true" />}
                onClick={() => void chercher()} enCours={enCours}>
          Chercher
        </Bouton>
      </div>

      <div ref={conteneur} className="carte-lieu" style={{ height: 220, borderRadius: 12 }} aria-label="Carte du lieu" />

      {choisi && (
        <p className="appui" role="status">
          <MapPin size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> {choisi}
        </p>
      )}

      {resultats.map((r, i) => (
        <button
          key={i}
          type="button"
          className="lien-action"
          style={{ textAlign: "left", justifyContent: "flex-start" }}
          onClick={() => choisir(r)}
        >
          <MapPin size={14} aria-hidden="true" /> {r.display_name}
        </button>
      ))}
    </div>
  );
}
