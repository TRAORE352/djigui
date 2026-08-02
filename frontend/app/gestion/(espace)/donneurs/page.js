'use client';
// =====================================================================
//  E24 · Registre des donneurs — le moteur de ciblage que E18 réutilisera.
//  Filtres cumulables toujours visibles (aucun réglage caché derrière
//  une liste déroulante fermée), résumé sur la liste filtrée, et un état
//  vide qui dit lequel des filtres est de trop plutôt que de constater
//  une absence.
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { listerDonneursGestion, resumerDonneursGestion, listerZones } from '@/lib/api';
import BlocGroupe from '../../../composants/BlocGroupe';
import Bouton from '../../../composants/Bouton';
import { MessageErreur } from '../../../composants/Message';
import { LignesEnAttente } from '../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../composants/AideEcran';
import { numeroLisible, dateCourte, dateLongue, dateHeure, pluriel, ORDRE_GROUPES } from '@/lib/format';

const LIMITE = 20;

const LABEL_GROUPE = {
  'O+': 'O positif', 'O-': 'O négatif', 'A+': 'A positif', 'A-': 'A négatif',
  'B+': 'B positif', 'B-': 'B négatif', 'AB+': 'AB positif', 'AB-': 'AB négatif'
};

const FILTRES_VIDES = {
  texte: '', groupes: [], zones: [], eligibilite: 'tous', joignabilite: 'tous', sans_don_depuis_un_an: false
};

// Seul « signalé injoignable » est un vrai signal (filet Ocre). Un
// numéro « jamais vérifié » reçoit tout de même les appels au don : ce
// n'est pas un problème, juste un numéro qu'aucun agent n'a encore eu
// au téléphone.
function infoNumero(ligne) {
  if (ligne.statut_joignabilite === 'injoignable') {
    return {
      texte: ligne.date_dernier_controle
        ? `signalé injoignable le ${dateCourte(ligne.date_dernier_controle)}`
        : 'signalé injoignable',
      alerte: true
    };
  }
  if (ligne.statut_joignabilite === 'non_verifie') {
    return { texte: 'n’a pas encore été appelé par un agent', alerte: false };
  }
  return null;
}

function libellesAffinages(filtres, zones) {
  const items = [];
  if (filtres.zones.length > 0) {
    const noms = filtres.zones.map((id) => zones?.find((z) => z.id_zone === id)?.nom || id).join(' ou ');
    items.push({ cle: 'zones', dans: `à ${noms}`, retrait: 'la zone' });
  }
  if (filtres.eligibilite === 'aujourd_hui') {
    items.push({ cle: 'eligibilite', dans: 'éligibles aujourd’hui', retrait: 'le filtre d’éligibilité' });
  }
  if (filtres.joignabilite !== 'tous') {
    items.push({
      cle: 'joignabilite',
      dans: filtres.joignabilite === 'confirme' ? 'au numéro confirmé' : 'au numéro à vérifier',
      retrait: 'le filtre de joignabilité'
    });
  }
  if (filtres.sans_don_depuis_un_an) {
    items.push({ cle: 'sans_don_depuis_un_an', dans: 'sans don depuis un an', retrait: 'le filtre d’ancienneté' });
  }
  return items;
}

function libelleIdentite(filtres) {
  if (filtres.groupes.length > 0) return filtres.groupes.map((g) => LABEL_GROUPE[g]).join(' ou ');
  if (filtres.texte) return `correspondant à « ${filtres.texte} »`;
  return '';
}

function filtresSansAffinage(filtres, cle) {
  const copie = { ...filtres };
  if (cle === 'zones') copie.zones = [];
  else if (cle === 'eligibilite') copie.eligibilite = 'tous';
  else if (cle === 'joignabilite') copie.joignabilite = 'tous';
  else if (cle === 'sans_don_depuis_un_an') copie.sans_don_depuis_un_an = false;
  return copie;
}

