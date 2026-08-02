'use client';
// =====================================================================
//  E14 et EC2 · Changement obligatoire du mot de passe.
//  Passage obligé de la première connexion et de toute réinitialisation :
//  le mot de passe remis de vive voix est provisoire, il ferme la
//  fenêtre pendant laquelle deux personnes le connaissent.
//  Les exigences sont visibles AVANT la saisie, jamais découvertes
//  après un refus.
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { Eye, EyeOff, Check } from 'lucide-react';
import { monCompte, changerMotDePasse, enregistrerJeton, lireJeton } from '@/lib/api';
import Bouton from '../composants/Bouton';
import { MessageErreur } from '../composants/Message';

const EXIGENCES = [
  { mot: 'Dix caractères au minimum.', tenue: (v) => v.length >= 10 },
  { mot: 'Une majuscule et une minuscule.', tenue: (v) => /[a-zà-ÿ]/.test(v) && /[A-ZÀ-Ý]/.test(v) },
  { mot: 'Un chiffre.', tenue: (v) => /\d/.test(v) },
  { mot: 'Un mot de passe que vous n\u2019utilisez nulle part ailleurs.', tenue: () => null }
];

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

export default function ChangementObligatoire() {
  const routeur = useRouter();
  const mouvementReduit = useReducedMotion();
  const [compte, setCompte] = useState(null);
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [montrer, setMontrer] = useState(false);
  const [erreur, setErreur] = useState('');
  const [champFautif, setChampFautif] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!lireJeton()) { routeur.replace('/gestion/connexion'); return; }
    monCompte().then(setCompte).catch(() => routeur.replace('/gestion/connexion'));
  }, [routeur]);

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
      const resultat = await changerMotDePasse({ mot_de_passe: nouveau, confirmation });
      enregistrerJeton(resultat.jeton);
      routeur.replace(resultat.espace);
    } catch (probleme) {
      setErreur(probleme.message);
      setChampFautif(probleme.champ || 'mot_de_passe');
      setEnCours(false);
    }
  }

  if (!compte) return null;

  return (
    <main className="page-tache">
      <motion.form
        className="pile-l" onSubmit={envoyer}
        initial={mouvementReduit ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <span className="mot-ecrit">DJIGUI</span>

        <div className="pile-s">
          <h1 className="titre">Choisissez votre mot de passe</h1>
          <p className="appui">
            Le mot de passe qui vous a été remis de vive voix est provisoire.
            Comme le poste est partagé, il doit être remplacé avant tout accès
            au registre. Le nouveau mot de passe n&rsquo;est connu de personne d&rsquo;autre.
          </p>
        </div>

        <div className="pile-s">
          <span className="etiquette">Ce que doit contenir le mot de passe</span>
          <ol className="pile-s" style={{ listStyle: 'none', padding: 0, fontSize: 'var(--t-appui)' }}>
            {EXIGENCES.map(({ mot, tenue }, rang) => {
              const etat = nouveau ? tenue(nouveau) : null;
              return (
                <li key={mot} className="rang" style={{ gap: 'var(--e2)', alignItems: 'flex-start' }}>
                  {etat === true
                    ? <Check size={16} strokeWidth={2} color="var(--seve)" aria-hidden="true" />
                    : <span className="mono petit" style={{ minWidth: 16 }}>{rang + 1}.</span>}
                  <span style={etat === true ? { color: 'var(--seve)' } : undefined}>{mot}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <label className={`champ champ-encadre ${champFautif === 'mot_de_passe' ? 'champ-erreur' : ''}`}>
          <span className="champ-etiquette rang-espace">
            Nouveau mot de passe
            <button type="button" className="lien"
                    style={{ minHeight: 0, fontWeight: 400, fontSize: 'var(--t-appui)' }}
                    onClick={() => setMontrer(!montrer)}>
              {montrer ? <><EyeOff size={16} strokeWidth={1.75} />Masquer</>
                       : <><Eye size={16} strokeWidth={1.75} />Afficher</>}
            </button>
          </span>
          <input className="champ-saisie" type={montrer ? 'text' : 'password'}
                 autoComplete="new-password" autoFocus value={nouveau}
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

        <MessageErreur>{erreur}</MessageErreur>

        <div className="pile-s">
          <Bouton variante="encre" large type="submit" enCours={enCours}
                  motEnCours="Enregistrement" onClick={envoyer}>
            Enregistrer et continuer
          </Bouton>
          <p className="petit" style={{ textAlign: 'center' }}>
            Vous serez conduit directement à votre espace de travail.
          </p>
        </div>
      </motion.form>
    </main>
  );
}
