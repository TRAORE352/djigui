'use client';
// =====================================================================
//  E5 · Carte de donneur.
//  L'écran que le donneur montre à un agent. Il dit une seule chose :
//  si l'on peut donner, et à partir de quand. Le bloc groupe ne change
//  jamais : c'est la phrase d'état qui porte la différence.
// =====================================================================
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarPlus } from 'lucide-react';
import { monProfil, telechargerRappel } from '@/lib/api';
import { dateLongue, pluriel } from '@/lib/format';
import BlocGroupe from '../../composants/BlocGroupe';
import Etat from '../../composants/Etat';
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
  const [compteur, setCompteur] = useState(0);
  const mouvementReduit = useReducedMotion();

  useEffect(() => {
    monProfil().then(setProfil).catch((probleme) => setErreur(probleme.message));
  }, []);

  // Le nombre de dons monte jusqu'à sa valeur : le geste dit qu'il
  // s'agit d'un compte qui grandit, pas d'un chiffre figé.
  useEffect(() => {
    if (!profil) return;
    if (mouvementReduit || profil.nb_dons === 0) { setCompteur(profil.nb_dons); return; }
    const depart = performance.now();
    let image;
    const avancer = (instant) => {
      const part = Math.min((instant - depart) / 400, 1);
      setCompteur(Math.round(part * profil.nb_dons));
      if (part < 1) image = requestAnimationFrame(avancer);
    };
    image = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(image);
  }, [profil, mouvementReduit]);

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

  return (
    <motion.main
      className="page-telephone pile-l"
      initial={mouvementReduit ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* En-tête de pièce, pas d'application. */}
      <div className="rang-espace">
        <span className="etiquette">Carte de donneur</span>
        <span className="mono" style={{ fontSize: 'var(--t-appui)' }}>{profil.code_donneur}</span>
      </div>
      <p className="petit" style={{ textAlign: 'right' }}>
        Montrez ce numéro à l&rsquo;agent du centre lors de votre passage.
      </p>

      <div className="carte pile-l">
        <div className="rang" style={{ gap: 'var(--e5)' }}>
          <BlocGroupe groupe={profil.groupe_sanguin} taille="xl" />
          <div className="pile-s">
            <p className="titre" style={{ lineHeight: 1.15 }}>
              {profil.prenom}<br />{profil.nom}
            </p>
            <p className="appui">{profil.zone}, {profil.ville}</p>
          </div>
        </div>

        <hr className="filet" />

        {/* La phrase d'état porte la différence. */}
        <div className="pile-s">
          {!groupeConnu && (
            <p className="appui">
              Votre groupe sanguin sera précisé par le centre lors de votre
              prochaine visite.
            </p>
          )}

          {eligibilite.eligible ? (
            <>
              <Etat ton="seve">Vous pouvez donner dès aujourd&rsquo;hui.</Etat>
              {groupeConnu && (
                <p className="appui">
                  Si un centre appelle pour le groupe {profil.groupe_sanguin},
                  vous recevrez l&rsquo;alerte.
                </p>
              )}
            </>
          ) : eligibilite.jours_restants > 0 ? (
            <>
              <Etat ton="ocre">
                Vous pourrez donner à partir du {dateLongue(profil.date_prochaine_eligibilite)}.
              </Etat>
              <p className="appui">
                Dans {pluriel(eligibilite.jours_restants, 'jour')}.
              </p>
              {profil.date_dernier_don && (
                <p className="appui">
                  {phraseDelai(moisEntreLesDeuxDates(profil.date_dernier_don, profil.date_prochaine_eligibilite))}
                </p>
              )}
            </>
          ) : (
            <>
              <Etat ton="ocre">Le centre décidera sur place si vous pouvez donner.</Etat>
              {eligibilite.raisons.length > 0 && (
                <p className="appui">{raisonPrincipale(eligibilite.raisons)}</p>
              )}
            </>
          )}
        </div>

        <div>
          {profil.date_dernier_don ? (
            <div className="ligne-fait">
              <span className="appui">Dernier don</span>
              <span className="valeur">{dateLongue(profil.date_dernier_don)}</span>
            </div>
          ) : (
            <div className="ligne-fait">
              <span className="appui">Votre premier don s&rsquo;inscrira ici.</span>
            </div>
          )}
          {profil.date_prochaine_eligibilite && (
            <div className="ligne-fait">
              <span className="appui">Vous pourrez donner à partir du</span>
              <span className="valeur">{dateLongue(profil.date_prochaine_eligibilite)}</span>
            </div>
          )}
          <div className="ligne-fait">
            <span className="appui">Dons enregistrés</span>
            <span className="valeur">{compteur}</span>
          </div>
        </div>
      </div>

      {profil.date_prochaine_eligibilite && (
        <Bouton variante="principal" large enfantIcone={CalendarPlus} onClick={ajouterRappel}>
          Ajouter le rappel à mon agenda
        </Bouton>
      )}
      <MessageErreur>{messageRappel}</MessageErreur>

      {/* Mention permanente de responsabilité médicale (règle RG6). */}
      <p className="petit">
        Cette information est indicative. La décision de prélever appartient au
        personnel médical du centre, après examen sur place.
      </p>
    </motion.main>
  );
}
