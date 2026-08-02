'use client';
// =====================================================================
//  E32 · Mon mot de passe.
//  Écran volontairement étroit : une tâche unique, rien d'autre à
//  distraire. Changer son propre mot de passe ferme toutes les
//  sessions ouvertes, y compris celle-ci (RG31) : l'écran le dit avant
//  d'agir, jamais après.
// =====================================================================
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { changerMotDePasse, effacerJeton } from '@/lib/api';
import Bouton from '../../composants/Bouton';
import { MessageErreur, MessageReussite } from '../../composants/Message';
import { useAide, BoutonAide, PanneauAide } from '../../composants/AideEcran';

// Force sur quatre niveaux, doublée d'un mot : la couleur n'est jamais
// seule porteuse du sens. Même calcul que app/mot-de-passe/page.js
// (E14) : logique reprise à l'identique, pas récrite.
function force(valeur) {
  let points = 0;
  if (valeur.length >= 8) points += 1;
  if (valeur.length >= 12) points += 1;
  if (/[a-zà-ÿ]/.test(valeur) && /[A-ZÀ-Ý]/.test(valeur)) points += 1;
  if (/\d/.test(valeur)) points += 1;
  if (/[^\w\s]/.test(valeur)) points += 1;
  const niveau = Math.min(points, 4);
  return { niveau, mot: ['trop faible', 'faible', 'moyenne', 'solide', 'suffisante'][niveau] };
}

export default function MonMotDePasse() {
  const routeur = useRouter();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [montrer, setMontrer] = useState(false);
  const [erreur, setErreur] = useState('');
  const [champFautif, setChampFautif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [reussite, setReussite] = useState('');
  const [aideOuverte, alternerAide] = useAide('mon-mot-de-passe');

  const mesure = force(nouveau);

  async function envoyer(evenement) {
    evenement.preventDefault();
    setErreur(''); setChampFautif('');
    if (confirmation !== nouveau) {
      setChampFautif('confirmation');
      setErreur('Les deux mots de passe ne sont pas identiques. Ressaisissez la confirmation.');
      return;
    }
    setEnCours(true);
    try {
      await changerMotDePasse({ ancien_mot_de_passe: ancien, mot_de_passe: nouveau, confirmation });
      setReussite('Mot de passe changé. Vous allez être redirigé vers la connexion.');
      setTimeout(() => {
        effacerJeton();
        routeur.replace('/gestion/connexion');
      }, 1800);
    } catch (probleme) {
      setErreur(probleme.message);
      setChampFautif(probleme.champ || 'mot_de_passe');
      setEnCours(false);
    }
  }

  return (
    <div className="contenu-formulaire pile-xl" style={{ maxWidth: 480 }}>
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Mon mot de passe</h1>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran change uniquement le mot de passe de votre propre compte. Le changement ferme
        toutes vos sessions ouvertes, y compris celle-ci : vous devrez vous reconnecter
        ensuite. Pour un agent qui a oublié le sien, utilisez la réinitialisation depuis
        l’écran Comptes plutôt que cet écran.
      </PanneauAide>

      <p className="lead">
        C’est le seul secret que vous pouvez modifier dans ce produit. Vous ne pouvez pas
        retrouver le mot de passe d’un agent : vous pouvez seulement lui en délivrer un nouveau
        depuis l’écran Comptes.
      </p>

      <p className="appui">
        Choisissez un nouveau mot de passe d’au moins dix caractères, avec une majuscule, une
        minuscule et un chiffre — un mot de passe que vous n’utilisez nulle part ailleurs.
      </p>

      <div className="encadre encadre-ocre">
        <ShieldAlert size={20} strokeWidth={1.75} aria-hidden="true" />
        <span>
          Après le changement, toutes vos sessions ouvertes seront fermées, y compris
          celle-ci. Vous devrez vous reconnecter avec le nouveau mot de passe.
        </span>
      </div>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      {!reussite && (
        <form className="pile-l" onSubmit={envoyer}>
          <label className={`champ champ-encadre ${champFautif === 'ancien_mot_de_passe' ? 'champ-erreur' : ''}`}>
            <span className="champ-etiquette">Mot de passe actuel</span>
            <input className="champ-saisie" type={montrer ? 'text' : 'password'}
                   autoComplete="current-password" autoFocus value={ancien}
                   onChange={(e) => setAncien(e.target.value)} />
          </label>

          <label className={`champ champ-encadre ${champFautif === 'mot_de_passe' ? 'champ-erreur' : ''}`}>
            <span className="champ-etiquette rang-espace">
              Nouveau mot de passe
              <button type="button" className="lien"
                      style={{ minHeight: 0, fontWeight: 400, fontSize: 'var(--t-appui)' }}
                      onClick={() => setMontrer(!montrer)}>
                {montrer ? <><EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />Masquer</>
                         : <><Eye size={16} strokeWidth={1.75} aria-hidden="true" />Afficher</>}
              </button>
            </span>
            <input className="champ-saisie" type={montrer ? 'text' : 'password'}
                   autoComplete="new-password" value={nouveau}
                   onChange={(e) => setNouveau(e.target.value)} />
            {nouveau && (
              <span className="pile-s" style={{ marginTop: 'var(--e2)' }}>
                <span className="force" aria-hidden="true">
                  {[1, 2, 3, 4].map((rang) => (
                    <span key={rang} className={
                      rang <= mesure.niveau ? `rempli ${mesure.niveau < 3 ? 'faible' : ''}` : ''
                    } />
                  ))}
                </span>
                <span className={`petit ${mesure.niveau >= 3 ? 'etat-seve' : 'etat-ocre'}`}
                      style={{ fontWeight: 600 }}>
                  Force : {mesure.mot}
                </span>
              </span>
            )}
          </label>

          <label className={`champ champ-encadre ${champFautif === 'confirmation' ? 'champ-erreur' : ''}`}>
            <span className="champ-etiquette">Confirmation du nouveau mot de passe</span>
            <input className="champ-saisie" type={montrer ? 'text' : 'password'}
                   autoComplete="new-password" value={confirmation}
                   onChange={(e) => setConfirmation(e.target.value)} />
          </label>

          <Bouton variante="encre" large type="submit" enCours={enCours} motEnCours="Enregistrement">
            Changer le mot de passe
          </Bouton>
        </form>
      )}
    </div>
  );
}
