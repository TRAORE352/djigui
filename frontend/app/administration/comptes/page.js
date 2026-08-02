'use client';
// =====================================================================
//  E27, E27 bis, E28 · Comptes professionnels.
//  E28 donne la liste et les deux seules actions possibles : désactiver
//  et réinitialiser. Un compte n'est jamais supprimé, pour que le
//  journal reste lisible et attribuable.
//  E27 bis est le seul moment où un mot de passe provisoire est lisible.
// =====================================================================
import { useEffect, useState } from 'react';
import {
  Plus, RotateCcw, UserMinus, UserCheck, Copy, Check, ShieldAlert
} from 'lucide-react';
import {
  listerComptes, identifiantPropose, creerCompte, accuserRemise,
  reinitialiserMotDePasse, changerStatutCompte, listerReferentiels, monCompte
} from '@/lib/api';
import { dateHeure, pluriel } from '@/lib/format';
import Bouton from '../../composants/Bouton';
import Confirmation from '../../composants/Confirmation';
import Etat from '../../composants/Etat';
import Repliable from '../../composants/Repliable';
import { MessageErreur, MessageReussite } from '../../composants/Message';
import { LignesEnAttente } from '../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../composants/AideEcran';

// Encadré du mot de passe provisoire : le seul élément appuyé de
// l'écran, avec la consigne de remise de vive voix.
function RemiseProvisoire({ remise, surAccuser }) {
  const [copie, setCopie] = useState(false);
  return (
    <div className="carte pile-l" style={{ borderColor: 'var(--encre)', borderWidth: 2 }}>
      <MessageReussite>
        Le compte de {remise.prenom} {remise.nom} est actif
        {remise.structure_nom ? `, rattaché à ${remise.structure_nom}` : ''}.
      </MessageReussite>

      <div className="pile">
        <span className="etiquette">Visible une seule fois</span>

        <div className="pile-s">
          <span className="petit">Identifiant</span>
          <span className="mono" style={{ fontSize: 'var(--t-titre-s)' }}>{remise.identifiant}</span>
        </div>

        <div className="pile-s">
          <span className="petit">Mot de passe provisoire</span>
          <div className="rang" style={{ gap: 'var(--e4)' }}>
            <span className="mono" style={{ fontSize: 28, letterSpacing: '.08em' }}>
              {remise.mot_de_passe_provisoire}
            </span>
            <button type="button" className="lien" style={{ fontSize: 'var(--t-appui)' }}
                    onClick={() => {
                      navigator.clipboard?.writeText(remise.mot_de_passe_provisoire);
                      setCopie(true);
                      setTimeout(() => setCopie(false), 2000);
                    }}>
              {copie ? <><Check size={16} strokeWidth={2} />Copié</>
                     : <><Copy size={16} strokeWidth={1.75} />Copier</>}
            </button>
          </div>
        </div>

        <p className="appui">
          Ce mot de passe ne sera plus jamais affiché, ni à vous, ni à personne
          d&rsquo;autre. Remettez-le de vive voix à l&rsquo;agent. Ne l&rsquo;envoyez
          jamais par message ni par courrier électronique.
        </p>
        <Etat ton="ocre">
          Il expire dans {pluriel(remise.validite_heures, 'heure')}. Passé ce délai,
          réinitialisez le mot de passe depuis cette liste.
        </Etat>
      </div>

      <Bouton variante="encre" onClick={surAccuser}>J&rsquo;ai remis le mot de passe</Bouton>
    </div>
  );
}

