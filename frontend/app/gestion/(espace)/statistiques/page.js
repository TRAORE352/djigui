'use client';
// =====================================================================
//  E26 · Statistiques du centre.
//  Quatre périodes nommées, aucun sélecteur à ouvrir pour le cas
//  courant. Barres en CSS pur, jamais de camembert. Chaque phrase de
//  lecture est calculée à partir des chiffres reçus, jamais écrite en
//  dur : elle reste juste quelles que soient les données.
// =====================================================================
import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { statistiquesGestion } from '@/lib/api';
import BlocGroupe from '../../../composants/BlocGroupe';
import Bouton from '../../../composants/Bouton';
import { MessageErreur } from '../../../composants/Message';
import { LignesEnAttente } from '../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../composants/AideEcran';
import { pluriel } from '@/lib/format';

function aujourdHui() { return new Date().toISOString().slice(0, 10); }
function debutMoisCourant() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function ilYAMois(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}
function debutAnneeCourante() { return `${new Date().getFullYear()}-01-01`; }

function periodes() {
  const fin = aujourdHui();
  return [
    { cle: 'mois', mot: 'Ce mois', debut: debutMoisCourant(), fin },
    { cle: 'trimestre', mot: 'Trois derniers mois', debut: ilYAMois(3), fin },
    { cle: 'annee', mot: 'Depuis janvier', debut: debutAnneeCourante(), fin },
    { cle: 'choix', mot: 'Période au choix', debut: null, fin: null }
  ];
}

function phraseTotaux(t) {
  const base = t.dons_enregistres === 0
    ? 'Aucun don n’a été enregistré sur cette période'
    : `${pluriel(t.dons_enregistres, 'don')} enregistré${t.dons_enregistres > 1 ? 's' : ''} sur cette période`;
  if (t.poches_echeance === 0) return `${base}.`;
  if (t.poches_perimees === 0) return `${base}, et aucune poche arrivée à échéance n’a été perdue par péremption.`;
  return `${base} ; ${t.poches_perimees_proportion}% des poches arrivées à échéance ont été perdues par péremption.`;
}

function phraseDonsParGroupe(donsParGroupe, stock) {
  const total = donsParGroupe.reduce((s, l) => s + l.nb_dons, 0);
  if (total === 0) return 'Aucun don n’a encore été enregistré sur cette période, pour aucun groupe.';
  const trie = [...donsParGroupe].sort((a, b) => b.nb_dons - a.nb_dons);
  const plus = trie[0];
  const moins = trie[trie.length - 1];
  const stockMoins = stock?.find((s) => s.groupe_sanguin === moins.groupe_sanguin);
  let phrase = `${plus.groupe_sanguin} est le groupe le plus collecté sur cette période, avec ${pluriel(plus.nb_dons, 'don')}. `;
  phrase += `${moins.groupe_sanguin} est le moins collecté, avec ${pluriel(moins.nb_dons, 'don')}`;
  phrase += stockMoins?.niveau === 'critique' ? ', et son stock reste au niveau critique.' : '.';
  return phrase;
}

function phraseRendement(r) {
  if (r.messages_envoyes === 0) {
    return r.dons_hors_appel > 0
      ? `Aucun appel n’a été envoyé sur cette période ; ${pluriel(r.dons_hors_appel, 'don')} enregistré${r.dons_hors_appel > 1 ? 's' : ''} sans appel préalable.`
      : 'Aucun appel n’a été envoyé sur cette période.';
  }
  let phrase = `${r.taux_venue}% des donneurs appelés sont venus au centre`;
  phrase += r.dons_hors_appel > 0
    ? `, contre ${pluriel(r.dons_hors_appel, 'don')} enregistré${r.dons_hors_appel > 1 ? 's' : ''} sans appel.`
    : '.';
  return phrase;
}

function phraseTransport(a) {
  if (a.demandes_recues === 0) return 'Aucune demande d’aide au transport sur cette période.';
  if (a.non_satisfaites === 0) return `Les ${pluriel(a.demandes_recues, 'demande')} d’aide au transport ont toutes été satisfaites.`;
  return `${a.donneurs_vehicules} des ${pluriel(a.demandes_recues, 'demande')} d’aide au transport ont été satisfaites ; ${pluriel(a.non_satisfaites, 'demande')} restée${a.non_satisfaites > 1 ? 's' : ''} sans solution.`;
}

