'use client';
// =====================================================================
//  E21 · Enregistrer un don, et sa confirmation.
//  La poche se crée d'elle-même : code, groupe, péremption. L'agent ne
//  recopie rien. Règle RG6 : un donneur non éligible peut tout de même
//  être enregistré si le médecin du centre l'autorise — la plateforme
//  avertit et garde la trace, elle ne décide pas à la place du centre.
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { rechercherDonneurGestion, enregistrerDonGestion, tableauDeBordGestion } from '@/lib/api';
import BlocGroupe from '../../../composants/BlocGroupe';
import Bouton from '../../../composants/Bouton';
import Etat from '../../../composants/Etat';
import { MessageErreur } from '../../../composants/Message';
import { useAide, BoutonAide, PanneauAide } from '../../../composants/AideEcran';
import { numeroLisible, dateCourte, dateLongue, pluriel } from '@/lib/format';

// Jours : addition de calendrier exacte, identique à DATE_ADD ... DAY.
function ajouterJours(dateTexte, jours) {
  const date = new Date(`${dateTexte}T00:00:00`);
  date.setDate(date.getDate() + jours);
  return date.toISOString().slice(0, 10);
}
// Mois : prévision seulement. Le service recalcule la valeur exacte à
// l'enregistrement ; les débordements de fin de mois peuvent différer.
function ajouterMoisApprox(dateTexte, mois) {
  const date = new Date(`${dateTexte}T00:00:00`);
  date.setMonth(date.getMonth() + mois);
  return date.toISOString().slice(0, 10);
}
function heureMaintenant() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function dateAujourdhui() {
  return new Date().toISOString().slice(0, 10);
}
function niveauCalcule(disponibles, bas, critique) {
  if (!Number.isFinite(bas) || !Number.isFinite(critique)) return null;
  if (disponibles <= critique) return 'critique';
  if (disponibles <= bas) return 'bas';
  return 'normal';
}

