'use client';
// =====================================================================
//  E1 · Accueil public.
//  Dit en une phrase ce que fait DJIGUI et n'offre qu'un seul chemin :
//  créer un compte. La connexion reste un lien, jamais concurrente
//  du bouton. Apparition en cascade au premier chargement.
// =====================================================================
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Smartphone, ArrowRight, ChevronDown } from 'lucide-react';
import Ouverture from './composants/Ouverture';

const TEMPS = [
  'Vous créez votre compte en trois étapes.',
  'Le centre vous appelle quand votre groupe manque.',
  'Vous venez donner à l\u2019heure qui vous arrange.'
];

export default function Accueil() {
  const mouvementReduit = useReducedMotion();
  const [detailOuvert, setDetailOuvert] = useState(false);
  const apparition = (rang) => mouvementReduit ? {} : {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.06 * rang, duration: 0.35, ease: 'easeOut' }
  };

  return (
    <>
      <Ouverture />
      <main className="page-telephone sans-barre pile-l">
        <motion.h1 className="mot-ecrit" {...apparition(0)}>DJIGUI</motion.h1>

        <motion.div className="pile-s" {...apparition(1)}>
          <p className="lead">
            Quand un centre de transfusion manque de sang de votre groupe,
            il vous prévient.
          </p>
          <p className="appui">
            Vous recevez un appel au don seulement si vous pouvez donner ce
            jour-là. Vous répondez oui ou non en une touche.
          </p>
        </motion.div>

        <motion.hr className="filet" {...apparition(2)} />

        <motion.ol className="pile" style={{ listStyle: 'none', padding: 0 }} {...apparition(3)}>
          {TEMPS.map((temps, rang) => (
            <li key={temps} className="rang" style={{ alignItems: 'flex-start' }}>
              <span className="mono petit" style={{ minWidth: 18, paddingTop: 2 }}>{rang + 1}</span>
              <span>{temps}</span>
            </li>
          ))}
        </motion.ol>

        <motion.div className="pile-s" {...apparition(3)}>
          <button type="button" className="lien" style={{ fontSize: 'var(--t-appui)' }}
                  aria-expanded={detailOuvert}
                  onClick={() => setDetailOuvert(!detailOuvert)}>
            Comment ça marche exactement ?
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true"
                         style={{ transform: detailOuvert ? 'rotate(180deg)' : 'none' }} />
          </button>
          {detailOuvert && (
            <div className="pile-s">
              <p className="appui">
                Quand un centre manque de sang d&rsquo;un groupe, il choisit les donneurs de ce
                groupe, dans les zones qu&rsquo;il cible, et qui peuvent donner ce jour-là selon
                le délai de repos entre deux dons.
              </p>
              <p className="appui">
                Vous ne recevez donc pas tous les appels : seulement ceux qui concernent votre
                groupe et votre zone, au moment où vous êtes en mesure de donner.
              </p>
              <p className="appui">
                Répondre « je viens » signale au centre que vous passerez ; vous pouvez ensuite
                préciser un créneau et comment vous vous déplacerez.
              </p>
              <p className="appui">
                Vous pouvez toujours répondre « je ne peux pas » : ce n&rsquo;est jamais un
                engagement, et cela ne change rien à vos prochains appels.
              </p>
              <p className="appui">
                La décision de vous prélever revient toujours au personnel médical du centre,
                sur place, le jour du don.
              </p>
              <p className="appui">
                Vos coordonnées ne servent qu&rsquo;aux appels au don de ce centre : elles ne
                sont ni vendues ni partagées.
              </p>
            </div>
          )}
        </motion.div>

        <motion.div className="pile-s" {...apparition(4)}>
          <Link href="/inscription" className="bouton bouton-principal bouton-large">
            Créer mon compte
          </Link>
          <div style={{ textAlign: 'center' }}>
            <Link href="/connexion" className="lien">Je me connecte</Link>
          </div>
        </motion.div>

        <motion.hr className="filet" {...apparition(5)} />

        <motion.div className="pile-s" {...apparition(6)}>
          <span className="rang" style={{ fontWeight: 600, fontSize: 'var(--t-appui)' }}>
            <Smartphone size={18} strokeWidth={1.75} aria-hidden="true" />
            Installer DJIGUI sur votre écran d&rsquo;accueil
          </span>
          <p className="petit">
            Aucune boutique d&rsquo;applications, aucun téléchargement.
            Deux étapes, moins d&rsquo;une minute.
          </p>
          <Link href="/installation" className="lien" style={{ fontSize: 'var(--t-appui)' }}>
            Voir la marche à suivre
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </motion.div>
      </main>
    </>
  );
}