export default function RegistreDesDonneurs() {
  const routeur = useRouter();
  const [filtres, setFiltres] = useState(FILTRES_VIDES);
  const [texteSaisie, setTexteSaisie] = useState('');
  const [zones, setZones] = useState(null);
  const [depart, setDepart] = useState(0);
  const [donnees, setDonnees] = useState(null);
  const [resume, setResume] = useState(null);
  const [totalRegistre, setTotalRegistre] = useState(null);
  const [erreur, setErreur] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [aideOuverte, alternerAide] = useAide('donneurs');

  useEffect(() => { listerZones().then((r) => setZones(r.zones)).catch(() => setZones([])); }, []);
  // Taille du registre entier, indépendante des filtres : sert d'unique
  // point de comparaison dans l'en-tête.
  useEffect(() => {
    listerDonneursGestion({ limite: 1 }).then((r) => setTotalRegistre(r.total)).catch(() => {});
  }, []);

  // La recherche attend une courte pause avant d'interroger le service.
  useEffect(() => {
    const minuterie = setTimeout(() => {
      setFiltres((f) => (f.texte === texteSaisie.trim() ? f : { ...f, texte: texteSaisie.trim() }));
    }, 350);
    return () => clearTimeout(minuterie);
  }, [texteSaisie]);

  useEffect(() => { setDepart(0); }, [filtres]);

  useEffect(() => {
    setDonnees(null);
    setErreur('');
    setSuggestion(null);
    Promise.all([
      listerDonneursGestion({ ...filtres, limite: LIMITE, depart }),
      resumerDonneursGestion(filtres)
    ])
      .then(([liste, resumeListe]) => { setDonnees(liste); setResume(resumeListe); })
      .catch((probleme) => setErreur(probleme.message));
  }, [filtres, depart]);

  // État vide : quel filtre est de trop, et ce que donnerait son retrait.
  useEffect(() => {
    if (!donnees || donnees.lignes.length > 0 || !zones) { return; }

    const aucunFiltre = !filtres.texte && filtres.groupes.length === 0 && filtres.zones.length === 0
      && filtres.eligibilite === 'tous' && filtres.joignabilite === 'tous' && !filtres.sans_don_depuis_un_an;
    if (aucunFiltre) { setSuggestion({ texte: 'Aucun donneur n’est encore inscrit au registre.' }); return; }

    const affinages = libellesAffinages(filtres, zones);
    const identite = libelleIdentite(filtres);

    if (affinages.length === 0) {
      setSuggestion({
        texte: `Le registre ne compte aucun donneur ${identite}.`.trim() + ' Essayez un autre groupe ou une autre recherche.'
      });
      return;
    }

    listerDonneursGestion({ texte: filtres.texte, groupes: filtres.groupes, limite: 1 })
      .then((baseListe) => {
        const compteIdentite = baseListe.total;
        if (compteIdentite === 0) {
          setSuggestion({
            texte: `Le registre ne compte aucun donneur ${identite}. Essayez un autre groupe ou une autre recherche.`
          });
          return;
        }
        const aRetirer = affinages[0];
        return resumerDonneursGestion(filtresSansAffinage(filtres, aRetirer.cle)).then((resumeSansCe) => {
          const suffixe = affinages.map((a) => a.dans).join(' et ');
          const nb = resumeSansCe.peuvent_donner_aujourdhui;
          setSuggestion({
            texte: `Le registre compte ${pluriel(compteIdentite, 'donneur')}${identite ? ' ' + identite : ''}, `
              + `dont aucun ${suffixe}. En retirant ${aRetirer.retrait}, `
              + `${pluriel(nb, 'donneur')} ${nb > 1 ? 'peuvent' : 'peut'} donner aujourd’hui.`,
            retirer: () => setFiltres(filtresSansAffinage(filtres, aRetirer.cle))
          });
        });
      })
      .catch(() => setSuggestion({ texte: 'Aucun donneur ne correspond à ces filtres.' }));
  }, [donnees, filtres, zones]);

  function toggleGroupe(groupe) {
    setFiltres((f) => ({
      ...f,
      groupes: f.groupes.includes(groupe) ? f.groupes.filter((g) => g !== groupe) : [...f.groupes, groupe]
    }));
  }
  function toggleZone(idZone) {
    setFiltres((f) => ({
      ...f,
      zones: f.zones.includes(idZone) ? f.zones.filter((z) => z !== idZone) : [...f.zones, idZone]
    }));
  }

  const chips = [];
  if (filtres.texte) chips.push({ cle: 'texte', mot: `Recherche : « ${filtres.texte} »`, retirer: () => { setTexteSaisie(''); setFiltres((f) => ({ ...f, texte: '' })); } });
  filtres.groupes.forEach((g) => chips.push({ cle: `g-${g}`, mot: `Groupe : ${LABEL_GROUPE[g]}`, retirer: () => toggleGroupe(g) }));
  filtres.zones.forEach((idZone) => {
    const nomZone = zones?.find((z) => z.id_zone === idZone)?.nom || idZone;
    chips.push({ cle: `z-${idZone}`, mot: `Zone : ${nomZone}`, retirer: () => toggleZone(idZone) });
  });
  if (filtres.eligibilite === 'aujourd_hui') chips.push({ cle: 'elig', mot: 'Éligibles aujourd’hui', retirer: () => setFiltres((f) => ({ ...f, eligibilite: 'tous' })) });
  if (filtres.joignabilite === 'confirme') chips.push({ cle: 'join', mot: 'Numéro confirmé', retirer: () => setFiltres((f) => ({ ...f, joignabilite: 'tous' })) });
  if (filtres.joignabilite === 'a_verifier') chips.push({ cle: 'join', mot: 'Numéro à vérifier', retirer: () => setFiltres((f) => ({ ...f, joignabilite: 'tous' })) });
  if (filtres.sans_don_depuis_un_an) chips.push({ cle: 'sansdon', mot: 'Aucun don depuis un an', retirer: () => setFiltres((f) => ({ ...f, sans_don_depuis_un_an: false })) });

  const maintenant = new Date();
  const filtreActif = chips.length > 0;

  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <div className="pile-s">
          <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
            <h1 className="titre-grand">Donneurs</h1>
            <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
          </div>
          <p className="ligne-registre">
            {dateHeure(maintenant)}
            {totalRegistre !== null && ` · ${pluriel(totalRegistre, 'donneur')} au registre`}
            {filtreActif && donnees && ` · ${pluriel(donnees.total, 'donneur')} correspond${donnees.total > 1 ? 'ent' : ''} au filtre`}
          </p>
        </div>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran liste tous les donneurs inscrits, quelle que soit leur structure : le
        registre est commun à tout le bassin. Combinez les filtres pour retrouver un groupe de
        donneurs précis, par exemple pour préparer un appel au don. Ouvrez une ligne pour voir
        la fiche complète d’un donneur, en lecture seule.
      </PanneauAide>

      <MessageErreur>{erreur}</MessageErreur>

      <div className="pile">
        <label className="champ champ-encadre">
          <span className="champ-etiquette">Nom ou numéro</span>
          <input className="champ-saisie" placeholder="Écrivez un nom ou un numéro de téléphone"
                 value={texteSaisie} onChange={(e) => setTexteSaisie(e.target.value)} />
        </label>

        <div className="pile-s">
          <span className="etiquette">Groupe</span>
          <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
            {ORDRE_GROUPES.map((groupe) => (
              <button key={groupe} type="button" className="touche-groupe" style={{ minHeight: 48, width: 64 }}
                      aria-pressed={filtres.groupes.includes(groupe)}
                      onClick={() => toggleGroupe(groupe)}>
                {groupe}
              </button>
            ))}
          </div>
        </div>

        <div className="pile-s">
          <span className="etiquette">Zone</span>
          <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
            {(zones || []).map((zone) => (
              <button key={zone.id_zone} type="button" className="touche"
                      aria-pressed={filtres.zones.includes(zone.id_zone)}
                      onClick={() => toggleZone(zone.id_zone)}>
                {zone.nom}
              </button>
            ))}
          </div>
        </div>

        <div className="rang" style={{ gap: 'var(--e5)', flexWrap: 'wrap' }}>
          <div className="pile-s">
            <span className="etiquette">Éligibilité</span>
            <div className="rang" style={{ gap: 'var(--e2)' }}>
              <button type="button" className="touche" aria-pressed={filtres.eligibilite === 'tous'}
                      onClick={() => setFiltres((f) => ({ ...f, eligibilite: 'tous' }))}>Tous</button>
              <button type="button" className="touche" aria-pressed={filtres.eligibilite === 'aujourd_hui'}
                      onClick={() => setFiltres((f) => ({ ...f, eligibilite: 'aujourd_hui' }))}>Peuvent donner aujourd’hui</button>
            </div>
          </div>

          <div className="pile-s">
            <span className="etiquette">Numéro principal</span>
            <div className="rang" style={{ gap: 'var(--e2)' }}>
              <button type="button" className="touche" aria-pressed={filtres.joignabilite === 'tous'}
                      onClick={() => setFiltres((f) => ({ ...f, joignabilite: 'tous' }))}>Tous</button>
              <button type="button" className="touche" aria-pressed={filtres.joignabilite === 'confirme'}
                      onClick={() => setFiltres((f) => ({ ...f, joignabilite: 'confirme' }))}>Confirmé</button>
              <button type="button" className="touche" aria-pressed={filtres.joignabilite === 'a_verifier'}
                      onClick={() => setFiltres((f) => ({ ...f, joignabilite: 'a_verifier' }))}>À vérifier</button>
            </div>
          </div>

          <div className="pile-s">
            <span className="etiquette">Ancienneté</span>
            <button type="button" className="touche" aria-pressed={filtres.sans_don_depuis_un_an}
                    onClick={() => setFiltres((f) => ({ ...f, sans_don_depuis_un_an: !f.sans_don_depuis_un_an }))}>
              Aucun don depuis un an
            </button>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
            {chips.map((chip) => (
              <span key={chip.cle} className="rang"
                    style={{ gap: 'var(--e2)', border: '1px solid var(--trait)', padding: '4px 4px 4px 10px' }}>
                <span className="petit">{chip.mot}</span>
                <button type="button" className="lien" style={{ minHeight: 0, fontSize: 'var(--t-micro)' }}
                        onClick={chip.retirer}>
                  retirer
                </button>
              </span>
            ))}
            {chips.length > 1 && (
              <button type="button" className="lien" style={{ fontSize: 'var(--t-petit)' }}
                      onClick={() => { setTexteSaisie(''); setFiltres(FILTRES_VIDES); }}>
                Retirer tous les filtres
              </button>
            )}
          </div>
        )}
      </div>

      {!donnees ? (
        <LignesEnAttente nombre={6} />
      ) : donnees.lignes.length === 0 ? (
        <div className="etat-vide pile-s">
          <p className="lead">Aucun donneur ne correspond à ces filtres.</p>
          <p className="appui">{suggestion?.texte || 'Chargement de la suggestion…'}</p>
          {suggestion?.retirer && (
            <Bouton variante="discret" compact onClick={suggestion.retirer}>Appliquer ce retrait</Bouton>
          )}
        </div>
      ) : (
        <>
          <div className="registre-defilant">
            <table className="registre">
              <thead>
                <tr>
                  <th>Nom</th><th>Groupe</th><th>Zone</th><th>Téléphone</th>
                  <th>Dernier don</th><th className="nombre">Dons</th><th>Peut donner</th>
                </tr>
              </thead>
              <tbody>
                {donnees.lignes.map((ligne) => {
                  const info = infoNumero(ligne);
                  return (
                    <tr key={ligne.id_donneur} className={`cliquable ${info?.alerte ? 'numero-douteux' : ''}`}
                        tabIndex={0} role="link"
                        aria-label={`Ouvrir la fiche de ${ligne.prenom} ${ligne.nom}`}
                        onClick={() => routeur.push(`/gestion/donneurs/${ligne.id_donneur}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            routeur.push(`/gestion/donneurs/${ligne.id_donneur}`);
                          }
                        }}>
                      <td style={{ fontWeight: 600 }}>{ligne.prenom} {ligne.nom}</td>
                      <td><BlocGroupe groupe={ligne.groupe_sanguin} taille="xs" /></td>
                      <td className="appui">
                        {ligne.zone_nom} ({ligne.zone_ville})
                        {ligne.repere_position && <><br /><span className="petit">{ligne.repere_position}</span></>}
                      </td>
                      <td className="mono">
                        {numeroLisible(ligne.numero_principal) || 'Aucun numéro'}
                        {info && <><br /><span className="petit" style={{ fontFamily: 'inherit' }}>{info.texte}</span></>}
                      </td>
                      <td className="mono appui">
                        {ligne.date_dernier_don ? dateCourte(ligne.date_dernier_don) : '—'}
                      </td>
                      <td className="nombre">{ligne.nb_dons_total}</td>
                      <td className="appui" style={{ fontWeight: ligne.eligible_aujourdhui ? 600 : 400 }}>
                        {ligne.eligible_aujourdhui
                          ? 'Aujourd’hui'
                          : ligne.date_prochaine_eligibilite
                            ? dateLongue(ligne.date_prochaine_eligibilite)
                            : 'À revoir avec le centre'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rang-espace">
            <span className="petit">
              {depart + 1} à {Math.min(depart + donnees.lignes.length, donnees.total)} sur {donnees.total}
            </span>
            <div className="rang" style={{ gap: 'var(--e2)' }}>
              <Bouton variante="discret" compact disabled={depart === 0}
                      enfantIcone={ChevronLeft}
                      onClick={() => setDepart(Math.max(0, depart - LIMITE))}>
                Précédent
              </Bouton>
              <Bouton variante="discret" compact disabled={depart + LIMITE >= donnees.total}
                      onClick={() => setDepart(depart + LIMITE)}>
                Suivant
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </Bouton>
            </div>
          </div>

          {resume && (
            <div className="pile-s">
              <p className="appui">Ce résumé porte sur les {pluriel(donnees.total, 'donneur')} de cette liste, pas sur le registre entier.</p>
              <div className="ligne-valeurs">
                <div>
                  <p className="mot">Peuvent donner aujourd’hui</p>
                  <p className="valeur">{resume.peuvent_donner_aujourdhui}</p>
                </div>
                <div>
                  <p className="mot">Numéros confirmés</p>
                  <p className="valeur">{resume.numeros_confirmes}</p>
                </div>
                <div>
                  <p className="mot">Numéros à vérifier</p>
                  <p className="valeur">{resume.numeros_a_verifier}</p>
                </div>
                <div>
                  <p className="mot">Sans don depuis un an</p>
                  <p className="valeur">{resume.sans_don_depuis_un_an}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <p className="petit">
        Les numéros affichés ici servent à organiser un appel au don. Cette consultation est
        inscrite dans le journal d’activité du centre, avec les filtres utilisés.
      </p>
    </div>
  );
}