export default function EnregistrerUnDon() {
  const routeur = useRouter();

  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [donneurChoisi, setDonneurChoisi] = useState(null);

  const [dateDon, setDateDon] = useState(dateAujourdhui());
  const [heureDon, setHeureDon] = useState(heureMaintenant());
  const [poste, setPoste] = useState('');
  const [autorisationMedicale, setAutorisationMedicale] = useState(false);
  const [motifAutorisation, setMotifAutorisation] = useState('');

  const [parametres, setParametres] = useState(null);
  const [stockGroupes, setStockGroupes] = useState(null);

  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [nbDonsSession, setNbDonsSession] = useState(0);
  const [aideOuverte, alternerAide] = useAide('enregistrer-un-don');

  function chargerReference() {
    tableauDeBordGestion().then((resultat) => {
      setParametres({
        duree_conservation_jours: resultat.duree_conservation_jours,
        delai_homme_mois: resultat.delai_homme_mois,
        delai_femme_mois: resultat.delai_femme_mois
      });
      setStockGroupes(resultat.stock);
    }).catch(() => {});
  }
  useEffect(chargerReference, []);

  // Recherche à retardement, pour ne pas interroger le service à chaque frappe.
  useEffect(() => {
    if (donneurChoisi) return;
    const texte = recherche.trim();
    if (texte.length < 2) { setResultats(null); return; }
    setRechercheEnCours(true);
    const minuterie = setTimeout(() => {
      rechercherDonneurGestion(texte)
        .then((resultat) => setResultats(resultat.resultats))
        .catch((probleme) => setErreur(probleme.message))
        .finally(() => setRechercheEnCours(false));
    }, 350);
    return () => clearTimeout(minuterie);
  }, [recherche, donneurChoisi]);

  const ligneStock = useMemo(() => {
    if (!stockGroupes || !donneurChoisi?.groupe_sanguin) return null;
    return stockGroupes.find((ligne) => ligne.groupe_sanguin === donneurChoisi.groupe_sanguin) || null;
  }, [stockGroupes, donneurChoisi]);

  const aujourdHui = dateAujourdhui();
  const dateFuture = dateDon > aujourdHui;
  const nonEligible = donneurChoisi && !donneurChoisi.eligibilite.eligible;
  const motifIncomplet = nonEligible && autorisationMedicale && motifAutorisation.trim().length < 5;
  const bloque = !donneurChoisi || dateFuture || (nonEligible && !autorisationMedicale) || motifIncomplet;

  const peremptionPrevue = donneurChoisi && parametres
    ? ajouterJours(dateDon, parametres.duree_conservation_jours) : null;
  const eligibilitePrevue = donneurChoisi && parametres
    ? ajouterMoisApprox(dateDon, donneurChoisi.sexe === 'M' ? parametres.delai_homme_mois : parametres.delai_femme_mois)
    : null;
  const niveauProjection = ligneStock
    ? niveauCalcule(ligneStock.poches_disponibles + 1, ligneStock.seuil_bas, ligneStock.seuil_critique)
    : null;

  async function envoyer() {
    if (bloque) return;
    setErreur(''); setEnCours(true);
    try {
      const resultat = await enregistrerDonGestion({
        id_donneur: donneurChoisi.id_donneur,
        date_don: dateDon,
        heure_don: heureDon || null,
        poste: poste.trim() || null,
        autorisation_medicale: autorisationMedicale,
        motif_autorisation: motifAutorisation.trim() || undefined
      });
      setConfirmation(resultat);
      setNbDonsSession((n) => n + 1);
    } catch (probleme) {
      setErreur(probleme.message);
    } finally {
      setEnCours(false);
    }
  }

  function recommencer() {
    setConfirmation(null);
    setDonneurChoisi(null);
    setRecherche('');
    setResultats(null);
    setDateDon(dateAujourdhui());
    setHeureDon(heureMaintenant());
    setPoste('');
    setAutorisationMedicale(false);
    setMotifAutorisation('');
    setErreur('');
    chargerReference();
  }

  /* --------------------------- Confirmation --------------------------- */
  if (confirmation) {
    return (
      <div className="contenu-registre pile-xl">
        <div className="entete-ecran">
          <h1 className="titre-grand">Don enregistré</h1>
        </div>

        <div className="carte pile-l">
          <div className="pile-s">
            <span className="etiquette">Code de la poche</span>
            <span className="code-poche-grand">{confirmation.code_poche}</span>
          </div>

          <div className="ligne-valeurs">
            <div>
              <p className="mot">Prélevée le</p>
              <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>{dateCourte(confirmation.date_prelevement)}</p>
            </div>
            <div>
              <p className="mot">Périme le</p>
              <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>{dateCourte(confirmation.date_peremption)}</p>
            </div>
            <div>
              <p className="mot">Conservation</p>
              <p className="valeur" style={{ fontSize: 'var(--t-lead)' }}>
                {parametres ? pluriel(parametres.duree_conservation_jours, 'jour') : '—'}
              </p>
            </div>
          </div>

          <div className="pile-s">
            <span className="appui">
              Prochain don possible pour {confirmation.donneur.prenom} {confirmation.donneur.nom} —
              à dire à voix haute avant qu&rsquo;il ou elle quitte le centre :
            </span>
            <span className="lead">{dateLongue(confirmation.date_prochaine_eligibilite)}</span>
          </div>

          <hr className="filet" />

          <div className="pile-s">
            <div className="rang-espace">
              <span className="appui">Stock du groupe {confirmation.groupe_sanguin}, une fois qualifiée</span>
              <span className="mono">{confirmation.stock_avant} → {confirmation.stock_apres_projection}</span>
            </div>
            {confirmation.niveau_apres_projection === 'critique' && (
              <Etat ton="sang">Le groupe restera au niveau critique.</Etat>
            )}
            {confirmation.niveau_apres_projection === 'bas' && (
              <Etat ton="ocre">Le groupe restera au niveau bas.</Etat>
            )}
          </div>
        </div>

        <div className="rang" style={{ gap: 'var(--e3)' }}>
          <Bouton variante="principal" onClick={recommencer}>Enregistrer un autre don</Bouton>
          <Bouton variante="secondaire"
                  onClick={() => routeur.push(`/gestion/poches/${encodeURIComponent(confirmation.code_poche)}`)}>
            Ouvrir la fiche de la poche
          </Bouton>
        </div>
      </div>
    );
  }

  /* ---------------------------- Formulaire ----------------------------- */
  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <div className="pile-s">
          <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
            <h1 className="titre-grand">Enregistrer un don</h1>
            <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
          </div>
          <p className="ligne-registre">
            {dateCourte(aujourdHui)} · {heureMaintenant()} ·{' '}
            {pluriel(nbDonsSession, 'don')} déjà enregistré{nbDonsSession > 1 ? 's' : ''} aujourd’hui à ce poste
          </p>
        </div>
        <Bouton variante="principal" enCours={enCours} motEnCours="Enregistrement"
                disabled={bloque} onClick={envoyer}>
          Enregistrer le don
        </Bouton>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran enregistre un don qui vient d’avoir lieu. Retrouvez le donneur par son nom ou
        son numéro, vérifiez son éligibilité, puis confirmez la date et le poste. La poche se
        crée d’elle-même, avec son code et sa péremption : rien à recopier. Un donneur non
        éligible peut tout de même être enregistré si le médecin du centre l’autorise.
      </PanneauAide>

      <MessageErreur>{erreur}</MessageErreur>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--e7)', alignItems: 'start' }}>
        <div className="pile-l">
          {!donneurChoisi ? (
            <>
              <label className="champ champ-encadre">
                <span className="champ-etiquette">Nom ou numéro du donneur</span>
                <input className="champ-saisie" autoFocus
                       placeholder="Écrivez un nom ou un numéro de téléphone"
                       value={recherche}
                       onChange={(e) => setRecherche(e.target.value)} />
              </label>

              {rechercheEnCours && <p className="petit">Recherche…</p>}

              {resultats && resultats.length === 0 && !rechercheEnCours && (
                <div className="etat-vide pile-s">
                  <p className="appui">Aucun donneur actif ne correspond à cette recherche.</p>
                </div>
              )}

              {resultats && resultats.length > 0 && (
                <div className="pile-s">
                  {resultats.map((donneur) => (
                    <button key={donneur.id_donneur} type="button"
                            className="carte rang"
                            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', gap: 'var(--e4)' }}
                            onClick={() => setDonneurChoisi(donneur)}>
                      <BlocGroupe groupe={donneur.groupe_sanguin} taille="m" />
                      <div className="pile-s" style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{donneur.prenom} {donneur.nom}</span>
                        <span className="petit">
                          {donneur.zone_nom} ({donneur.zone_ville}) ·{' '}
                          {numeroLisible(donneur.numero_principal) || 'Aucun numéro'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="pile-l">
              <div className="carte rang" style={{ gap: 'var(--e4)' }}>
                <BlocGroupe groupe={donneurChoisi.groupe_sanguin} taille="l" />
                <div className="pile-s" style={{ flex: 1 }}>
                  <span className="titre">{donneurChoisi.prenom} {donneurChoisi.nom}</span>
                  <span className="appui">
                    {donneurChoisi.zone_nom} ({donneurChoisi.zone_ville})
                    {donneurChoisi.repere_position ? ` · ${donneurChoisi.repere_position}` : ''}
                  </span>
                  <span className="mono appui">
                    {numeroLisible(donneurChoisi.numero_principal) || 'Aucun numéro'}
                    {donneurChoisi.statut_joignabilite === 'injoignable' && ' · injoignable au dernier contrôle'}
                  </span>
                </div>
                <button type="button" className="lien"
                        onClick={() => { setDonneurChoisi(null); setRecherche(''); }}>
                  Changer de donneur
                </button>
              </div>

              <div className="pile-s">
                {donneurChoisi.eligibilite.eligible
                  ? <Etat ton="seve">Éligible aujourd’hui.</Etat>
                  : <Etat ton="ocre">Non éligible pour l’instant.</Etat>}
                {!donneurChoisi.eligibilite.eligible && (
                  <ul className="pile-s" style={{ margin: 0, paddingLeft: 'var(--e5)' }}>
                    {donneurChoisi.eligibilite.raisons.map((raison, indice) => (
                      <li key={indice} className="appui">{raison.phrase}</li>
                    ))}
                  </ul>
                )}
                <span className="petit">
                  {donneurChoisi.date_dernier_don
                    ? `Dernier don le ${dateCourte(donneurChoisi.date_dernier_don)}, il y a ${pluriel(donneurChoisi.jours_depuis_dernier_don, 'jour')}.`
                    : 'Aucun don enregistré pour l’instant.'}
                  {' '}{pluriel(donneurChoisi.nb_dons_total, 'don')} au total.
                </span>
              </div>

              {!donneurChoisi.eligibilite.eligible && (
                <div className="carte pile-s">
                  <label className="rang" style={{ gap: 'var(--e3)' }}>
                    <input type="checkbox" className="case-a-cocher"
                           checked={autorisationMedicale}
                           onChange={(e) => setAutorisationMedicale(e.target.checked)} />
                    <span>Le médecin du centre autorise ce don</span>
                  </label>
                  {autorisationMedicale && (
                    <label className="champ champ-encadre">
                      <span className="champ-etiquette">Motif de l’autorisation</span>
                      <input className="champ-saisie" value={motifAutorisation}
                             onChange={(e) => setMotifAutorisation(e.target.value)} />
                    </label>
                  )}
                  <p className="petit">
                    La décision revient au personnel médical du centre. Cette autorisation
                    est inscrite au journal avec le motif et votre nom.
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--e4)' }}>
                <label className={`champ champ-encadre ${dateFuture ? 'champ-erreur' : ''}`}>
                  <span className="champ-etiquette">Date du don</span>
                  <input className="champ-saisie mono" type="date" value={dateDon} max={aujourdHui}
                         onChange={(e) => setDateDon(e.target.value)} />
                </label>
                <label className="champ champ-encadre">
                  <span className="champ-etiquette">Heure</span>
                  <input className="champ-saisie mono" type="time" value={heureDon}
                         onChange={(e) => setHeureDon(e.target.value)} />
                </label>
                <label className="champ champ-encadre">
                  <span className="champ-etiquette">Poste</span>
                  <input className="champ-saisie" placeholder="Guichet 2" value={poste}
                         onChange={(e) => setPoste(e.target.value)} />
                </label>
              </div>
              {dateFuture && (
                <p className="message-erreur">La date du don ne peut pas être dans le futur.</p>
              )}
            </div>
          )}
        </div>

        <div className="carte pile" style={{ position: 'sticky', top: 'var(--e6)' }}>
          <span className="etiquette">Ce qui sera enregistré</span>
          {!donneurChoisi ? (
            <p className="appui">Choisissez un donneur pour voir le détail.</p>
          ) : (
            <div className="pile-s">
              <div className="rang-espace">
                <span className="appui">Donneur</span>
                <span style={{ fontWeight: 600 }}>{donneurChoisi.prenom} {donneurChoisi.nom}</span>
              </div>
              <div className="rang-espace">
                <span className="appui">Groupe</span>
                <BlocGroupe groupe={donneurChoisi.groupe_sanguin} taille="xs" />
              </div>
              <div className="rang-espace">
                <span className="appui">Date du don</span>
                <span className="mono">{dateCourte(dateDon)}</span>
              </div>
              <div className="rang-espace">
                <span className="appui">Péremption prévue</span>
                <span className="mono">{peremptionPrevue ? dateCourte(peremptionPrevue) : '—'}</span>
              </div>
              <div className="rang-espace">
                <span className="appui">Prochaine éligibilité</span>
                <span className="mono">{eligibilitePrevue ? dateCourte(eligibilitePrevue) : '—'}</span>
              </div>

              {ligneStock && (
                <>
                  <hr className="filet" />
                  <div className="rang-espace">
                    <span className="appui">Stock, une fois qualifiée</span>
                    <span className="mono">
                      {ligneStock.poches_disponibles} → {ligneStock.poches_disponibles + 1}
                    </span>
                  </div>
                  {niveauProjection === 'critique' && <Etat ton="sang">Restera critique.</Etat>}
                  {niveauProjection === 'bas' && <Etat ton="ocre">Restera bas.</Etat>}
                </>
              )}

              <p className="petit">
                La poche est créée d’elle-même avec son code et sa péremption : rien à recopier.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
