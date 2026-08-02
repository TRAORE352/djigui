'use client';
// =====================================================================
//  E7 · Répondre à un appel au don.
//  Les deux réponses ont le même poids visuel : refuser doit rester
//  aussi facile qu'accepter. Le message du centre reste entre
//  guillemets, distinct de ce que l'application ajoute.
// =====================================================================
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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

export default function RepondreAlerte() {
  const { id } = useParams();
  const routeur = useRouter();
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

  return (
    <main className="page-telephone sans-barre pile-l">
      <Link href="/alertes" className="lien">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Retour aux alertes
      </Link>

      <MessageErreur>{erreur}</MessageErreur>

      <div className="rang" style={{ gap: 'var(--e5)' }}>
        <BlocGroupe groupe={alerte.groupe_cible} taille="l" />
        <div className="pile-s">
          <span className="titre">Le centre recherche des donneurs {alerte.groupe_cible}</span>
          <span className="appui">{alerte.structure_nom}</span>
        </div>
      </div>

      <div className="pile-s">
        <p className="citation">« {alerte.message} »</p>
        <span className="petit">Message reçu le {dateHeure(alerte.date_envoi)}</span>
      </div>

      <div className="pile-s">
        <span className="etiquette">Adresse</span>
        <p className="appui">
          {alerte.structure_nom}, {alerte.structure_ville}
          {alerte.structure_adresse ? ` — ${alerte.structure_adresse}` : ''}
        </p>
        {alerte.structure_horaires && <p className="petit">Horaires : {alerte.structure_horaires}</p>}
        {alerte.structure_telephone && <p className="petit mono">{alerte.structure_telephone}</p>}
      </div>

      {!delaiPasse ? (
        <Etat ton="ocre">
          Répondez avant le {dateLongue(alerte.date_limite)}
          {alerte.heure_limite ? ` à ${alerte.heure_limite.slice(0, 5)}` : ''}. Après cette
          date, le centre n&rsquo;attend plus votre réponse.
        </Etat>
      ) : (
        <Etat ton="neutre">Le délai de réponse est passé.</Etat>
      )}

      {montrerBoutons && !choisirMotif && (
        <>
          <div className="rang" style={{ gap: 'var(--e3)' }}>
            <Bouton variante="principal" style={{ flex: 1 }} enCours={enCours}
                    onClick={() => envoyer('je_viens', null)}>
              Je viens
            </Bouton>
            <Bouton variante="secondaire" style={{ flex: 1 }} disabled={enCours}
                    onClick={() => setChoisirMotif(true)}>
              Je ne peux pas
            </Bouton>
          </div>
          <p className="petit" style={{ textAlign: 'center' }}>
            Répondre ne vous engage pas à donner : le personnel médical décidera sur place.
          </p>
        </>
      )}

      {montrerBoutons && choisirMotif && (
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
          <button type="button" className="lien" onClick={() => setChoisirMotif(false)}>
            Revenir en arrière
          </button>
        </div>
      )}

      {!montrerBoutons && alerte.reponse === 'je_viens' && (
        <div className="carte pile-s">
          <Etat ton="seve">Vous venez</Etat>
          {alerte.fiche_disponibilite ? (
            <>
              <p className="appui">
                Créneau choisi : {alerte.fiche_disponibilite.creneau_prefere || 'non précisé'}.
                Repère : {alerte.fiche_disponibilite.repere_position}.
              </p>
              <Link href={`/alertes/${id}/disponibilite`} className="lien">Modifier ma disponibilité</Link>
            </>
          ) : (
            <>
              <p className="appui">Indiquez comment vous viendrez, pour que le centre s&rsquo;organise.</p>
              <Bouton variante="principal" onClick={() => routeur.push(`/alertes/${id}/disponibilite`)}>
                Indiquer ma disponibilité
              </Bouton>
            </>
          )}
        </div>
      )}

      {!montrerBoutons && alerte.reponse === 'je_ne_peux_pas' && !delaiPasse && (
        <div className="pile-s">
          <span className="appui" style={{ color: 'var(--encre-secondaire)' }}>
            Vous avez indiqué : {MOTIF_MOT[alerte.motif_refus] || 'Autre raison'}.
          </span>
          <button type="button" className="lien" onClick={() => setRevenir(true)}>
            Revenir sur ma réponse
          </button>
        </div>
      )}
    </main>
  );
}
