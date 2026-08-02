'use client';
// =====================================================================
//  E25 · Seuils de stock.
//  Le stock du jour est rappelé à côté de chaque champ : on règle un
//  seuil en regardant la réalité, pas une liste isolée. Une ligne
//  modifiée porte un filet en Encre et garde sa valeur précédente en vue.
// =====================================================================
import { useEffect, useState } from 'react';
import { Save, Info, RotateCcw } from 'lucide-react';
import { listerSeuilsGestion, modifierSeuilsGestion } from '@/lib/api';
import BlocGroupe from '../../../composants/BlocGroupe';
import Bouton from '../../../composants/Bouton';
import Confirmation from '../../../composants/Confirmation';
import { MessageErreur, MessageReussite } from '../../../composants/Message';
import { LignesEnAttente } from '../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../composants/AideEcran';
import { pluriel } from '@/lib/format';

const MOTS_NIVEAU = { critique: 'Critique', bas: 'Bas', normal: 'Normal', en_attente: 'En attente de premier don' };

// Valeurs de départ raisonnables, identiques à celles posées à la
// création d'une structure (annexe B) : un point de repère pour un
// centre qui ne sait pas encore par où commencer.
const VALEUR_CONSEILLEE_BASSE = 10;
const VALEUR_CONSEILLEE_CRITIQUE = 5;

function niveauCalcule(disponibles, bas, critique, aucunePoche) {
  if (aucunePoche) return 'en_attente';
  if (!Number.isFinite(bas) || !Number.isFinite(critique)) return null;
  if (disponibles <= critique) return 'critique';
  if (disponibles <= bas) return 'bas';
  return 'normal';
}

// Traduit une paire de seuils en phrase concrète : ce que ces deux
// nombres veulent dire pour ce groupe, en langage courant.
function queVeutDireCela(bas, critique) {
  if (!Number.isFinite(bas) || !Number.isFinite(critique) || bas <= 0 || critique <= 0) return null;
  if (critique >= bas) {
    return `Alerte dès ${pluriel(critique, 'poche')} ou moins.`;
  }
  return `Alerte dès ${pluriel(critique, 'poche')} ou moins. Signalement entre ${critique + 1} et ${bas} poches.`;
}

