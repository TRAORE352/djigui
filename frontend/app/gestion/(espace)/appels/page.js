'use client';
// =====================================================================
//  Index des appels au don du centre. Ouvre sur la liste, l'action
//  principale lance un nouvel appel (E18) ; chaque ligne ouvre son
//  suivi (E19).
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Trash2 } from 'lucide-react';
import { listerAlertesGestion, supprimerAlerteGestion, cloturerAlerteGestion } from '@/lib/api';
import BlocGroupe from '../../../composants/BlocGroupe';
import Bouton from '../../../composants/Bouton';
import Etat from '../../../composants/Etat';
import Confirmation from '../../../composants/Confirmation';
import { MessageErreur } from '../../../composants/Message';
import { LignesEnAttente } from '../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../composants/AideEcran';
import { dateHeure, pluriel } from '@/lib/format';

const STATUT_ETAT = {
  brouillon: { mot: 'Brouillon', ton: 'neutre' },
  envoyee: { mot: 'En cours', ton: 'ocre' },
  cloturee: { mot: 'Clos', ton: 'neutre' }
};

export default function AppelsAuDon() {
  const routeur = useRouter();
  const [alertes, setAlertes] = useState(null);
  const [erreur, setErreur] = useState('');
  const [aSupprimer, setASupprimer] = useState(null);
  const [aCloturer, setACloturer] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [aideOuverte, alternerAide] = useAide('appels');

  useEffect(() => {
    listerAlertesGestion()
      .then((resultat) => setAlertes(resultat.alertes))
      .catch((probleme) => setErreur(probleme.message));
  }, []);

  async function supprimer() {
    if (!aSupprimer) return;
    setEnCours(true); setErreur('');
    try {
      await supprimerAlerteGestion(aSupprimer.id_alerte);
      setAlertes((liste) => liste.filter((a) => a.id_alerte !== aSupprimer.id_alerte));
      setASupprimer(null);
    } catch (probleme) {
      setErreur(probleme.message);
      setASupprimer(null);
    } finally {
      setEnCours(false);
    }
  }

  async function cloturer() {
    if (!aCloturer) return;
    setEnCours(true); setErreur('');
    try {
      await cloturerAlerteGestion(aCloturer.id_alerte);
      setAlertes((liste) => liste.map((a) => (
        a.id_alerte === aCloturer.id_alerte ? { ...a, statut: 'cloturee' } : a
      )));
      setACloturer(null);
    } catch (probleme) {
      setErreur(probleme.message);
      setACloturer(null);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Appels au don</h1>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
        <Bouton variante="principal" enfantIcone={Megaphone}
                onClick={() => routeur.push('/gestion/appels/nouveau')}>
          Lancer un appel au don
        </Bouton>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran liste les appels au don déjà préparés ou envoyés par votre structure. Ouvrez
        un appel envoyé pour suivre les réponses des donneurs et organiser les relances.
        Lancez-en un nouveau dès qu’un groupe manque de stock, depuis cet écran ou depuis le
        tableau de bord.
      </PanneauAide>

      <p className="appui">
        Un appel passe par trois états : brouillon (préparé, pas encore envoyé), en cours
        (envoyé, les donneurs peuvent répondre), clos (le délai est passé ou l’agent l’a
        arrêté).
      </p>

      <MessageErreur>{erreur}</MessageErreur>

      {!alertes ? (
        <LignesEnAttente nombre={4} />
      ) : alertes.length === 0 ? (
        <div className="etat-vide pile-s">
          <p className="lead">Aucun appel au don n’a encore été lancé.</p>
          <p className="appui">
            Un appel se prépare depuis le tableau de bord ou depuis cet écran : choisissez un
            groupe, des zones, et le nombre de donneurs qui recevront le message s’affiche
            avant l’envoi.
          </p>
        </div>
      ) : (
        <div className="registre-defilant">
          <table className="registre">
            <thead>
              <tr>
                <th>Groupe</th><th>Statut</th><th>Créé le</th><th>Envoyé le</th>
                <th className="nombre">Destinataires</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {alertes.map((alerte) => {
                const etat = STATUT_ETAT[alerte.statut] || STATUT_ETAT.brouillon;
                return (
                  <tr key={alerte.id_alerte} className="cliquable" tabIndex={0} role="link"
                      aria-label={`Ouvrir le suivi de l’appel ${alerte.groupe_cible}`}
                      onClick={() => routeur.push(`/gestion/appels/${alerte.id_alerte}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          routeur.push(`/gestion/appels/${alerte.id_alerte}`);
                        }
                      }}>
                    <td><BlocGroupe groupe={alerte.groupe_cible} taille="xs" /></td>
                    <td><Etat ton={etat.ton}>{etat.mot}</Etat></td>
                    <td className="mono appui">{dateHeure(alerte.date_creation)}</td>
                    <td className="mono appui">{alerte.date_envoi ? dateHeure(alerte.date_envoi) : '—'}</td>
                    <td className="nombre">{pluriel(alerte.nb_destinataires, 'donneur')}</td>
                    <td className="actions">
                      {alerte.statut === 'brouillon' && (
                        <button type="button" className="lien lien-sang"
                                onClick={(e) => { e.stopPropagation(); setASupprimer(alerte); }}>
                          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                          Supprimer
                        </button>
                      )}
                      {alerte.statut === 'envoyee' && (
                        <button type="button" className="lien"
                                onClick={(e) => { e.stopPropagation(); setACloturer(alerte); }}>
                          Clôturer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Confirmation
        ouverte={Boolean(aSupprimer)}
        titre={`Supprimer ce brouillon ${aSupprimer?.groupe_cible || ''} ?`}
        motAction="Supprimer" varianteAction="principal" enCours={enCours}
        surConfirmer={supprimer} surAnnuler={() => setASupprimer(null)}
      >
        <p className="appui">
          Ce brouillon n’a été envoyé à personne : il peut disparaître sans conséquence pour le
          registre.
        </p>
      </Confirmation>

      <Confirmation
        ouverte={Boolean(aCloturer)}
        titre={`Clôturer l’appel ${aCloturer?.groupe_cible || ''} ?`}
        motAction="Clôturer" varianteAction="secondaire" enCours={enCours}
        surConfirmer={cloturer} surAnnuler={() => setACloturer(null)}
      >
        <p className="appui">
          Les donneurs qui n’ont pas encore répondu ne pourront plus le faire pour cet appel.
        </p>
      </Confirmation>
    </div>
  );
}