export default function Statistiques() {
  const listePeriodes = periodes();
  const [periodeActive, setPeriodeActive] = useState('mois');
  const [debutChoix, setDebutChoix] = useState(ilYAMois(1));
  const [finChoix, setFinChoix] = useState(aujourdHui());
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const [suggestionPeriode, setSuggestionPeriode] = useState(null);
  const [aideOuverte, alternerAide] = useAide('statistiques');

  const periodeCourante = periodeActive === 'choix'
    ? { cle: 'choix', mot: 'Période au choix', debut: debutChoix, fin: finChoix }
    : listePeriodes.find((p) => p.cle === periodeActive);

  useEffect(() => {
    if (!periodeCourante.debut || !periodeCourante.fin || periodeCourante.debut > periodeCourante.fin) return;
    setDonnees(null);
    setErreur('');
    statistiquesGestion(periodeCourante.debut, periodeCourante.fin)
      .then(setDonnees)
      .catch((probleme) => setErreur(probleme.message));
  }, [periodeCourante.debut, periodeCourante.fin]);

  useEffect(() => {
    if (!donnees) { setSuggestionPeriode(null); return; }
    const { totaux } = donnees;
    const vide = totaux.dons_enregistres === 0 && totaux.appels_lances === 0 && totaux.nouveaux_donneurs === 0;
    if (!vide) { setSuggestionPeriode(null); return; }
    const suivante = periodeActive === 'mois' ? listePeriodes.find((p) => p.cle === 'trimestre')
      : periodeActive === 'trimestre' ? listePeriodes.find((p) => p.cle === 'annee')
      : null;
    if (!suivante) { setSuggestionPeriode(null); return; }
    statistiquesGestion(suivante.debut, suivante.fin)
      .then((r) => setSuggestionPeriode({ periode: suivante, dons: r.totaux.dons_enregistres }))
      .catch(() => setSuggestionPeriode(null));
  }, [donnees, periodeActive]);

  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Statistiques</h1>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
        <div className="rang" style={{ gap: 'var(--e3)' }}>
          <Bouton variante="discret" disabled enfantIcone={FileText}>
            Éditer le rapport mensuel
          </Bouton>
          <span className="petit">Écran en construction</span>
        </div>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran résume l’activité du centre sur une période choisie : dons enregistrés,
        appels lancés, nouveaux donneurs, poches perdues par péremption. Les phrases sous
        chaque bloc sont calculées à partir des chiffres du moment, elles restent justes quelle
        que soit la période. Aucun nom de donneur n’apparaît ici : uniquement des nombres.
      </PanneauAide>

      <MessageErreur>{erreur}</MessageErreur>

      <div className="pile-s">
        <span className="etiquette">Période</span>
        <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
          {listePeriodes.map((p) => (
            <button key={p.cle} type="button" className="touche"
                    aria-pressed={periodeActive === p.cle}
                    onClick={() => setPeriodeActive(p.cle)}>
              {p.mot}
            </button>
          ))}
        </div>
        {periodeActive === 'choix' && (
          <div className="rang" style={{ gap: 'var(--e4)' }}>
            <label className="champ champ-encadre">
              <span className="champ-etiquette">Du</span>
              <input type="date" className="champ-saisie mono" value={debutChoix}
                     max={finChoix || aujourdHui()} onChange={(e) => setDebutChoix(e.target.value)} />
            </label>
            <label className="champ champ-encadre">
              <span className="champ-etiquette">Au</span>
              <input type="date" className="champ-saisie mono" value={finChoix}
                     max={aujourdHui()} onChange={(e) => setFinChoix(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      {!donnees ? (
        <LignesEnAttente nombre={8} />
      ) : (
        <>
          <div className="pile-s">
            <div className="ligne-valeurs">
              <div>
                <p className="mot">Dons enregistrés</p>
                <p className="valeur">{donnees.totaux.dons_enregistres}</p>
              </div>
              <div>
                <p className="mot">Appels lancés</p>
                <p className="valeur">{donnees.totaux.appels_lances}</p>
              </div>
              <div>
                <p className="mot">Nouveaux donneurs</p>
                <p className="valeur">{donnees.totaux.nouveaux_donneurs}</p>
              </div>
              <div>
                <p className="mot">Poches périmées</p>
                <p className="valeur">
                  {donnees.totaux.poches_perimees}
                  {donnees.totaux.poches_echeance > 0 && (
                    <span className="petit"> ({donnees.totaux.poches_perimees_proportion}%)</span>
                  )}
                </p>
              </div>
            </div>
            <p className="appui">{phraseTotaux(donnees.totaux)}</p>
            {suggestionPeriode && (
              <div className="etat-vide pile-s">
                <p className="appui">
                  Aucune activité sur « {periodeCourante.mot} ». « {suggestionPeriode.periode.mot} » donnerait{' '}
                  {pluriel(suggestionPeriode.dons, 'don')} enregistré{suggestionPeriode.dons > 1 ? 's' : ''}.
                </p>
                <Bouton variante="discret" compact onClick={() => setPeriodeActive(suggestionPeriode.periode.cle)}>
                  Voir « {suggestionPeriode.periode.mot} »
                </Bouton>
              </div>
            )}
          </div>

          <div className="pile-s">
            <span className="etiquette">Dons par groupe</span>
            <div className="pile-s">
              {donnees.dons_par_groupe.map((ligne) => {
                const maxDons = Math.max(1, ...donnees.dons_par_groupe.map((l) => l.nb_dons));
                const pourcentage = Math.round((ligne.nb_dons / maxDons) * 100);
                const critique = donnees.stock?.find((s) => s.groupe_sanguin === ligne.groupe_sanguin)?.niveau === 'critique';
                return (
                  <div key={ligne.groupe_sanguin} className="rang" style={{ gap: 'var(--e3)' }}>
                    <BlocGroupe groupe={ligne.groupe_sanguin} taille="xs" />
                    <span className="jauge" style={{ flex: 1, maxWidth: 'none' }}>
                      <span className={critique ? 'jauge-sang' : 'jauge-encre'} style={{ width: `${pourcentage}%` }} />
                    </span>
                    <span className="mono nombre" style={{ width: 90, flexShrink: 0 }}>{pluriel(ligne.nb_dons, 'don')}</span>
                  </div>
                );
              })}
            </div>
            <p className="appui">{phraseDonsParGroupe(donnees.dons_par_groupe, donnees.stock)}</p>
          </div>

          <div className="pile-s">
            <span className="etiquette">Rendement des appels</span>
            <div className="ligne-valeurs">
              <div>
                <p className="mot">Envoyés</p>
                <p className="valeur">{donnees.rendement_appels.messages_envoyes}</p>
              </div>
              <div>
                <p className="mot">Ont répondu</p>
                <p className="valeur">{donnees.rendement_appels.donneurs_ayant_repondu}</p>
              </div>
              <div>
                <p className="mot">Sont venus</p>
                <p className="valeur">{donnees.rendement_appels.donneurs_venus}</p>
              </div>
              <div>
                <p className="mot">Dons hors appel</p>
                <p className="valeur">{donnees.rendement_appels.dons_hors_appel}</p>
              </div>
            </div>
            <p className="appui">{phraseRendement(donnees.rendement_appels)}</p>
          </div>

          <div className="pile-s">
            <span className="etiquette">Aide au transport</span>
            <div className="ligne-valeurs">
              <div>
                <p className="mot">Demandes reçues</p>
                <p className="valeur">{donnees.aide_transport.demandes_recues}</p>
              </div>
              <div>
                <p className="mot">Donneurs véhiculés</p>
                <p className="valeur">{donnees.aide_transport.donneurs_vehicules}</p>
              </div>
              <div>
                <p className="mot">Non satisfaites</p>
                <p className="valeur">{donnees.aide_transport.non_satisfaites}</p>
              </div>
            </div>
            <p className="appui">{phraseTransport(donnees.aide_transport)}</p>
          </div>
        </>
      )}

      <p className="petit">Aucun nom de donneur n’apparaît sur cet écran : uniquement des nombres.</p>
    </div>
  );
}