export default function Seuils() {
  const [origine, setOrigine] = useState(null);
  const [lignes, setLignes] = useState(null);
  const [erreur, setErreur] = useState('');
  const [reussite, setReussite] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [confirmationReset, setConfirmationReset] = useState(false);
  const [aideOuverte, alternerAide] = useAide('seuils');

  async function recharger() {
    const resultat = await listerSeuilsGestion();
    setOrigine(resultat.seuils);
    setLignes(resultat.seuils.map((ligne) => ({
      groupe_sanguin: ligne.groupe_sanguin,
      poches_disponibles: ligne.poches_disponibles,
      seuil_bas: String(ligne.seuil_bas ?? ''),
      seuil_critique: String(ligne.seuil_critique ?? '')
    })));
  }

  useEffect(() => { recharger().catch((probleme) => setErreur(probleme.message)); }, []);

  useEffect(() => {
    if (!reussite) return;
    const minuterie = setTimeout(() => setReussite(''), 3000);
    return () => clearTimeout(minuterie);
  }, [reussite]);

  if (!lignes) {
    return <div className="contenu-registre pile-l"><LignesEnAttente nombre={8} /></div>;
  }

  function modifierChamp(groupe, champ, valeur) {
    setLignes(lignes.map((ligne) => (
      ligne.groupe_sanguin === groupe ? { ...ligne, [champ]: valeur } : ligne
    )));
  }

  function remettreValeursConseillees() {
    setLignes(lignes.map((ligne) => ({
      ...ligne,
      seuil_bas: String(VALEUR_CONSEILLEE_BASSE),
      seuil_critique: String(VALEUR_CONSEILLEE_CRITIQUE)
    })));
    setConfirmationReset(false);
  }

  const parGroupeOrigine = new Map(origine.map((ligne) => [ligne.groupe_sanguin, ligne]));
  const aucunePoche = origine.every((ligne) => ligne.niveau === 'en_attente');
  const modifiees = lignes.filter((ligne) => {
    const avant = parGroupeOrigine.get(ligne.groupe_sanguin);
    return String(avant.seuil_bas) !== ligne.seuil_bas || String(avant.seuil_critique) !== ligne.seuil_critique;
  });

  const changementsNiveau = modifiees
    .map((ligne) => {
      const avant = parGroupeOrigine.get(ligne.groupe_sanguin);
      const niveauAvant = avant.niveau;
      const niveauApres = niveauCalcule(
        ligne.poches_disponibles, Number(ligne.seuil_bas), Number(ligne.seuil_critique), aucunePoche);
      return { groupe: ligne.groupe_sanguin, niveauAvant, niveauApres };
    })
    .filter((changement) => changement.niveauAvant !== changement.niveauApres);

  let resume = '';
  if (modifiees.length > 0) {
    resume = `${pluriel(modifiees.length, 'seuil')} ${modifiees.length > 1 ? 'seront modifiés' : 'sera modifié'}.`;
    if (changementsNiveau.length > 0) {
      resume += ' ' + changementsNiveau
        .map((c) => `${c.groupe} passera de ${MOTS_NIVEAU[c.niveauAvant] || '—'} à ${MOTS_NIVEAU[c.niveauApres] || '—'}`)
        .join(', ') + '.';
    }
  }

  async function enregistrer() {
    setErreur(''); setEnCours(true);
    try {
      await modifierSeuilsGestion(modifiees.map((ligne) => ({
        groupe_sanguin: ligne.groupe_sanguin,
        seuil_bas: Number(ligne.seuil_bas),
        seuil_critique: Number(ligne.seuil_critique)
      })));
      await recharger();
      setReussite('Seuils enregistrés.');
    } catch (probleme) {
      setErreur(probleme.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Seuils de stock</h1>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran sert à régler les deux seuils de chaque groupe sanguin : à partir de quel
        nombre de poches faut-il s’inquiéter. Le stock du jour s’affiche à côté de chaque champ,
        pour ne jamais régler un seuil dans l’abstrait. Changez une valeur : l’écran vous dit ce
        que cela change avant que vous n’enregistriez. Si vous ne savez pas par où commencer,
        utilisez « Remettre les valeurs conseillées ».
      </PanneauAide>

      <div className="encadre">
        <Info size={18} strokeWidth={1.75} aria-hidden="true" />
        <span>
          Un seuil est le nombre de poches en dessous duquel il faut réagir. Le seuil bas
          signale que le stock descend. Le seuil critique déclenche l’alerte et propose de
          lancer un appel au don. Le seuil critique est toujours plus petit que le seuil bas.
          Ces valeurs dépendent des besoins de votre centre : elles sont fixées par le
          responsable du registre.
        </span>
      </div>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      <div className="registre-defilant">
        <table className="registre">
          <thead>
            <tr>
              <th>Groupe</th>
              <th className="nombre">Stock du jour</th>
              <th>Seuil bas</th>
              <th>Seuil critique</th>
              <th>Ce que cela veut dire</th>
              <th>Conséquence du réglage</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => {
              const avant = parGroupeOrigine.get(ligne.groupe_sanguin);
              const modifiee = String(avant.seuil_bas) !== ligne.seuil_bas
                || String(avant.seuil_critique) !== ligne.seuil_critique;
              const niveauApres = niveauCalcule(
                ligne.poches_disponibles, Number(ligne.seuil_bas), Number(ligne.seuil_critique), aucunePoche);
              const texteConsequence = !modifiee
                ? '—'
                : niveauApres === avant.niveau
                  ? 'inchangé'
                  : `${MOTS_NIVEAU[avant.niveau] || '—'} → ${MOTS_NIVEAU[niveauApres] || '—'}`;
              return (
                <tr key={ligne.groupe_sanguin} className={modifiee ? 'niveau-modifiee' : ''}>
                  <td><BlocGroupe groupe={ligne.groupe_sanguin} taille="s" /></td>
                  <td className="nombre">{pluriel(ligne.poches_disponibles, 'poche')}</td>
                  <td>
                    <input className="champ-saisie mono" type="number" min="1" style={{ width: 80 }}
                           value={ligne.seuil_bas}
                           onChange={(e) => modifierChamp(ligne.groupe_sanguin, 'seuil_bas', e.target.value)} />
                    {modifiee && String(avant.seuil_bas) !== ligne.seuil_bas && (
                      <span className="petit"> (auparavant {avant.seuil_bas})</span>
                    )}
                  </td>
                  <td>
                    <input className="champ-saisie mono" type="number" min="1" style={{ width: 80 }}
                           value={ligne.seuil_critique}
                           onChange={(e) => modifierChamp(ligne.groupe_sanguin, 'seuil_critique', e.target.value)} />
                    {modifiee && String(avant.seuil_critique) !== ligne.seuil_critique && (
                      <span className="petit"> (auparavant {avant.seuil_critique})</span>
                    )}
                  </td>
                  <td className="appui">
                    {queVeutDireCela(Number(ligne.seuil_bas), Number(ligne.seuil_critique)) || '—'}
                  </td>
                  <td className="appui">{texteConsequence}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {resume && <p className="appui">{resume}</p>}

      <div className="rang-espace">
        <Bouton variante="principal" enfantIcone={Save} enCours={enCours}
                motEnCours="Enregistrement" disabled={modifiees.length === 0}
                title={modifiees.length === 0 ? 'Aucune valeur modifiée.' : undefined}
                onClick={enregistrer}>
          Enregistrer les seuils
        </Bouton>
        <button type="button" className="lien" onClick={() => setConfirmationReset(true)}>
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
          Remettre les valeurs conseillées
        </button>
      </div>

      <Confirmation
        ouverte={confirmationReset}
        titre="Remettre les huit seuils à leurs valeurs conseillées ?"
        motAction="Remettre les valeurs conseillées" varianteAction="secondaire"
        surConfirmer={remettreValeursConseillees} surAnnuler={() => setConfirmationReset(false)}
      >
        <p className="appui">
          Chaque groupe recevra un seuil bas de {VALEUR_CONSEILLEE_BASSE} poches et un seuil
          critique de {VALEUR_CONSEILLEE_CRITIQUE} poches. Rien n’est enregistré tant que vous
          n’avez pas cliqué sur « Enregistrer les seuils ».
        </p>
      </Confirmation>
    </div>
  );
}
