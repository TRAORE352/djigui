'use client';
// =====================================================================
//  E7 · Répondre à un appel au don.
//  Les deux réponses ont le même poids visuel : refuser doit rester
//  aussi facile qu'accepter. Le message du centre vit dans une bulle
//  de messagerie, distincte de ce que l'application ajoute — c'est un
//  vrai message reçu, pas un paragraphe brut.
// =====================================================================
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Clock, MapPin, Phone, Check } from 'lucide-react';
import { detailAlerteDonneur, repondreAlerteDonneur } from '@/lib/api';
import BlocGroupe from '../../../composants/BlocGroupe';
import Etat from '../../../composants/Etat';
import Bouton from '../../../composants/Bouton';
import { MessageErreur } from '../../../composants/Message';
import { LignesEnAttente } from '../../../composants/Squelette';
import { dateLongue, dateHeure } from '@/lib/format';

const MOTIFS = [
  { cle: 'don_trop_recent', mot: 'Don trop récent' },
  { cle: 'absent_de_la_ville', mot: 'Absent de la ville' },
  { cle: 'raison_de_sante', mot: 'Raison de santé' },
  { cle: 'autre', mot: 'Autre raison' }
];
const MOTIF_MOT = Object.fromEntries(MOTIFS.map((m) => [m.cle, m.mot]));

// Jours pleins avant l'échéance de réponse, pour le compte à rebours du
// cadre d'urgence — jamais un chiffre écrit en dur, calculé sur la vraie
// date/heure limite renvoyées par le service.
function joursRestants(dateLimite, heureLimite) {
  const cible = new Date(`${dateLimite}T${heureLimite || '23:59:59'}`);
  return Math.ceil((cible.getTime() - Date.now()) / 86400000);
}

function phraseCompteARebours(jours) {
  if (jours <= 0) return 'Dernier jour pour répondre.';
  if (jours === 1) return 'Plus qu’un jour pour répondre.';
  return `Plus que ${jours} jours pour répondre.`;
}

