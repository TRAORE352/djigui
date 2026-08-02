'use client';
// =====================================================================
//  E17 · Détail d'un groupe sanguin.
//  Quatre valeurs en une seule ligne réglée, jamais quatre cartes
//  détachées. La courbe sur trente jours viendra plus tard : elle
//  demande de reconstituer le stock passé à partir de l'historique.
// =====================================================================
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Megaphone, ChartColumn } from 'lucide-react';
import { detailGroupeGestion } from '@/lib/api';
import BlocGroupe from '../../../../composants/BlocGroupe';
import Bouton from '../../../../composants/Bouton';
import { MessageErreur } from '../../../../composants/Message';
import { LignesEnAttente } from '../../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../../composants/AideEcran';
import { dateCourte, pluriel } from '@/lib/format';

const MOTS_NIVEAU = { critique: 'Critique', bas: 'Bas', normal: 'Normal', en_attente: 'En attente de premier don' };

export default function DetailGroupe() {
  const { groupe } = useParams();
  const routeur = useRouter();
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const [aideOuverte, alternerAide] = useAide('groupe-detail');

  useEffect(() => {
    if (!groupe) return;
    setDonnees(null);
    detailGroupeGestion(groupe)
      .then(setDonnees)
      .catch((probleme) => setErreur(probleme.message));
  }, [groupe]);

  return (
    <div className="contenu-registre pile-xl">
      <Link href="/gestion/tableau-de-bord" className="lien">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Retour au tableau de bord
      </Link>

      <MessageErreur>{erreur}</MessageErreur>

      {!donnees ? (
        <LignesEnAttente nombre={5} />
      ) : (
        <>
          <div className="rang" style={{ gap: 'var(--e5)', alignItems: 'center' }}>
            <BlocGroupe groupe={groupe} taille="l" />
            <h1 className="titre-grand">Groupe {groupe}</h1>
            <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
          </div>

          <PanneauAide ouvert={aideOuverte}>
            Cet écran détaille le stock d’un seul groupe sanguin : le nombre de poches
            disponibles, ses deux seuils, et son niveau actuel. La liste ci-dessous montre
            chaque poche de ce groupe avec sa situation. Depuis ce détail, vous pouvez lancer
            directement un appel au don pour ce groupe.
          </PanneauAide>

          <div className="ligne-valeurs">
            <div>
              <p className="mot">Poches disponibles</p>
              <p className="valeur">{donnees.stock.poches_disponibles}</p>
            </div>
            <div>
              <p className="mot">Seuil bas</p>
              <p className="valeur">{donnees.stock.seuil_bas ?? '—'}</p>
            </div>
            <div>
              <p className="mot">Seuil critique</p>
              <p className="valeur">{donnees.stock.seuil_critique ?? '—'}</p>
            </div>
            <div>
              <p className="mot">Niveau</p>
              <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>
                {MOTS_NIVEAU[donnees.stock.niveau] || '—'}
              </p>
            </div>
          </div>

          <p className="lead">{donnees.phrase}</p>

          {donnees.poches.length === 0 ? (
            <div className="etat-vide pile-s">
              <p className="lead">Aucune poche n’est encore enregistrée pour ce groupe.</p>
              <p className="appui">
                Les poches apparaîtront ici dès qu’un don sera enregistré pour ce groupe.
              </p>
            </div>
          ) : (
            <div className="registre-defilant">
              <table className="registre">
                <thead>
                  <tr>
                    <th>Code</th><th>Prélevée le</th><th>Périme le</th>
                    <th className="nombre">Jours restants</th><th>Situation</th>
                  </tr>
                </thead>
                <tbody>
                  {donnees.poches.map((poche) => (
                    <tr key={poche.id_poche}>
                      <td className="mono">{poche.code_poche}</td>
                      <td className="mono">{dateCourte(poche.date_prelevement)}</td>
                      <td className="mono">{dateCourte(poche.date_peremption)}</td>
                      <td className="nombre">{pluriel(poche.jours_restants, 'jour')}</td>
                      <td className="appui">{poche.situation_lisible}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="etat-vide pile-s">
            <p className="lead" style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)' }}>
              <ChartColumn size={20} strokeWidth={1.75} aria-hidden="true" />
              Évolution sur trente jours
            </p>
            <p className="appui">
              Cette courbe demande de reconstituer le stock passé à partir de
              l’historique des poches. Elle arrivera plus tard dans le projet.
            </p>
          </div>

          <Bouton variante="principal" enfantIcone={Megaphone}
                  onClick={() => routeur.push(`/gestion/appels/nouveau?groupe=${encodeURIComponent(groupe)}`)}>
            Lancer un appel au don pour ce groupe
          </Bouton>
        </>
      )}
    </div>
  );
}
