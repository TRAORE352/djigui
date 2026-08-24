'use client';
// =====================================================================
//  E5 · Carte de donneur.
//  L'écran que le donneur montre à un agent. Il dit une seule chose :
//  si l'on peut donner, et à partir de quand. Le bloc groupe ne change
//  jamais : c'est la phrase d'état et la pastille de couleur qui
//  portent la différence — jamais un pulse hors du cas « éligible
//  aujourd'hui », pour ne jamais laisser croire à une urgence absente.
// =====================================================================
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarPlus } from 'lucide-react';
import { monProfil, telechargerRappel } from '@/lib/api';
import { dateLongue, pluriel } from '@/lib/format';
import BlocGroupe from '../../composants/BlocGroupe';
import IconeProfil from '../../composants/IconeProfil';
import Bouton from '../../composants/Bouton';
import { MessageErreur } from '../../composants/Message';
import { CarteEnAttente } from '../../composants/Squelette';

const MOTS_NOMBRE = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];

// Le délai réellement appliqué à ce donneur, retrouvé par différence de
// calendrier entre son dernier don et sa prochaine éligibilité (posée par
// le service avec DATE_ADD ... INTERVAL delaiMois MONTH) : la vraie
// valeur du paramètre au moment du don, jamais un chiffre écrit en dur.
function moisEntreLesDeuxDates(debut, fin) {
  const d1 = new Date(debut);
  const d2 = new Date(fin);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

function phraseDelai(mois) {
  const mot = MOTS_NOMBRE[mois] || String(mois);
  const introduction = mois === 1 ? 'd’un mois' : `de ${mot} mois`;
  return `Le corps a besoin ${introduction} pour refaire ses réserves de fer.`;
}

// Une seule ligne, jamais la liste entière : on choisit la raison
// principale plutôt que d'empiler chaque contrainte non tenue.
function raisonPrincipale(raisons) {
  const principale = raisons[0];
  if (principale.code === 'quota_annuel') return 'Vous avez atteint le nombre de dons prévu sur douze mois.';
  if (principale.code === 'poids') return 'Le centre décidera sur place.';
  return principale.phrase;
}

export default function CarteDonneur() {
  const [profil, setProfil] = useState(null);
  const [erreur, setErreur] = useState('');
  const [messageRappel, setMessageRappel] = useState('');
  const mouvementReduit = useReducedMotion();

  useEffect(() => {
    monProfil().then(setProfil).catch((probleme) => setErreur(probleme.message));
  }, []);

  async function ajouterRappel() {
    setMessageRappel('');
    try { await telechargerRappel(); }
    catch (probleme) { setMessageRappel(probleme.message); }
  }

  if (erreur) {
    return <main className="page-telephone"><MessageErreur>{erreur}</MessageErreur></main>;
  }
  if (!profil) {
    return (
      <main className="page-telephone pile-l">
        <span className="etiquette">Carte de donneur</span>
        <CarteEnAttente mot="Votre carte arrive." />
      </main>
    );
  }

  const { eligibilite } = profil;
  const groupeConnu = Boolean(profil.groupe_sanguin);
  const decisionSurPlace = !eligibilite.eligible && eligibilite.jours_restants <= 0
    && eligibilite.raisons.length > 0;

  const entree = (rang) => mouvementReduit ? {} : {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 * rang, duration: 0.4, ease: 'easeOut' }
  };

  return (
    <main className="pile-l" style={{ minHeight: '100dvh', paddingBottom: 'var(--e10)' }}>
      <motion.div className="carte-entete" {...entree(0)}>
        <IconeProfil clair className="carte-entete-icone-profil" />
        <span className="etiquette carte-entete-etiquette">Carte de donneur</span>
        <p className="carte-entete-code mono">{profil.code_donneur}</p>
        <p className="carte-entete-instruction">
          Montrez ce numéro à l&rsquo;agent du centre lors de votre passage.
        </p>
        <div className="carte-entete-identite">
          <p className="carte-entete-nom">{profil.prenom} {profil.nom}</p>
          <p className="carte-entete-zone">{profil.zone}, {profil.ville}</p>
        </div>
        <svg className="carte-entete-courbe" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,40 C 360,110 1080,-30 1440,40 L1440,100 L0,100 Z" fill="var(--fond)" />
        </svg>
      </motion.div>

      <div className="carte-page-corps">
        <motion.div className="carte-principale pile-l" {...entree(1)}>
          <div className="carte-groupe-ligne">
            <motion.div
              initial={mouvementReduit ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
            >
              <BlocGroupe groupe={profil.groupe_sanguin} taille="xl" />
            </motion.div>

            <div className="carte-groupe-colonne">
              {!groupeConnu && (
                <span className="puce-a-preciser">À préciser au centre</span>
              )}

              {eligibilite.eligible ? (
                <span className="pastille-etat ton-seve respire">
                  <span className="point" aria-hidden="true" />
                  Vous pouvez donner dès aujourd&rsquo;hui
                </span>
              ) : eligibilite.jours_restants > 0 ? (
                <span className="pastille-etat ton-ocre">
                  <span className="point" aria-hidden="true" />
                  Dès le {dateLongue(profil.date_prochaine_eligibilite)}
                </span>
              ) : (
                <span className="pastille-etat ton-ocre">
                  <span className="point" aria-hidden="true" />
                  Décision sur place
                </span>
              )}
            </div>
          </div>

          <hr className="filet" />

          <div className="pile-s">
            {!groupeConnu && (
              <p className="appui">
                Votre groupe sanguin sera précisé par le centre lors de votre
                prochaine visite.
              </p>
            )}

            {eligibilite.eligible ? null : eligibilite.jours_restants > 0 ? (
              <>
                <p className="appui">Dans {pluriel(eligibilite.jours_restants, 'jour')}.</p>
                {profil.date_dernier_don && (
                  <p className="appui">
                    {phraseDelai(moisEntreLesDeuxDates(profil.date_dernier_don, profil.date_prochaine_eligibilite))}
                  </p>
                )}
              </>
            ) : decisionSurPlace ? (
              <p className="appui">{raisonPrincipale(eligibilite.raisons)}</p>
            ) : null}
          </div>

          {profil.date_prochaine_eligibilite && (
            <Bouton variante="principal" large enfantIcone={CalendarPlus} onClick={ajouterRappel}>
              Ajouter le rappel à mon agenda
            </Bouton>
          )}
          <MessageErreur>{messageRappel}</MessageErreur>
        </motion.div>

        {/* Mention permanente de responsabilité médicale (règle RG6). */}
        <p className="petit">
          Cette information est indicative. La décision de prélever appartient au
          personnel médical du centre, après examen sur place.
        </p>
      </div>
    </main>
  );
}