export default function RepondreAlerte() {
  const { id } = useParams();
  const mouvementReduit = useReducedMotion();
  const [alerte, setAlerte] = useState(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [choisirMotif, setChoisirMotif] = useState(false);
  const [revenir, setRevenir] = useState(false);

  function charger() {
    return detailAlerteDonneur(id).then(setAlerte).catch((probleme) => setErreur(probleme.message));
  }
  useEffect(() => { charger(); }, [id]);

  async function envoyer(reponse, motifRefus) {
    setEnCours(true); setErreur('');
    try {
      await repondreAlerteDonneur(id, { reponse, motif_refus: motifRefus });
      setChoisirMotif(false);
      setRevenir(false);
      await charger();
    } catch (probleme) {
      setErreur(probleme.message);
    } finally {
      setEnCours(false);
    }
  }

  if (erreur && !alerte) {
    return (
      <main className="page-telephone sans-barre pile-l">
        <Link href="/alertes" className="lien"><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Retour aux alertes</Link>
        <MessageErreur>{erreur}</MessageErreur>
      </main>
    );
  }
  if (!alerte) {
    return <main className="page-telephone sans-barre pile-l"><LignesEnAttente /></main>;
  }

  const delaiPasse = alerte.statut === 'cloturee';
  const montrerBoutons = !delaiPasse && (revenir || !alerte.reponse);
  const jours = !delaiPasse ? joursRestants(alerte.date_limite, alerte.heure_limite) : null;
  const critique = jours !== null && jours <= 2;

  const entree = (rang) => mouvementReduit ? {} : {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.07 * rang, duration: 0.35, ease: 'easeOut' }
  };

  return (
    <main className="page-telephone sans-barre pile-l">
      <Link href="/alertes" className="lien">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Retour aux alertes
      </Link>

      <MessageErreur>{erreur}</MessageErreur>

      <motion.div className="rang" style={{ gap: 'var(--e5)' }} {...entree(0)}>
        <BlocGroupe groupe={alerte.groupe_cible} taille="l" />
        <div className="pile-s">
          <span className="titre">Le centre recherche des donneurs {alerte.groupe_cible}</span>
          <span className="appui">{alerte.structure_nom}</span>
        </div>
      </motion.div>

      <motion.div className="bulle-message" {...entree(1)}>
        <p className="bulle-message-entete">{alerte.structure_nom}</p>
        <p className="bulle-message-texte">{alerte.message}</p>
        <span className="bulle-message-horodatage">
          Reçu le {dateHeure(alerte.date_envoi)}
        </span>
      </motion.div>

      <motion.div className="bloc-adresse" {...entree(2)}>
        <MapPin size={20} strokeWidth={1.75} aria-hidden="true" />
        <div className="pile-s">
          <span className="champ-etiquette" style={{ marginBottom: 0 }}>Adresse</span>
          <p className="appui">
            {alerte.structure_nom}, {alerte.structure_ville}
            {alerte.structure_adresse ? ` — ${alerte.structure_adresse}` : ''}
          </p>
          {alerte.structure_horaires && <p className="petit">Horaires : {alerte.structure_horaires}</p>}
          {alerte.structure_telephone && (
            <span className="rang" style={{ gap: 'var(--e2)' }}>
              <Phone size={14} strokeWidth={1.75} aria-hidden="true" style={{ color: 'var(--encre-secondaire)' }} />
              <span className="petit mono">{alerte.structure_telephone}</span>
            </span>
          )}
        </div>
      </motion.div>

      {!delaiPasse ? (
        <motion.div className={critique ? 'encadre encadre-sang' : 'encadre encadre-ocre'} {...entree(3)}>
          <Clock size={20} strokeWidth={1.75} aria-hidden="true"
                 className={`cadre-urgence-icone${critique ? ' respire' : ''}`} />
          <div className="pile-s">
            <span>
              Répondez avant le {dateLongue(alerte.date_limite)}
              {alerte.heure_limite ? ` à ${alerte.heure_limite.slice(0, 5)}` : ''}. Après cette
              date, le centre n&rsquo;attend plus votre réponse.
            </span>
            <span className="cadre-urgence-compte">{phraseCompteARebours(jours)}</span>
          </div>
        </motion.div>
      ) : (
        <motion.div {...entree(3)}>
          <Etat ton="neutre">Le délai de réponse est passé.</Etat>
        </motion.div>
      )}

      {montrerBoutons && !choisirMotif && (
        <motion.div className="pile-s" {...entree(4)}>
          <div className="rang" style={{ gap: 'var(--e3)' }}>
            <Bouton variante="principal" style={{ flex: 1 }} enCours={enCours}
                    motEnCours="Envoi" onClick={() => envoyer('je_viens', null)}>
              Je viens
            </Bouton>
            <Bouton variante="secondaire" className="bouton-souleve" style={{ flex: 1 }} disabled={enCours}
                    onClick={() => setChoisirMotif(true)}>
              Je ne peux pas
            </Bouton>
          </div>
          <p className="petit" style={{ textAlign: 'center' }}>
            Répondre ne vous engage pas à donner : le personnel médical décidera sur place.
          </p>
        </motion.div>
      )}

      {montrerBoutons && choisirMotif && (
        <motion.div className="pile-s" {...entree(4)}>
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
                  onClick={() => setChoisirMotif(false)}>
            Revenir en arrière
          </button>
        </motion.div>
      )}

      {!montrerBoutons && alerte.reponse === 'je_viens' && (
        <motion.div className="carte-secondaire pile-s" {...entree(4)}>
          <span className="rang" style={{ gap: 'var(--e2)' }}>
            {!mouvementReduit && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.25, 1], opacity: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{ display: 'inline-flex', color: 'var(--seve)' }}
              >
                <Check size={18} strokeWidth={2.25} aria-hidden="true" />
              </motion.span>
            )}
            <Etat ton="seve">Vous venez</Etat>
          </span>
          {alerte.fiche_disponibilite ? (
            <>
              <p className="appui">
                Créneau choisi : {alerte.fiche_disponibilite.creneau_prefere || 'non précisé'}.
                Repère : {alerte.fiche_disponibilite.repere_position}.
              </p>
              <Link href={`/alertes/${id}/disponibilite`}
                    className="bouton bouton-secondaire bouton-compact bouton-souleve">
                Modifier ma disponibilité
              </Link>
            </>
          ) : (
            <>
              <p className="appui">Indiquez comment vous viendrez, pour que le centre s&rsquo;organise.</p>
              <Link href={`/alertes/${id}/disponibilite`}
                    className="bouton bouton-secondaire bouton-compact bouton-souleve">
                Indiquer ma disponibilité
              </Link>
            </>
          )}
        </motion.div>
      )}

      {!montrerBoutons && alerte.reponse === 'je_ne_peux_pas' && !delaiPasse && (
        <motion.div className="pile-s" {...entree(4)}>
          <span className="appui" style={{ color: 'var(--encre-secondaire)' }}>
            Vous avez indiqué : {MOTIF_MOT[alerte.motif_refus] || 'Autre raison'}.
          </span>
          <button type="button" className="bouton-fantome" style={{ alignSelf: 'flex-start' }}
                  onClick={() => setRevenir(true)}>
            Revenir sur ma réponse
          </button>
        </motion.div>
      )}
    </main>
  );
}
