'use client';
// =====================================================================
//  Fiche du donneur, ouverte depuis E24.
//  Lecture seule pour l'instant : aucune modification n'est proposée
//  depuis cet écran, et l'écran le dit.
// =====================================================================
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { ficheDonneurGestion } from '@/lib/api';
import BlocGroupe from '../../../../composants/BlocGroupe';
import Etat from '../../../../composants/Etat';
import { MessageErreur } from '../../../../composants/Message';
import { LignesEnAttente } from '../../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../../composants/AideEcran';
import { numeroLisible, dateCourte, dateLongue, pluriel } from '@/lib/format';

const RANG_MOT = { 1: 'Principal' };
function motRang(rang) { return RANG_MOT[rang] || `Numéro de secours ${rang - 1}`; }

// Seul « signalé injoignable » est un vrai signal : la joignabilité
// ordonne la liste d'appel (E20), elle ne filtre jamais les
// destinataires d'un appel au don. Un numéro « jamais vérifié » reçoit
// tout de même les appels.
const JOIGNABILITE_MOT = {
  confirme: { mot: 'Confirmé', ton: 'seve' },
  non_verifie: { mot: 'Jamais vérifié', ton: 'neutre' },
  injoignable: { mot: 'Signalé injoignable', ton: 'ocre' }
};

export default function FicheDonneur() {
  const { id } = useParams();
  const [donneur, setDonneur] = useState(null);
  const [erreur, setErreur] = useState('');
  const [aideOuverte, alternerAide] = useAide('fiche-donneur');

  useEffect(() => {
    ficheDonneurGestion(id).then(setDonneur).catch((probleme) => setErreur(probleme.message));
  }, [id]);

  return (
    <div className="contenu-formulaire pile-xl">
      <div className="rang-espace">
        <Link href="/gestion/donneurs" className="lien">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Retour au registre des donneurs
        </Link>
        <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cette fiche montre tout ce que le centre sait d’un donneur : son éligibilité du jour,
        ses numéros dans l’ordre où les appeler, et son historique de dons. Elle est en lecture
        seule pour l’instant : aucune modification ne se fait depuis cet écran.
      </PanneauAide>

      <MessageErreur>{erreur}</MessageErreur>

      {!donneur ? (
        erreur ? null : <LignesEnAttente nombre={6} />
      ) : (
        <>
          <div className="encadre">
            <Info size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>
              Cette fiche est en lecture seule pour l’instant : aucune modification n’est
              possible depuis cet écran.
            </span>
          </div>

          <div className="rang" style={{ gap: 'var(--e5)' }}>
            <BlocGroupe groupe={donneur.groupe_sanguin} taille="l" />
            <div className="pile-s">
              <h1 className="titre-grand">{donneur.prenom} {donneur.nom}</h1>
              <span className="appui">
                {donneur.zone_nom} ({donneur.zone_ville})
                {donneur.repere_position ? ` · ${donneur.repere_position}` : ''}
              </span>
            </div>
          </div>

          <div className="ligne-valeurs">
            <div>
              <p className="mot">Âge</p>
              <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>{pluriel(donneur.eligibilite.age, 'an')}</p>
            </div>
            <div>
              <p className="mot">Poids</p>
              <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>{Number(donneur.poids_declare)} kg</p>
            </div>
            <div>
              <p className="mot">Dernier don</p>
              <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>
                {donneur.date_dernier_don ? dateCourte(donneur.date_dernier_don) : '—'}
              </p>
            </div>
            <div>
              <p className="mot">Dons au total</p>
              <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>{donneur.dons.length}</p>
            </div>
          </div>

          <div className="pile-s">
            {donneur.eligibilite.eligible
              ? <Etat ton="seve">Peut donner aujourd’hui.</Etat>
              : <Etat ton="ocre">Ne peut pas donner aujourd’hui.</Etat>}
            {!donneur.eligibilite.eligible && (
              <ul className="pile-s" style={{ margin: 0, paddingLeft: 'var(--e5)' }}>
                {donneur.eligibilite.raisons.map((raison, indice) => (
                  <li key={indice} className="appui">{raison.phrase}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="pile-s">
            <span className="etiquette">Numéros, dans l’ordre d’appel</span>
            <div className="pile-s">
              {donneur.telephones.map((tel) => {
                const etat = JOIGNABILITE_MOT[tel.statut_joignabilite] || JOIGNABILITE_MOT.non_verifie;
                return (
                  <div key={tel.id_telephone} className="ligne-fait">
                    <div className="pile-s">
                      <span className="mono" style={{ fontWeight: 600 }}>{numeroLisible(tel.numero)}</span>
                      <span className="petit">{motRang(tel.rang)}</span>
                    </div>
                    <div className="pile-s" style={{ alignItems: 'flex-end' }}>
                      <Etat ton={etat.ton}>{etat.mot}</Etat>
                      {tel.statut_joignabilite === 'non_verifie' ? (
                        <span className="petit" style={{ textAlign: 'right', maxWidth: 260 }}>
                          Ce numéro n’a pas encore été appelé par un agent. Le donneur reçoit
                          tout de même les appels au don.
                        </span>
                      ) : tel.date_dernier_controle && (
                        <span className="petit">le {dateCourte(tel.date_dernier_controle)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pile-s">
            <span className="etiquette">Historique des dons</span>
            {donneur.dons.length === 0 ? (
              <div className="etat-vide pile-s">
                <p className="appui">Aucun don enregistré pour l’instant.</p>
              </div>
            ) : (
              <div className="registre-defilant">
                <table className="registre">
                  <thead>
                    <tr><th>Date</th><th>Structure</th><th>Poche</th></tr>
                  </thead>
                  <tbody>
                    {donneur.dons.map((don) => (
                      <tr key={don.id_don}>
                        <td className="mono">{dateCourte(don.date_don)}</td>
                        <td className="appui">{don.structure_nom} ({don.structure_ville})</td>
                        <td className="mono">{don.code_poche || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {donneur.date_prochaine_eligibilite && !donneur.eligibilite.eligible && (
            <p className="appui">Prochain don possible : {dateLongue(donneur.date_prochaine_eligibilite)}.</p>
          )}
        </>
      )}
    </div>
  );
}
