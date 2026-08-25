'use client';
// Connexion du donneur. Le numéro de téléphone est l'identifiant.
// Les agents du centre entrent par une adresse distincte (/gestion),
// jamais nommée ici.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, Check } from 'lucide-react';
import { connexion, enregistrerJeton, marquerDeverrouille } from '@/lib/api';
import LogoPulsant from '../composants/LogoPulsant';
import Bouton from '../composants/Bouton';
import { MessageErreur } from '../composants/Message';

export default function Connexion() {
  const routeur = useRouter();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [montrer, setMontrer] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const numeroValide = /^\d{8}$/.test(identifiant.replace(/\D/g, ''));
  const formulaireValide = numeroValide && motDePasse.length > 0;

  async function envoyer(evenement) {
    evenement.preventDefault();
    if (!formulaireValide || enCours) return;
    setErreur('');
    setEnCours(true);
    try {
      const resultat = await connexion(identifiant, motDePasse);
      enregistrerJeton(resultat.jeton);
      marquerDeverrouille();
      routeur.push(resultat.espace || '/carte');
    } catch (probleme) {
      setErreur(probleme.message);
      setEnCours(false);
    }
  }

  return (
    <main className="auth-cadre">
      <Link href="/" className="lien"><ArrowLeft size={18} strokeWidth={1.75} />Retour</Link>

      <div className="auth-corps">
        <div className="auth-entete">
          <LogoPulsant taille={72} />
          <div className="pile-s">
            <h1 className="titre-grand">Heureux de vous revoir</h1>
            <p className="appui">Connectez-vous avec le numéro donné à l&rsquo;inscription.</p>
          </div>
        </div>

        <form className="pile-l" onSubmit={envoyer}>
          <label className={numeroValide ? 'champ champ-valide' : 'champ'}>
            <span className="champ-etiquette">Numéro de téléphone</span>
            <span className="champ-saisie-groupe">
              <span className="champ-prefixe">+226</span>
              <input className="champ-saisie-nue mono" inputMode="numeric" autoComplete="username"
                     value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />
              {numeroValide && (
                <motion.span className="champ-coche" initial={{ opacity: 0, scale: 0.7 }}
                             animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18 }}>
                  <Check size={20} strokeWidth={2} color="var(--seve)" aria-label="Numéro complet" />
                </motion.span>
              )}
            </span>
          </label>

          <label className={erreur ? 'champ champ-erreur' : 'champ'}>
            <span className="champ-etiquette">Mot de passe</span>
            <span className="champ-saisie-groupe">
              <input className="champ-saisie-nue" type={montrer ? 'text' : 'password'}
                     autoComplete="current-password" value={motDePasse}
                     onChange={(e) => setMotDePasse(e.target.value)} />
              <button type="button" className="champ-bouton-interne" onClick={() => setMontrer(!montrer)}>
                {montrer ? <><EyeOff size={16} strokeWidth={1.75} />Masquer</>
                         : <><Eye size={16} strokeWidth={1.75} />Montrer</>}
              </button>
            </span>
          </label>

          <div style={{ textAlign: 'right' }}>
            <Link href="/recuperation" className="lien" style={{ fontSize: 'var(--t-appui)' }}>
              Mot de passe oublié ?
            </Link>
          </div>

          <MessageErreur>{erreur}</MessageErreur>

          <div style={{ marginTop: 'var(--e4)' }}>
            <Bouton variante="principal" large type="submit" enCours={enCours}
                    disabled={!formulaireValide} motEnCours="Connexion" onClick={envoyer}>
              Se connecter
            </Bouton>
          </div>
        </form>

        <div style={{ textAlign: 'center' }}>
          <span className="petit">Pas encore inscrit ? </span>
          <Link href="/inscription" className="lien">Créer un compte</Link>
        </div>
      </div>
    </main>
  );
}
