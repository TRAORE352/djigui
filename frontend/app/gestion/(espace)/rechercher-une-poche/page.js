'use client';
// =====================================================================
//  E23 · Rechercher une poche.
//  Un seul champ, large, lisible à distance. Code inconnu : on propose
//  les codes voisins plutôt qu'un mur d'erreur. Le parcours complet se
//  lit en chronologie verticale, la dernière puce annonçant ce qui peut
//  encore arriver à cette poche.
// =====================================================================
import { useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';
import { trouverPocheGestion } from '@/lib/api';
import BlocGroupe from '../../../composants/BlocGroupe';
import Bouton from '../../../composants/Bouton';
import { MessageErreur } from '../../../composants/Message';
import { useAide, BoutonAide, PanneauAide } from '../../../composants/AideEcran';
import { dateCourte, dateHeure, pluriel } from '@/lib/format';

const SITUATIONS_MOTS = {
  collectee: 'collectée', qualifiee: 'qualifiée', disponible: 'disponible',
  reservee: 'réservée', transfusee: 'transfusée', detruite: 'détruite', perimee: 'périmée'
};

function motSituation(statut) {
  return SITUATIONS_MOTS[statut] || statut;
}

function phraseEtape(etape) {
  if (etape.precision_etape) return etape.precision_etape;
  if (!etape.ancien_statut) return `Poche créée : ${motSituation(etape.nouveau_statut)}.`;
  return `Situation changée : ${motSituation(etape.ancien_statut)} devient ${motSituation(etape.nouveau_statut)}.`;
}

export default function RechercherUnePoche() {
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [codesProches, setCodesProches] = useState(null);
  const [poche, setPoche] = useState(null);
  const [aideOuverte, alternerAide] = useAide('rechercher-une-poche');

  function rechercher(code) {
    const valeur = String(code || '').trim().toUpperCase();
    if (!valeur) return;
    setEnCours(true); setErreur(''); setCodesProches(null); setPoche(null);
    trouverPocheGestion(valeur)
      .then((resultat) => setPoche(resultat.poche))
      .catch((probleme) => {
        setErreur(probleme.message);
        setCodesProches(probleme.donnees?.codes_proches || []);
      })
      .finally(() => setEnCours(false));
  }

  return (
    <div className="contenu-formulaire pile-xl">
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Rechercher une poche</h1>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Vous avez une poche en main. Tapez le code inscrit sur son étiquette pour retrouver son
        parcours complet : de quel donneur elle vient, qui l’a contrôlée, et où elle est allée.
        Si le code n’existe pas, des codes proches vous seront proposés pour rattraper une
        faute de frappe.
      </PanneauAide>

      <p className="lead">
        Vous avez une poche en main. Tapez le code inscrit sur son étiquette pour retrouver son
        parcours complet : de quel donneur elle vient, qui l’a contrôlée, et où elle est allée.
      </p>

      <form className="pile-s" onSubmit={(e) => { e.preventDefault(); rechercher(saisie); }}>
        <label className="champ champ-encadre">
          <span className="champ-etiquette">Code de la poche</span>
          <input className="champ-saisie champ-code-large" autoFocus
                 placeholder="PO-2026-0001" value={saisie}
                 onChange={(e) => setSaisie(e.target.value)} />
        </label>
        <span className="champ-aide">
          Le code figure sur l’étiquette collée à la poche. Si le code n’existe pas, les codes
          proches vous seront proposés.
        </span>
        <Bouton variante="principal" type="submit" enCours={enCours} motEnCours="Recherche"
                enfantIcone={Search}>
          Rechercher
        </Bouton>
      </form>

      <MessageErreur>{erreur}</MessageErreur>

      {codesProches && (
        <div className="pile-s">
          {codesProches.length === 0 ? (
            <p className="appui">Aucun code voisin ne s’en approche.</p>
          ) : (
            <>
              <span className="etiquette">Codes voisins</span>
              <div className="pile-s">
                {codesProches.map((c) => (
                  <button key={c.code_poche} type="button" className="carte rang-espace"
                          style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}
                          onClick={() => { setSaisie(c.code_poche); rechercher(c.code_poche); }}>
                    <span className="mono" style={{ fontWeight: 600 }}>{c.code_poche}</span>
                    <span className="petit">Créée le {dateCourte(c.date_creation)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {poche && (
        <div className="pile-l">
          <div className="carte rang" style={{ gap: 'var(--e4)' }}>
            <BlocGroupe groupe={poche.groupe_sanguin} taille="m" />
            <div className="pile-s" style={{ flex: 1 }}>
              <span className="code-poche-grand" style={{ fontSize: 'var(--t-titre)' }}>{poche.code_poche}</span>
              <span className="appui">{poche.situation_lisible}</span>
            </div>
            <Link href={`/gestion/poches/${encodeURIComponent(poche.code_poche)}`} className="lien">
              Ouvrir la fiche
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>

          <div className="pile-s">
            <span className="etiquette">Parcours de la poche</span>
            <div className="chronologie">
              {poche.historique.map((etape, indice) => (
                <div key={indice} className="chronologie-etape">
                  <div className="pile-s" style={{ paddingBottom: 0 }}>
                    <span className="petit mono">{dateHeure(etape.date_changement)}</span>
                    <span className="appui" style={{ fontWeight: 600 }}>{phraseEtape(etape)}</span>
                    <span className="petit">
                      {etape.agent_prenom} {etape.agent_nom}
                      {etape.poste ? ` · ${etape.poste}` : ''}
                    </span>
                  </div>
                </div>
              ))}
              <div className="chronologie-etape a-venir">
                <div>
                  {poche.prochaines_situations.length === 0 ? (
                    <span className="appui">Fin du parcours pour cette poche.</span>
                  ) : (
                    <span className="appui">
                      Étape suivante possible : {poche.prochaines_situations.map(motSituation).join(' ou ')}.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