export default function Comptes() {
  const [comptes, setComptes] = useState(null);
  const [structures, setStructures] = useState([]);
  const [moi, setMoi] = useState(null);
  const [erreur, setErreur] = useState('');
  const [reussite, setReussite] = useState('');
  const [enCours, setEnCours] = useState(false);

  const [formulaire, setFormulaire] = useState(null);
  const [remise, setRemise] = useState(null);
  const [aDesactiver, setADesactiver] = useState(null);
  const [refus, setRefus] = useState(null);
  const [aideOuverte, alternerAide] = useAide('comptes');

  async function recharger() {
    const [liste, referentiels, compteCourant] = await Promise.all([
      listerComptes(), listerReferentiels(), monCompte()
    ]);
    setComptes(liste.comptes);
    setStructures(referentiels.structures);
    setMoi(compteCourant);
  }
  useEffect(() => { recharger().catch((probleme) => setErreur(probleme.message)); }, []);

  useEffect(() => {
    if (!reussite) return;
    const minuterie = setTimeout(() => setReussite(''), 3000);
    return () => clearTimeout(minuterie);
  }, [reussite]);

  // L'identifiant est proposé dès que le nom et le prénom sont écrits.
  useEffect(() => {
    if (!formulaire || formulaire.identifiantTouche) return;
    if (!formulaire.nom.trim() || !formulaire.prenom.trim()) return;
    const minuterie = setTimeout(() => {
      identifiantPropose(formulaire.prenom, formulaire.nom)
        .then((resultat) => setFormulaire((avant) =>
          avant && !avant.identifiantTouche
            ? { ...avant, identifiant: resultat.identifiant } : avant))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(minuterie);
  }, [formulaire?.nom, formulaire?.prenom, formulaire?.identifiantTouche]);

  if (!comptes) {
    return <div className="contenu-registre pile-l"><LignesEnAttente nombre={6} /></div>;
  }

  const actifs = comptes.filter((compte) => compte.statut === 'actif');
  const administrateurs = actifs.filter((compte) => compte.role === 'admin').length;

  return (
    <div className="contenu-registre pile-l">
      <div className="entete-ecran">
        <div className="pile-s">
          <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
            <h1 className="titre-grand">Comptes</h1>
            <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
          </div>
          <p className="appui">
            {pluriel(comptes.length, 'compte professionnel', 'comptes professionnels')}.
            {' '}{pluriel(administrateurs, 'administrateur')},
            {' '}{pluriel(actifs.length - administrateurs, 'gestionnaire')}.
          </p>
        </div>
        {!formulaire && !remise && (
          <Bouton variante="encre" enfantIcone={Plus}
                  onClick={() => setFormulaire({
                    nom: '', prenom: '', identifiant: '', identifiantTouche: false,
                    fonction: '', id_structure: '', role: 'gestionnaire'
                  })}>
            Créer un compte gestionnaire
          </Bouton>
        )}
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran liste les comptes professionnels et permet d’en créer, d’en réinitialiser le
        mot de passe ou d’en retirer l’accès. Un gestionnaire est toujours rattaché à une seule
        structure ; un administrateur ne l’est à aucune. Aucun compte ne se supprime jamais :
        seule la désactivation retire l’accès, en gardant intact ce que la personne a déjà
        enregistré.
      </PanneauAide>

      <p className="lead">
        Un compte donne accès au produit. Le gestionnaire travaille dans une seule structure :
        il y voit le stock, les donneurs et les appels au don. L’administrateur gère les accès
        et les réglages, mais ne voit jamais le sang.
      </p>

      <Repliable titre="Comment se passe l’arrivée d’un agent ?">
        <ol className="pile-s" style={{ paddingLeft: 'var(--e5)' }}>
          <li className="appui">Une demande écrite de la structure désigne l’agent et sa fonction.</li>
          <li className="appui">Vous créez son compte et choisissez sa structure de rattachement.</li>
          <li className="appui">
            Un mot de passe provisoire s’affiche une seule fois. Remettez-le de vive voix,
            jamais par message ni par courrier électronique.
          </li>
          <li className="appui">Il est valable quarante-huit heures.</li>
          <li className="appui">
            À sa première connexion, l’agent le remplace par un mot de passe que lui seul
            connaît.
          </li>
        </ol>
      </Repliable>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      {/* ------------------------- E27 bis ---------------------------- */}
      {remise && (
        <RemiseProvisoire
          remise={remise}
          surAccuser={async () => {
            try { await accuserRemise(remise.id_utilisateur); } catch { /* déjà noté */ }
            setRemise(null);
            await recharger();
          }}
        />
      )}

      {/* --------------------------- E27 ------------------------------ */}
      {formulaire && !remise && (
        <div className="carte pile-l contenu-formulaire">
          <div className="pile-s">
            <h2 className="lead">Créer un compte gestionnaire</h2>
            <p className="appui">
              Un compte gestionnaire donne accès à l&rsquo;espace de gestion d&rsquo;une
              seule structure. Renseignez les informations telles qu&rsquo;elles
              figurent sur la demande écrite.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--e5)' }}>
            <label className="champ champ-encadre">
              <span className="champ-etiquette">Nom</span>
              <input className="champ-saisie" autoFocus value={formulaire.nom}
                     onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })} />
            </label>
            <label className="champ champ-encadre">
              <span className="champ-etiquette">Prénom</span>
              <input className="champ-saisie" value={formulaire.prenom}
                     onChange={(e) => setFormulaire({ ...formulaire, prenom: e.target.value })} />
            </label>
          </div>

          <label className="champ champ-encadre">
            <span className="champ-etiquette">Identifiant</span>
            <input className="champ-saisie mono" value={formulaire.identifiant}
                   onChange={(e) => setFormulaire({
                     ...formulaire, identifiant: e.target.value, identifiantTouche: true
                   })} />
            <span className="champ-aide">
              Proposé à partir du nom. Vous pouvez le corriger avant de créer le compte.
            </span>
          </label>

          <div className="champ">
            <span className="champ-etiquette">Structure de rattachement</span>
            {structures.length === 0 ? (
              <p className="appui" style={{ marginTop: 'var(--e2)' }}>
                Aucune structure n&rsquo;existe encore. Créez-la d&rsquo;abord dans
                Structures et zones.
              </p>
            ) : (
              <select className="champ-saisie" value={formulaire.id_structure}
                      onChange={(e) => setFormulaire({ ...formulaire, id_structure: e.target.value })}>
                <option value="">Choisir…</option>
                {structures.map((structure) => (
                  <option key={structure.id_structure} value={structure.id_structure}>
                    {structure.nom} ({structure.ville})
                  </option>
                ))}
              </select>
            )}
            <span className="champ-aide">
              La structure choisie détermine tout ce que l&rsquo;agent verra. Un
              gestionnaire d&rsquo;un centre ne voit ni les poches ni les demandes
              des autres structures.
            </span>
          </div>

          <label className="champ champ-encadre">
            <span className="champ-etiquette">Fonction</span>
            <input className="champ-saisie" value={formulaire.fonction}
                   placeholder="Technicien de laboratoire"
                   onChange={(e) => setFormulaire({ ...formulaire, fonction: e.target.value })} />
          </label>

          <div className="rang" style={{ gap: 'var(--e3)' }}>
            <Bouton variante="encre" enCours={enCours}
                    onClick={async () => {
                      setErreur(''); setEnCours(true);
                      try {
                        const resultat = await creerCompte({
                          nom: formulaire.nom, prenom: formulaire.prenom,
                          identifiant: formulaire.identifiant,
                          fonction: formulaire.fonction,
                          id_structure: formulaire.id_structure || null,
                          role: formulaire.role
                        });
                        setRemise(resultat);
                        setFormulaire(null);
                        await recharger();
                      } catch (probleme) { setErreur(probleme.message); }
                      finally { setEnCours(false); }
                    }}>
              Créer le compte
            </Bouton>
            <button type="button" className="lien" onClick={() => setFormulaire(null)}>
              Revenir à la liste
            </button>
          </div>
        </div>
      )}

      {/* --------------------------- E28 ------------------------------ */}
      <div className="registre-defilant">
        <table className="registre">
          <thead>
            <tr>
              <th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Structure</th>
              <th>État</th><th>Dernière connexion</th><th></th>
            </tr>
          </thead>
          <tbody>
            {comptes.map((compte) => {
              const soiMeme = moi && compte.id_utilisateur === moi.id_utilisateur;
              const endormi = compte.statut === 'actif' && compte.jours_sans_connexion > 60;
              return (
                <tr key={compte.id_utilisateur}
                    className={compte.statut === 'desactive' ? 'attenue' : ''}>
                  <td style={{ fontWeight: 600 }}>{compte.prenom} {compte.nom}</td>
                  <td className="mono">{compte.identifiant}</td>
                  <td className="appui">
                    {compte.role === 'admin' ? 'Administrateur' : 'Gestionnaire'}
                  </td>
                  <td className="appui">{compte.structure_nom || '\u2014'}</td>
                  <td>
                    {compte.statut === 'desactive' ? (
                      <Etat ton="neutre" taille={16}>Désactivé</Etat>
                    ) : endormi ? (
                      <Etat ton="ocre" taille={16}>
                        Inutilisé depuis {pluriel(compte.jours_sans_connexion, 'jour')}
                      </Etat>
                    ) : compte.doit_changer_mot_de_passe ? (
                      <Etat ton="ocre" taille={16}>Mot de passe à changer</Etat>
                    ) : (
                      <Etat ton="seve" taille={16}>Actif</Etat>
                    )}
                  </td>
                  <td className="mono appui">
                    {compte.derniere_connexion ? dateHeure(compte.derniere_connexion) : 'Jamais'}
                  </td>
                  <td className="actions">
                    {soiMeme ? (
                      <span className="petit">Vous-même</span>
                    ) : compte.statut === 'desactive' ? (
                      <button type="button" className="lien" style={{ fontSize: 'var(--t-appui)' }}
                              onClick={async () => {
                                setErreur('');
                                try {
                                  const resultat = await changerStatutCompte(compte.id_utilisateur, 'actif');
                                  setReussite(resultat.message);
                                  await recharger();
                                } catch (probleme) { setErreur(probleme.message); }
                              }}>
                        <UserCheck size={15} strokeWidth={1.75} />Réactiver
                      </button>
                    ) : (
                      <>
                        <button type="button" className="lien" style={{ fontSize: 'var(--t-appui)' }}
                                onClick={() => setADesactiver(compte)}>
                          <UserMinus size={15} strokeWidth={1.75} />Désactiver
                        </button>
                        <button type="button" className="lien" style={{ fontSize: 'var(--t-appui)' }}
                                onClick={async () => {
                                  setErreur('');
                                  try {
                                    const resultat = await reinitialiserMotDePasse(compte.id_utilisateur);
                                    setRemise({ ...resultat, id_utilisateur: compte.id_utilisateur });
                                    await recharger();
                                  } catch (probleme) { setErreur(probleme.message); }
                                }}>
                          <RotateCcw size={15} strokeWidth={1.75} />Réinitialiser
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="petit">
        Un compte n&rsquo;est jamais supprimé. La désactivation retire l&rsquo;accès
        immédiatement et conserve au journal les écritures faites par cette personne : on
        doit toujours pouvoir savoir qui a enregistré quel don, même des années plus tard.
      </p>

      {/* --------------------- E28 bis, confirmation ------------------ */}
      <Confirmation
        ouverte={Boolean(aDesactiver)}
        titre={aDesactiver
          ? `Désactiver le compte de ${aDesactiver.prenom} ${aDesactiver.nom} ?` : ''}
        motAction="Désactiver le compte"
        motRetour="Revenir à la liste"
        varianteAction="principal"
        enCours={enCours}
        surAnnuler={() => setADesactiver(null)}
        surConfirmer={async () => {
          setEnCours(true);
          try {
            const resultat = await changerStatutCompte(aDesactiver.id_utilisateur, 'desactive');
            setReussite(resultat.message);
            setADesactiver(null);
            await recharger();
          } catch (probleme) {
            setRefus(probleme.message);
            setADesactiver(null);
          } finally { setEnCours(false); }
        }}
      >
        {aDesactiver && (
          <>
            <p className="appui">
              Cet agent perdra l&rsquo;accès à l&rsquo;espace de gestion
              {aDesactiver.structure_nom ? ` de ${aDesactiver.structure_nom}` : ''} dès
              maintenant. Sa session ouverte, s&rsquo;il en a une, sera fermée dans la minute.
            </p>
            <div className="encadre">
              <span>
                Le compte n&rsquo;est pas supprimé. Ses écritures restent attachées à son
                nom dans le journal, afin que celui-ci reste lisible.
                Réactivation possible à tout moment depuis cette liste.
              </span>
            </div>
          </>
        )}
      </Confirmation>

      {/* --------------------- Refus du système ----------------------- */}
      <Confirmation
        ouverte={Boolean(refus)}
        titre="Désactivation impossible"
        motAction="J&rsquo;ai compris"
        motRetour="Fermer"
        varianteAction="encre"
        surAnnuler={() => setRefus(null)}
        surConfirmer={() => setRefus(null)}
      >
        <div className="encadre encadre-ocre">
          <ShieldAlert size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>{refus}</span>
        </div>
      </Confirmation>
    </div>
  );
}
