'use client';
// =====================================================================
//  Accueil de l'espace d'administration.
//  Un administrateur qui arrive ici doit comprendre en un regard ce que
//  cet espace fait (gérer les accès, jamais le sang) et ce qui mérite
//  son attention aujourd'hui. Tout est calculé depuis /api/administration/etat,
//  jamais écrit en dur : l'écran reste juste quel que soit l'état réel.
// =====================================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { etatAdministration } from '@/lib/api';
import { MessageErreur } from '../composants/Message';
import { LignesEnAttente } from '../composants/Squelette';

// Chaque point d'attention porte une clé stable renvoyée par le
// service ; c'est ici, côté écran, que la clé devient un lien : le
// service n'a pas à connaître les adresses du frontend.
const ACTION_ATTENTION = {
  administrateur_unique: { mot: 'Voir les comptes', lien: '/administration/comptes' },
  aucune_zone: { mot: 'Créer une zone', lien: '/administration/structures-et-zones' },
  aucune_structure: { mot: 'Créer une structure', lien: '/administration/structures-et-zones' },
  comptes_inutilises: { mot: 'Voir les comptes', lien: '/administration/comptes' },
  provisoires_expires: { mot: 'Réinitialiser', lien: '/administration/comptes' }
};

export default function AccueilAdministration() {
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    etatAdministration().then(setEtat).catch((probleme) => setErreur(probleme.message));
  }, []);

  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <h1 className="titre-grand">Administration</h1>
      </div>

      <p className="lead">
        Cet espace gère les accès au produit. Il ne donne accès ni aux donneurs, ni au stock,
        ni aux appels au don : c’est une séparation voulue. Si ce compte était compromis, aucune
        donnée de donneur ni aucun état de stock ne serait exposé.
      </p>

      <MessageErreur>{erreur}</MessageErreur>

      {!etat ? (
        <LignesEnAttente nombre={4} />
      ) : (
        <>
          <div className="ligne-valeurs">
            <div>
              <p className="mot">Comptes actifs</p>
              <p className="valeur">{etat.comptes_actifs}</p>
            </div>
            <div>
              <p className="mot">Structures</p>
              <p className="valeur">{etat.structures}</p>
            </div>
            <div>
              <p className="mot">Zones</p>
              <p className="valeur">{etat.zones}</p>
            </div>
            <div>
              <p className="mot">Journal, sept derniers jours</p>
              <p className="valeur">{etat.journal_sept_jours}</p>
            </div>
          </div>

          <div className="pile-s">
            <span className="etiquette">Points d’attention</span>
            {etat.attentions.length === 0 ? (
              <p className="appui">Rien ne réclame d’attention pour l’instant.</p>
            ) : (
              <div>
                {etat.attentions.map((attention) => {
                  const action = ACTION_ATTENTION[attention.cle];
                  return (
                    <div key={attention.cle} className="ligne-fait">
                      <span className="appui">{attention.texte}</span>
                      {action && (
                        <Link href={action.lien} className="lien" style={{ flexShrink: 0 }}>
                          {action.mot}
                          <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
