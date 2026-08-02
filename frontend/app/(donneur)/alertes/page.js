'use client';
// =====================================================================
//  E6 · Mes alertes.
//  L'en-tête porte l'information, pas l'étiquette. Chaque ligne dit où
//  en est cette alerte pour ce donneur précisément : en attente, un
//  rendez-vous pris, un refus, ou un délai passé.
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mesAlertesDonneur, monProfil } from '@/lib/api';
import BlocGroupe from '../../composants/BlocGroupe';
import Etat from '../../composants/Etat';
import Bouton from '../../composants/Bouton';
import { MessageErreur } from '../../composants/Message';
import { LignesEnAttente } from '../../composants/Squelette';
import { dateCourte, dateLongue, pluriel } from '@/lib/format';

export default function MesAlertes() {
  const routeur = useRouter();
  const [profil, setProfil] = useState(null);
  const [alertes, setAlertes] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => { monProfil().then(setProfil).catch(() => setProfil(null)); }, []);
  useEffect(() => {
    mesAlertesDonneur()
      .then((resultat) => setAlertes(resultat.alertes))
      .catch((probleme) => setErreur(probleme.message));
  }, []);

  if (erreur) {
    return <main className="page-telephone"><MessageErreur>{erreur}</MessageErreur></main>;
  }
  if (!alertes) {
    return <main className="page-telephone pile-l"><LignesEnAttente /></main>;
  }

  if (alertes.length === 0) {
    return (
      <main className="page-telephone pile-l">
        <div className="etat-vide pile">
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
              {profil?.groupe_sanguin ? ` ${profil.groupe_sanguin}` : ' de votre groupe'}
              {profil?.zone ? ` près de ${profil.zone}` : ''}.
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

  const enAttente = alertes.filter((a) => a.statut === 'envoyee' && !a.reponse);
  const plusUrgente = enAttente.length > 0
    ? [...enAttente].sort((a, b) => (a.date_limite || '') < (b.date_limite || '') ? -1 : 1)[0]
    : null;

  return (
    <main className="page-telephone pile-l">
      <div className="pile-s">
        <h1 className="titre">
          {pluriel(alertes.length, 'appel au don', 'appels au don')}
        </h1>
        {enAttente.length > 0 && (
          <p className="appui">
            {enAttente.length === 1
              ? '1 attend votre réponse.'
              : `${enAttente.length} attendent votre réponse.`}
          </p>
        )}
      </div>

      {plusUrgente && (
        <Bouton variante="principal" large
                onClick={() => routeur.push(`/alertes/${plusUrgente.id_alerte}`)}>
          Répondre à l&rsquo;appel {plusUrgente.groupe_cible} du {plusUrgente.structure_nom}
        </Bouton>
      )}

      <div className="pile-s">
        {alertes.map((alerte) => {
          let ton = 'neutre';
          let etatMot = '';
          let ligneDroite = null;

          if (alerte.statut === 'cloturee' && !alerte.reponse) {
            ton = 'neutre'; etatMot = 'Délai passé';
            ligneDroite = alerte.date_limite ? `le ${dateCourte(alerte.date_limite)}` : '';
          } else if (alerte.reponse === 'je_viens') {
            ton = 'seve'; etatMot = 'Vous venez';
            ligneDroite = alerte.creneau_prefere || 'Créneau à préciser';
          } else if (alerte.reponse === 'je_ne_peux_pas') {
            ton = 'neutre'; etatMot = 'Vous ne pouvez pas venir';
          } else {
            ton = 'ocre'; etatMot = 'Votre réponse est attendue';
            ligneDroite = alerte.date_limite ? `avant le ${dateCourte(alerte.date_limite)}` : '';
          }

          return (
            <button key={alerte.id_alerte} type="button"
                    className="carte rang"
                    style={{ width: '100%', textAlign: 'left', cursor: 'pointer', gap: 'var(--e4)' }}
                    onClick={() => routeur.push(`/alertes/${alerte.id_alerte}`)}>
              <BlocGroupe groupe={alerte.groupe_cible} taille="s" />
              <div className="pile-s" style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{alerte.structure_nom}</span>
                <Etat ton={ton}>{etatMot}</Etat>
              </div>
              {ligneDroite && <span className="mono petit">{ligneDroite}</span>}
            </button>
          );
        })}
      </div>
    </main>
  );
}
