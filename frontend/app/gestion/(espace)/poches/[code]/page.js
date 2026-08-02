'use client';
// =====================================================================
//  E27 gestion · Changer la situation d'une poche.
//  (Numérotation identique à l'E27 de l'administration dans les
//  maquettes — deux écrans différents, même numéro. Placé ici sous
//  /gestion/poches/[code] pour ne jamais être confondu avec l'autre.)
//  La situation actuelle s'affiche avant toute proposition. L'effet
//  complet — situation, stock, niveau — est annoncé avant validation.
//  Une étape n'est jamais effacée : une correction s'écrit comme une
//  nouvelle étape, les deux restant dans l'historique.
// =====================================================================
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { trouverPocheGestion, changerSituationPocheGestion, tableauDeBordGestion } from '@/lib/api';
import BlocGroupe from '../../../../composants/BlocGroupe';
import Bouton from '../../../../composants/Bouton';
import { MessageErreur, MessageReussite } from '../../../../composants/Message';
import { LignesEnAttente } from '../../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../../composants/AideEcran';
import { dateCourte, dateHeure, dateLongue } from '@/lib/format';

const MOTS = {
  collectee: 'Collectée', qualifiee: 'Qualifiée', disponible: 'Disponible',
  reservee: 'Réservée', transfusee: 'Transfusée', detruite: 'Détruite', perimee: 'Périmée'
};
const MOTS_NIVEAU = { critique: 'Critique', bas: 'Bas', normal: 'Normal', en_attente: 'En attente de premier don' };

function niveauCalcule(disponibles, bas, critique) {
  if (!Number.isFinite(bas) || !Number.isFinite(critique)) return null;
  if (disponibles <= critique) return 'critique';
  if (disponibles <= bas) return 'bas';
  return 'normal';
}
function effetSurDisponibles(statutActuel, statutCible) {
  if (statutActuel === 'disponible' && statutCible !== 'disponible') return -1;
  if (statutActuel !== 'disponible' && statutCible === 'disponible') return 1;
  return 0;
}

