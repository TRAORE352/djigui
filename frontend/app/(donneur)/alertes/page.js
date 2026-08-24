'use client';
// =====================================================================
//  E6 · Mes alertes.
//  Page d'action : répondre se fait sur la carte même, sans détour par
//  E7 (qui reste la voie pour lire le message complet du centre et
//  l'adresse). La réponse peut être changée tant que l'alerte est
//  ouverte (upsert côté service) — « Changer ma réponse » rouvre les
//  deux boutons sur la carte. Décliner reste aussi simple et respecté
//  qu'accepter : même poids visuel, aucun reproche.
// =====================================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check, ArrowRight } from 'lucide-react';
import { mesAlertesDonneur, monProfil, repondreAlerteDonneur } from '@/lib/api';
import BlocGroupe from '../../composants/BlocGroupe';
import Etat from '../../composants/Etat';
import Bouton from '../../composants/Bouton';
import LogoPulsant from '../../composants/LogoPulsant';
import { MessageErreur } from '../../composants/Message';
import { LignesEnAttente } from '../../composants/Squelette';
import { dateCourte, dateLongue, pluriel } from '@/lib/format';

const MOTIFS = [
  { cle: 'don_trop_recent', mot: 'Don trop récent' },
  { cle: 'absent_de_la_ville', mot: 'Absent de la ville' },
  { cle: 'raison_de_sante', mot: 'Raison de santé' },
  { cle: 'autre', mot: 'Autre' }
];
const MOTIF_MOT = Object.fromEntries(MOTIFS.map((m) => [m.cle, m.mot]));

