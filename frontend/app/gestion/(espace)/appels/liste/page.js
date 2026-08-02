'use client';
// =====================================================================
//  Entrée de rail « Liste d'appel ». La liste elle-même se lit pour un
//  appel précis (E20, /gestion/appels/[id]/liste-appel) : cet écran
//  choisit lequel, ou y va directement s'il n'y en a qu'un.
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listerAlertesGestion } from '@/lib/api';
import BlocGroupe from '../../../../composants/BlocGroupe';
import { MessageErreur } from '../../../../composants/Message';
import { LignesEnAttente } from '../../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../../composants/AideEcran';
import { dateCourte, pluriel } from '@/lib/format';

export default function ChoisirListeAppel() {
  const routeur = useRouter();
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState('');
  const [aideOuverte, alternerAide] = useAide('appels-liste');

  useEffect(() => {
    listerAlertesGestion()
      .then((resultat) => {
        const actifs = resultat.alertes.filter((a) => a.statut === 'envoyee');
        if (actifs.length === 1) {
          routeur.replace(`/gestion/appels/${actifs[0].id_alerte}/liste-appel`);
          return;
        }
        setEnCours(actifs);
      })
      .catch((probleme) => setErreur(probleme.message));
  }, [routeur]);

  return (
    <div className="contenu-formulaire pile-xl">
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Liste d’appel</h1>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran choisit quel appel en cours suivre au téléphone. S’il n’y en a qu’un, vous y
        êtes envoyé directement ; sinon, choisissez-le dans la liste. Le détail des appels à
        passer s’ouvre ensuite un par un, avec le résultat à noter pour chaque numéro.
      </PanneauAide>

      <MessageErreur>{erreur}</MessageErreur>

      {!enCours ? (
        <LignesEnAttente nombre={3} />
      ) : enCours.length === 0 ? (
        <div className="etat-vide pile-s">
          <p className="lead">Aucun appel en cours n’attend d’être suivi au téléphone.</p>
          <p className="appui">
            La liste d’appel s’ouvre pour un appel envoyé, tant que des donneurs n’ont pas
            encore répondu.
          </p>
        </div>
      ) : (
        <div className="pile-s">
          <span className="appui">Plusieurs appels sont en cours. Choisissez lequel suivre.</span>
          {enCours.map((alerte) => (
            <button key={alerte.id_alerte} type="button" className="carte rang"
                    style={{ width: '100%', textAlign: 'left', cursor: 'pointer', gap: 'var(--e4)' }}
                    onClick={() => routeur.push(`/gestion/appels/${alerte.id_alerte}/liste-appel`)}>
              <BlocGroupe groupe={alerte.groupe_cible} taille="s" />
              <div className="pile-s" style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>Envoyé le {dateCourte(alerte.date_envoi)}</span>
                <span className="petit">{pluriel(alerte.nb_destinataires, 'donneur')} destinataires</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
