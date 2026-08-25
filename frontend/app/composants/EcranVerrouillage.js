'use client';
// =====================================================================
//  DJIGUI — écran de verrouillage de l'application (E5 et suivants).
//  Le jeton reste valide : cet écran ne fait que masquer le contenu et
//  redemander le mot de passe, jamais le numéro. Cinq essais, comme le
//  verrouillage de connexion (RG35) ; le cinquième échec déconnecte
//  complètement plutôt que de laisser insister sur un compte bloqué.
// =====================================================================
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { Eye, EyeOff, LogOut } from 'lucide-react';
import { deverrouillerApplication, enregistrerJeton, marquerDeverrouille, effacerJeton } from '@/lib/api';
import LogoPulsant from './LogoPulsant';
import Bouton from './Bouton';
import { MessageErreur } from './Message';

const ESSAIS_MAX = 5;

export default function EcranVerrouillage({ onDeverrouille }) {
  const routeur = useRouter();
  const mouvementReduit = useReducedMotion();
  const [motDePasse, setMotDePasse] = useState('');
  const [montrer, setMontrer] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [essais, setEssais] = useState(0);

  function deconnecterCompletement() {
    effacerJeton();
    routeur.replace('/connexion');
  }

  async function tenter(evenement) {
    evenement.preventDefault();
    if (!motDePasse || enCours) return;
    setErreur('');
    setEnCours(true);
    try {
      const resultat = await deverrouillerApplication(motDePasse);
      enregistrerJeton(resultat.jeton);
      marquerDeverrouille();
      onDeverrouille();
    } catch (probleme) {
      const essaisFaits = essais + 1;
      setEssais(essaisFaits);
      setMotDePasse('');
      setEnCours(false);
      if (probleme.statut === 423 || probleme.donnees?.essais_restants === 0 || essaisFaits >= ESSAIS_MAX) {
        deconnecterCompletement();
        return;
      }
      setErreur(probleme.message);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--fond)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <motion.div
        initial={mouvementReduit ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="page-telephone"
        style={{ width: '100%', padding: 'var(--e5)' }}
      >
        <div className="pile-l" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div aria-hidden="true" style={{ filter: 'blur(5px)', opacity: 0.4 }}>
            <LogoPulsant taille={88} />
          </div>

          <div className="pile-s" style={{ alignItems: 'center' }}>
            <h1 className="titre-grand">Content de vous revoir</h1>
            <p className="appui">Entrez votre mot de passe pour retrouver votre compte.</p>
          </div>

          <form className="pile-l" style={{ width: '100%' }} onSubmit={tenter}>
            <label className={erreur ? 'champ champ-erreur' : 'champ'} style={{ textAlign: 'left' }}>
              <span className="champ-etiquette">Mot de passe</span>
              <span className="champ-saisie-groupe">
                <input className="champ-saisie-nue" type={montrer ? 'text' : 'password'}
                       autoComplete="current-password" autoFocus
                       value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
                <button type="button" className="champ-bouton-interne" onClick={() => setMontrer(!montrer)}>
                  {montrer ? <><EyeOff size={16} strokeWidth={1.75} />Masquer</>
                           : <><Eye size={16} strokeWidth={1.75} />Montrer</>}
                </button>
              </span>
            </label>

            <MessageErreur>{erreur}</MessageErreur>

            <Bouton variante="principal" large type="submit" enCours={enCours}
                    disabled={!motDePasse} motEnCours="Vérification" onClick={tenter}>
              Déverrouiller
            </Bouton>
          </form>

          <button type="button" className="lien" onClick={deconnecterCompletement}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--e2)', fontSize: 'var(--t-appui)' }}>
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            Ce n&rsquo;est pas moi, me déconnecter
          </button>
        </div>
      </motion.div>
    </div>
  );
}
