'use client';
// =====================================================================
//  E13 · Connexion professionnelle.
//  Porte d'entrée unique des agents et des administrateurs, conçue pour
//  un poste partagé : deux champs, une action. La page ne révèle pas
//  qu'un espace d'administration existe : le service oriente ensuite
//  chacun vers le sien, sans le nommer.
//  Aucun lien de création de compte : les comptes sont délivrés.
// =====================================================================
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { connexion, enregistrerJeton } from '@/lib/api';
import Bouton from '../../composants/Bouton';
import { MessageErreur } from '../../composants/Message';

export default function ConnexionProfessionnelle() {
  const routeur = useRouter();
  const mouvementReduit = useReducedMotion();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [montrer, setMontrer] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function envoyer(evenement) {
    evenement.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const resultat = await connexion(identifiant, motDePasse);
      enregistrerJeton(resultat.jeton);
      routeur.push(resultat.espace);
    } catch (probleme) {
      setErreur(probleme.message);
      setEnCours(false);
    }
  }

  return (
    <main className="page-tache">
      <motion.form
        className="pile-l" onSubmit={envoyer}
        initial={mouvementReduit ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="pile-s">
          <span className="mot-ecrit">DJIGUI</span>
          <span className="appui">Espace professionnel du centre de transfusion</span>
        </div>

        <div className="pile-s">
          <h1 className="titre">Connexion professionnelle</h1>
          <p className="appui">
            Les comptes sont créés par l&rsquo;administrateur du centre. Aucune
            inscription n&rsquo;est possible depuis cette page.
          </p>
        </div>

        <MessageErreur>{erreur}</MessageErreur>

        <label className={`champ champ-encadre ${erreur ? 'champ-erreur' : ''}`}>
          <span className="champ-etiquette">Identifiant</span>
          <input className="champ-saisie mono" autoComplete="username" autoFocus
                 value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />
        </label>

        <label className={`champ champ-encadre ${erreur ? 'champ-erreur' : ''}`}>
          <span className="champ-etiquette rang-espace">
            Mot de passe
            <button type="button" className="lien"
                    style={{ minHeight: 0, fontWeight: 400, fontSize: 'var(--t-appui)' }}
                    onClick={() => setMontrer(!montrer)}>
              {montrer ? <><EyeOff size={16} strokeWidth={1.75} />Masquer</>
                       : <><Eye size={16} strokeWidth={1.75} />Afficher</>}
            </button>
          </span>
          <input className="champ-saisie" type={montrer ? 'text' : 'password'}
                 autoComplete="current-password" value={motDePasse}
                 onChange={(e) => setMotDePasse(e.target.value)} />
        </label>

        <Bouton variante="principal" large type="submit" enCours={enCours}
                motEnCours="Connexion" onClick={envoyer}>
          Se connecter
        </Bouton>

        <div style={{ textAlign: 'center' }}>
          <Link href="/gestion/mot-de-passe-oublie" className="lien"
                style={{ fontSize: 'var(--t-appui)' }}>
            Mot de passe oublié
          </Link>
        </div>
      </motion.form>
    </main>
  );
}