export default function SituationPoche() {
  const { code } = useParams();
  const [poche, setPoche] = useState(null);
  const [stockLigne, setStockLigne] = useState(null);
  const [erreur, setErreur] = useState('');
  const [reussite, setReussite] = useState('');
  const [cible, setCible] = useState(null);
  const [precision, setPrecision] = useState('');
  const [poste, setPoste] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [aideOuverte, alternerAide] = useAide('poche-detail');

  function recharger() {
    setErreur('');
    return trouverPocheGestion(code)
      .then((resultat) => {
        setPoche(resultat.poche);
        setCible(null);
        setPrecision('');
        return tableauDeBordGestion().then((tableau) => {
          setStockLigne(tableau.stock.find((l) => l.groupe_sanguin === resultat.poche.groupe_sanguin) || null);
        });
      })
      .catch((probleme) => setErreur(probleme.message));
  }
  useEffect(() => { recharger(); }, [code]);

  useEffect(() => {
    if (!reussite) return;
    const minuterie = setTimeout(() => setReussite(''), 4000);
    return () => clearTimeout(minuterie);
  }, [reussite]);

  const effetDisponibles = cible && poche ? effetSurDisponibles(poche.statut, cible) : 0;
  const disponiblesApres = stockLigne ? stockLigne.poches_disponibles + effetDisponibles : null;
  const niveauApres = stockLigne ? niveauCalcule(disponiblesApres, stockLigne.seuil_bas, stockLigne.seuil_critique) : null;
  const precisionRequise = cible === 'detruite';
  const bloque = !cible || (precisionRequise && precision.trim().length < 3);

  async function valider() {
    if (bloque) return;
    setEnCours(true); setErreur('');
    try {
      await changerSituationPocheGestion(code, {
        nouveau_statut: cible,
        precision: precision.trim() || undefined,
        poste: poste.trim() || undefined
      });
      setPoste('');
      setReussite(`Situation enregistrée : ${MOTS[cible]}.`);
      await recharger();
    } catch (probleme) {
      setErreur(probleme.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="contenu-registre pile-xl">
      <div className="rang-espace">
        <Link href="/gestion/poches" className="lien">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Retour au registre des poches
        </Link>
        <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran montre la fiche complète d’une poche : sa situation actuelle, son historique
        et le donneur d’origine. Choisissez la prochaine situation pour la faire avancer dans
        son parcours ; l’effet sur le stock du groupe s’affiche avant que vous n’enregistriez.
        Une étape n’est jamais effacée : une correction s’ajoute comme une nouvelle étape.
      </PanneauAide>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      {!poche ? (
        erreur ? null : <LignesEnAttente nombre={6} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--e7)', alignItems: 'start' }}>
          <div className="pile-l">
            <div className="rang" style={{ gap: 'var(--e5)' }}>
              <BlocGroupe groupe={poche.groupe_sanguin} taille="l" />
              <div className="pile-s">
                <span className="code-poche-grand" style={{ fontSize: 'var(--t-titre)' }}>{poche.code_poche}</span>
                <span className="titre">{MOTS[poche.statut] || poche.statut}</span>
                <span className="appui">
                  Depuis le {dateCourte(poche.historique[poche.historique.length - 1]?.date_changement)}
                </span>
              </div>
            </div>

            {poche.prochaines_situations.length === 0 ? (
              <div className="etat-vide pile-s">
                <p className="lead">Cette poche est arrivée en fin de parcours.</p>
                <p className="appui">Aucun changement de situation n’est plus possible.</p>
              </div>
            ) : (
              <div className="pile-s">
                <span className="etiquette">Faire passer cette poche à…</span>
                <div className="pile-s">
                  {poche.prochaines_situations.map((statut) => {
                    const effet = effetSurDisponibles(poche.statut, statut);
                    return (
                      <button key={statut} type="button" className="carte rang-espace"
                              style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}
                              aria-pressed={cible === statut}
                              onClick={() => setCible(cible === statut ? null : statut)}>
                        <span style={{ fontWeight: 600 }}>{MOTS[statut]}</span>
                        <span className="petit">
                          {effet === 0 ? 'Stock disponible : inchangé'
                            : effet > 0 ? 'Stock disponible : + 1 poche'
                            : 'Stock disponible : − 1 poche'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {cible && (
              <div className="carte pile-s">
                <span className="etiquette">Effet de ce changement</span>
                <div className="ligne-valeurs">
                  <div>
                    <p className="mot">Situation</p>
                    <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>
                      {MOTS[poche.statut]} → {MOTS[cible]}
                    </p>
                  </div>
                  {stockLigne && (
                    <>
                      <div>
                        <p className="mot">Stock disponible</p>
                        <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>
                          {stockLigne.poches_disponibles} → {disponiblesApres}
                        </p>
                      </div>
                      <div>
                        <p className="mot">Niveau du groupe</p>
                        <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>
                          {MOTS_NIVEAU[stockLigne.niveau]} → {MOTS_NIVEAU[niveauApres]}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <label className="champ champ-encadre">
                  <span className="champ-etiquette">
                    {cible === 'detruite' ? 'Raison de la destruction'
                      : cible === 'transfusee' ? 'Destination (service ou patient)'
                      : 'Précision (optionnelle)'}
                  </span>
                  <input className="champ-saisie" value={precision}
                         onChange={(e) => setPrecision(e.target.value)} />
                </label>
                <label className="champ champ-encadre">
                  <span className="champ-etiquette">Poste</span>
                  <input className="champ-saisie" placeholder="Guichet 2" value={poste}
                         onChange={(e) => setPoste(e.target.value)} />
                </label>

                <p className="petit">
                  Ce changement ne peut pas être annulé : pour corriger, enregistrez un nouveau
                  changement. Les deux resteront inscrits dans l’historique.
                </p>

                <Bouton variante="principal" enCours={enCours} motEnCours="Enregistrement"
                        disabled={bloque} onClick={valider}>
                  Enregistrer ce changement
                </Bouton>
              </div>
            )}

            <div className="carte pile-s">
              <span className="etiquette">Donneur d’origine</span>
              <div className="rang-espace">
                <span style={{ fontWeight: 600 }}>{poche.donneur_prenom} {poche.donneur_nom}</span>
                <span className="appui">
                  Prochain don possible :{' '}
                  {poche.date_prochaine_eligibilite ? dateLongue(poche.date_prochaine_eligibilite) : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="pile-s">
            <span className="etiquette">Historique</span>
            <div className="registre-defilant">
              <table className="registre">
                <thead>
                  <tr><th>Heure</th><th>Étape</th><th>Agent</th><th>Poste</th></tr>
                </thead>
                <tbody>
                  {poche.historique.map((etape, indice) => (
                    <tr key={indice}>
                      <td className="mono petit">{dateHeure(etape.date_changement)}</td>
                      <td className="appui">
                        {etape.precision_etape
                          || `${etape.ancien_statut ? MOTS[etape.ancien_statut] : 'Création'} → ${MOTS[etape.nouveau_statut]}`}
                      </td>
                      <td className="appui">{etape.agent_prenom} {etape.agent_nom}</td>
                      <td className="appui">{etape.poste || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
