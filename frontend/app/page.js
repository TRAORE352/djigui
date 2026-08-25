'use client';
// =====================================================================
//  E1 · Accueil public.
//  Tient sur un seul écran mobile, se clôt après « Se connecter ».
//  Le détail (étapes, explication, installation) vit dans un panneau
//  déclenché par la pastille « ! » du héro — c'est l'unique aide
//  dépliable de tout l'espace donneur (règle absolue 9).
// =====================================================================
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { ArrowRight, Smartphone } from 'lucide-react';
import Ouverture from './composants/Ouverture';
import PanneauInfo from './composants/PanneauInfo';

const TEMPS = [
  'Vous créez votre compte en trois étapes.',
  'Le centre vous appelle quand votre groupe manque.',
  'Vous venez donner à l’heure qui vous arrange.'
];

export default function Accueil() {
  const mouvementReduit = useReducedMotion();
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const apparition = (rang) => mouvementReduit ? {} : {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 * rang, duration: 0.4, ease: 'easeOut' }
  };

  return (
    <>
      <Ouverture />
      <main className="accueil-cadre">
        <section className="heros">
          <motion.button
            type="button"
            className="heros-pastille"
            aria-label="En savoir plus sur DJIGUI"
            onClick={() => setPanneauOuvert(true)}
            animate={mouvementReduit ? {} : { opacity: [1, 0.55, 1], scale: [1, 1.08, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            !
          </motion.button>

          <motion.div
            className="heros-halo"
            aria-hidden="true"
            animate={mouvementReduit ? {} : { scale: [1, 1.15, 1], opacity: [0.28, 0.5, 0.28] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="heros-logo"
            initial={mouvementReduit ? false : { opacity: 0, scale: 0.82, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          >
            <motion.div
              animate={mouvementReduit ? {} : { scale: [1, 1.06, 1, 1.03, 1], y: [0, -4, -1, -3, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.7, repeatDelay: 0.5 }}
            >
              <Image
                src="/logo/logo_djigui.png"
                alt="DJIGUI"
                width={176}
                height={176}
                priority
                className="heros-logo-image"
              />
            </motion.div>
          </motion.div>

          <svg className="heros-courbe" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M0,32 C 220,92 420,0 720,40 C 1020,80 1240,4 1440,46 L1440,100 L0,100 Z"
              fill="var(--fond)"
            />
          </svg>
        </section>

        <div className="heros-bas">
          <motion.div className="pile-s" {...apparition(0)}>
            <h1 className="heros-titre">
              Donnez votre sang,{' '}
              <span className="heros-titre-accent">sauvez une vie</span>.
            </h1>
            <p className="heros-sous-titre">
              DJIGUI vous prévient quand votre groupe est attendu près de chez vous.
              Vous répondez en une touche.
            </p>
          </motion.div>

          <motion.div className="pile-s" {...apparition(1)}>
            <motion.div
              animate={mouvementReduit ? {} : { scale: [1, 1.03, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Link href="/connexion" className="bouton-heros">
                <span className="bouton-heros-mot">Je me connecte pour sauver des vies</span>
                <ArrowRight size={20} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </motion.div>
            <Link href="/inscription" className="heros-invite">
              <span className="heros-invite-intro">Pas encore inscrit ?</span>
              <span className="heros-invite-accent">Enregistrez-vous gratuitement en 3 étapes</span>
            </Link>
          </motion.div>
        </div>
      </main>

      <PanneauInfo
        ouvert={panneauOuvert}
        onFermer={() => setPanneauOuvert(false)}
        titre="Comment DJIGUI fonctionne"
      >
        <div className="pile-l">
          <span className="etiquette">En trois étapes</span>
          <ol className="pile" style={{ listStyle: 'none', padding: 0 }}>
            {TEMPS.map((temps, rang) => (
              <li key={temps} className="rang panneau-etape-centree" style={{ alignItems: 'flex-start' }}>
                <span className="pastille-etape" aria-hidden="true">{rang + 1}</span>
                <span>{temps}</span>
              </li>
            ))}
          </ol>
        </div>

        <hr className="filet" />

        <div className="pile-l">
          <h3 className="titre" style={{ fontSize: 'var(--t-titre-s)' }}>Comment ça marche exactement ?</h3>
          <div className="pile panneau-texte-justifie">
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
        </div>

        <hr className="filet" />

        <div className="pile-s">
          <span className="rang" style={{ fontWeight: 600, fontSize: 'var(--t-appui)' }}>
            <Smartphone size={18} strokeWidth={1.75} aria-hidden="true" />
            Installer DJIGUI sur votre écran d&rsquo;accueil
          </span>
          <p className="petit panneau-texte-justifie">
            Aucune boutique d&rsquo;applications, aucun téléchargement.
            Deux étapes, moins d&rsquo;une minute.
          </p>
          <Link href="/installation" className="lien" style={{ fontSize: 'var(--t-appui)' }} onClick={() => setPanneauOuvert(false)}>
            Voir la marche à suivre
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      </PanneauInfo>
    </>
  );
}
