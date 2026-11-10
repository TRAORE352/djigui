"use client";
/**
 * Aide ponctuelle : une pastille « ! » posée contre un libellé ou un
 * bouton, qui ouvre une courte explication au clic.
 *
 * Pourquoi ce composant existe
 * ----------------------------
 * Un écran de travail est utilisé cent fois par jour. Les phrases
 * d'explication imprimées en permanence sous chaque champ servent les
 * trois premiers jours, puis deviennent du bruit que l'œil doit franchir
 * à chaque passage. On garde donc l'explication, mais on la met SOUS la
 * pastille : l'écran respire, et l'aide reste à un clic.
 *
 * Règles de rédaction du contenu (tenues par le code, pas par la bonne
 * volonté) :
 *   - texte justifié, césure activée : un bloc court justifié sans
 *     césure se troue de lézardes blanches ;
 *   - aucun tiret cadratin, aucun emoji : `nettoyer()` remplace les
 *     tirets par de la ponctuation ordinaire et retire les pictogrammes ;
 *   - deux phrases au maximum à l'usage : ce n'est pas un manuel.
 *
 * Comportement : une seule aide ouverte à la fois, fermeture à la touche
 * Échap, au clic extérieur et au défilement. Le panneau est positionné en
 * `fixed` à partir du rectangle du bouton, donc il ne se fait jamais
 * rogner par le `overflow: hidden` d'une carte.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/** Largeur du panneau ; en dessous de cette largeur d'écran il s'étale. */
const LARGEUR = 320;
const MARGE = 12;

/**
 * Retire d'un texte d'aide ce que la charte interdit.
 *
 * Les tirets cadratins et demi-cadratins employés comme incise rendent un
 * texte justifié bancal et ne se lisent pas de la même façon selon les
 * polices : on les ramène à une ponctuation ordinaire. Les emojis sont
 * retirés : ce sont des écrans de santé publique, pas une messagerie.
 */
export function nettoyer(texte: string): string {
  return texte
    // Tiret cadratin ou demi-cadratin entouré d'espaces : devient virgule.
    .replace(/\s+[—–]\s+/g, ", ")
    // Tiret restant collé : simple espace.
    .replace(/[—–]/g, " ")
    // Pictogrammes et symboles décoratifs.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function Aide({ titre, children, etiquette }: {
  /** Titre court du panneau ; par défaut, celui de l'élément aidé. */
  titre?: string;
  /** L'explication. Une ou deux phrases. */
  children: string;
  /** Ce que le bouton annonce aux lecteurs d'écran. */
  etiquette: string;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [place, setPlace] = useState<{ haut: number; gauche: number } | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);

  /** Place le panneau sous le bouton, rabattu dans la fenêtre. */
  const positionner = useCallback(() => {
    const b = bouton.current?.getBoundingClientRect();
    if (!b) return;
    const largeur = Math.min(LARGEUR, window.innerWidth - MARGE * 2);
    // Centré sous la pastille, puis ramené dans les marges de l'écran.
    let gauche = b.left + b.width / 2 - largeur / 2;
    gauche = Math.max(MARGE, Math.min(gauche, window.innerWidth - largeur - MARGE));
    setPlace({ haut: b.bottom + 8, gauche });
  }, []);

  useLayoutEffect(() => {
    if (!ouvert) return;
    positionner();
  }, [ouvert, positionner]);

  useEffect(() => {
    if (!ouvert) return;

    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") { setOuvert(false); bouton.current?.focus(); }
    }
    function surClic(e: MouseEvent) {
      const cible = e.target as Node;
      if (panneau.current?.contains(cible) || bouton.current?.contains(cible)) return;
      setOuvert(false);
    }
    // Le panneau est en `fixed` : au défilement il se décrocherait de sa
    // pastille. On le referme plutôt que de le laisser flotter.
    function surDefilement() { setOuvert(false); }

    document.addEventListener("keydown", surTouche);
    document.addEventListener("mousedown", surClic);
    window.addEventListener("scroll", surDefilement, true);
    window.addEventListener("resize", positionner);
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.removeEventListener("mousedown", surClic);
      window.removeEventListener("scroll", surDefilement, true);
      window.removeEventListener("resize", positionner);
    };
  }, [ouvert, positionner]);

  const texte = nettoyer(children);

  return (
    <>
      <button
        ref={bouton}
        type="button"
        className={`aide__pastille${ouvert ? " aide__pastille--ouverte" : ""}`}
        aria-label={`Explication : ${etiquette}`}
        aria-expanded={ouvert}
        aria-controls={ouvert ? id : undefined}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOuvert((v) => !v); }}
      >
        <span aria-hidden="true">!</span>
      </button>

      {ouvert && place && (
        <div
          ref={panneau}
          id={id}
          role="dialog"
          aria-label={`Explication : ${etiquette}`}
          className="aide__panneau"
          style={{ top: place.haut, left: place.gauche, width: Math.min(LARGEUR, 9999) }}
        >
          <p className="aide__titre">{titre ?? etiquette}</p>
          <p className="aide__texte">{texte}</p>
        </div>
      )}
    </>
  );
}

/**
 * Libellé suivi de sa pastille d'aide, sur la même ligne de base.
 *
 * Évite de répéter partout un `rang` avec un `gap` : la pastille doit
 * toujours être collée à ce qu'elle explique, jamais poussée au bout de
 * la ligne par un `space-between` hérité.
 */
export function AvecAide({ children, aide, titre, etiquette }: {
  children: React.ReactNode;
  aide: string;
  titre?: string;
  etiquette: string;
}) {
  return (
    <span className="avec-aide">
      {children}
      <Aide titre={titre} etiquette={etiquette}>{aide}</Aide>
    </span>
  );
}