export default function MesAlertes() {
  const [profil, setProfil] = useState(null);
  const [alertes, setAlertes] = useState(null);
  const [erreur, setErreur] = useState('');
  const mouvementReduit = useReducedMotion();

  useEffect(() => { monProfil().then(setProfil).catch(() => setProfil(null)); }, []);
  useEffect(() => {
    mesAlertesDonneur()
      .then((resultat) => setAlertes(resultat.alertes))
      .catch((probleme) => setErreur(probleme.message));
  }, []);

  function appliquerReponse(id, reponse, motif) {
    setAlertes((avant) => avant.map((a) => a.id_alerte === id
      ? { ...a, reponse, motif_refus: motif, date_reponse: new Date().toISOString() }
      : a));
  }

  if (erreur) {
    return <main className="page-telephone"><MessageErreur>{erreur}</MessageErreur></main>;
  }
  if (!alertes) {
    return <main className="page-telephone pile-l"><LignesEnAttente /></main>;
  }

  if (alertes.length === 0) {
    return (
      <main className="page-telephone pile-l">
        <div className="etat-vide pile" style={{ textAlign: 'center', alignItems: 'center' }}>
          <LogoPulsant taille={56} />
          <h1 className="lead">Aucun appel au don pour l&rsquo;instant.</h1>
          {!profil?.groupe_sanguin ? (
            <p className="appui">
              Votre groupe sanguin n&rsquo;est pas encore connu. Le centre le précisera lors
              de votre prochaine visite, et vous recevrez alors les appels concernant votre
              groupe.
            </p>
          ) : profil?.eligibilite && !profil.eligibilite.eligible && profil.date_prochaine_eligibilite ? (
            <p className="appui">
              Vous recevrez les appels au don à partir du {dateLongue(profil.date_prochaine_eligibilite)} :
              les centres n&rsquo;appellent que les donneurs qui peuvent donner ce jour-là.
            </p>
          ) : (
            <p className="appui">
              Vous serez prévenu dès qu&rsquo;un centre manquera de sang
              {profil?.groupe_sanguin ? ` ${profil.groupe_sanguin}` : ' de votre groupe'}.
              En attendant, vérifiez que votre numéro est à jour.
            </p>
          )}
          <a href="/compte" className="bouton bouton-secondaire bouton-large">
            Vérifier mes numéros
          </a>
        </div>
      </main>
    );
  }

  const actives = alertes.filter((a) => a.statut !== 'cloturee');
  const historique = alertes.filter((a) => a.statut === 'cloturee');
  const attendent = actives.filter((a) => !a.reponse).length;

  const entree = (rang) => mouvementReduit ? {} : {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.06 * rang, duration: 0.35, ease: 'easeOut' }
  };

  return (
    <main className="page-telephone pile-l">
      <div className="pile-s">
        <h1 className="titre">
          {pluriel(alertes.length, 'appel au don', 'appels au don')}
        </h1>
        {attendent > 0 && (
          <p className="appui">
            {attendent === 1 ? '1 attend votre réponse.' : `${attendent} attendent votre réponse.`}
          </p>
        )}
      </div>

      {actives.length > 0 && (
        <div className="pile-s">
          <span className="etiquette">Appels en cours</span>
          <div className="pile" style={{ gap: 'var(--e4)' }}>
            {actives.map((alerte, rang) => (
              <motion.div key={alerte.id_alerte} {...entree(rang)}>
                <CarteAlerte alerte={alerte} mouvementReduit={mouvementReduit}
                             onReponse={appliquerReponse} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {historique.length > 0 && (
        <div className="pile-s">
          <span className="etiquette">Historique</span>
          <div className="pile" style={{ gap: 'var(--e4)' }}>
            {historique.map((alerte, rang) => (
              <motion.div key={alerte.id_alerte} {...entree(actives.length + rang)}>
                <CarteAlerte alerte={alerte} mouvementReduit={mouvementReduit}
                             onReponse={appliquerReponse} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function pastilleInfo(alerte) {
  if (alerte.statut === 'cloturee' && !alerte.reponse) return { ton: 'neutre', mot: 'Délai passé' };
  if (alerte.reponse === 'je_viens') return { ton: 'seve', mot: 'Vous venez' };
  if (alerte.reponse === 'je_ne_peux_pas') {
    return { ton: 'neutre', mot: `Vous ne pouvez pas venir · ${MOTIF_MOT[alerte.motif_refus] || 'Autre'}` };
  }
  return { ton: 'ocre', mot: 'Votre réponse est attendue' };
}

function CarteAlerte({ alerte, mouvementReduit, onReponse }) {
  const [motifOuvert, setMotifOuvert] = useState(false);
  const [modifier, setModifier] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const active = alerte.statut !== 'cloturee';
  const montrerBoutons = active && (!alerte.reponse || modifier);
  const { ton, mot } = pastilleInfo(alerte);

  async function envoyer(reponse, motif) {
    setEnCours(true); setErreur('');
    try {
      await repondreAlerteDonneur(alerte.id_alerte, { reponse, motif_refus: motif });
      setMotifOuvert(false);
      setModifier(false);
      onReponse(alerte.id_alerte, reponse, motif);
    } catch (probleme) {
      setErreur(probleme.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={active ? 'carte-secondaire pile-l' : 'carte pile-l carte-attenuee'}>
      <div className="rang" style={{ gap: 'var(--e4)' }}>
        <BlocGroupe groupe={alerte.groupe_cible} taille="m" />
        <div className="pile-s" style={{ flex: 1 }}>
          <span style={{ fontWeight: 600 }}>{alerte.structure_nom}</span>
          <span className="petit">{alerte.structure_ville}</span>
        </div>
      </div>

      <div className="rang-espace">
        <span className="petit">Reçu le {dateCourte(alerte.date_envoi)}</span>
        {active && alerte.date_limite && (
          <span className="petit mono">
            avant le {dateCourte(alerte.date_limite)}
            {alerte.heure_limite ? ` ${alerte.heure_limite.slice(0, 5)}` : ''}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {montrerBoutons ? (
          <motion.div
            key="boutons" className="pile-s"
            initial={mouvementReduit ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={mouvementReduit ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {!motifOuvert ? (
              <>
                <div className="rang" style={{ gap: 'var(--e3)' }}>
                  <Bouton variante="principal" style={{ flex: 1 }} enCours={enCours}
                          motEnCours="Envoi" onClick={() => envoyer('je_viens', null)}>
                    Je viens
                  </Bouton>
                  <Bouton variante="secondaire" className="bouton-souleve" style={{ flex: 1 }} disabled={enCours}
                          onClick={() => setMotifOuvert(true)}>
                    Je ne peux pas
                  </Bouton>
                </div>
                {modifier && (
                  <button type="button" className="bouton-fantome" style={{ alignSelf: 'flex-start' }}
                          onClick={() => setModifier(false)}>
                    Annuler
                  </button>
                )}
              </>
            ) : (
              <div className="pile-s">
                <span className="champ-etiquette">Pourquoi ne pouvez-vous pas venir ?</span>
                <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
                  {MOTIFS.map((motif) => (
                    <button key={motif.cle} type="button" className="touche" disabled={enCours}
                            onClick={() => envoyer('je_ne_peux_pas', motif.cle)}>
                      {motif.mot}
                    </button>
                  ))}
                </div>
                <button type="button" className="bouton-fantome" style={{ alignSelf: 'flex-start' }}
                        disabled={enCours} onClick={() => setMotifOuvert(false)}>
                  Retour
                </button>
              </div>
            )}
            <MessageErreur>{erreur}</MessageErreur>
          </motion.div>
        ) : (
          <motion.div
            key="etat" className="pile-s"
            initial={mouvementReduit ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <span className="rang" style={{ gap: 'var(--e2)' }}>
              {alerte.reponse === 'je_viens' && !mouvementReduit && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.25, 1], opacity: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  style={{ display: 'inline-flex', color: 'var(--seve)' }}
                >
                  <Check size={18} strokeWidth={2.25} aria-hidden="true" />
                </motion.span>
              )}
              <Etat ton={ton}>{mot}</Etat>
            </span>

            {alerte.reponse === 'je_viens' && (
              <div className="pile-s">
                <p className="appui">
                  {alerte.creneau_prefere
                    ? `Créneau choisi : ${alerte.creneau_prefere}.`
                    : 'Merci — votre venue compte.'}
                </p>
                {!alerte.creneau_prefere && active && (
                  <Link href={`/alertes/${alerte.id_alerte}/disponibilite`}
                        className="bouton bouton-secondaire bouton-compact bouton-souleve"
                        style={{ alignSelf: 'flex-start' }}>
                    Indiquer ma disponibilité
                  </Link>
                )}
              </div>
            )}
            {alerte.reponse === 'je_ne_peux_pas' && (
              <p className="appui">Merci de nous prévenir, ce sera pour une prochaine fois.</p>
            )}

            {active && alerte.reponse && (
              <button type="button" className="bouton-fantome" style={{ alignSelf: 'flex-start' }}
                      onClick={() => setModifier(true)}>
                Changer ma réponse
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Link href={`/alertes/${alerte.id_alerte}`}
            className="bouton bouton-secondaire bouton-compact bouton-souleve"
            style={{ alignSelf: 'flex-start' }}>
        Voir le message du centre
        <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </div>
  );
}
