'use client';
// Connexion du donneur. Le numéro de téléphone est l'identifiant.
// Les agents du centre entrent par une adresse distincte (/gestion),
// jamais nommée ici.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { connexion, enregistrerJeton } from '@/lib/api';
import Bouton from '../composants/Bouton';
import { MessageErreur } from '../composants/Message';

export default function Connexion() {
  const routeur = useRouter();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [montrer, setMontrer] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function envoyer(evenement) {
    evenement.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      const resultat = await connexion(identifiant, motDePasse);
      enregistrerJeton(resultat.jeton);
      routeur.push(resultat.espace || '/carte');
    } catch (probleme) {
      setErreur(probleme.message);
      setEnCours(false);
    }
  }

  return (
    <main className="page-telephone sans-barre pile-l">
      <Link href="/" className="lien"><ArrowLeft size={18} strokeWidth={1.75} />Retour</Link>

      <div className="pile-s">
        <h1 className="titre">Je me connecte</h1>
        <p className="appui">Avec le numéro donné à l&rsquo;inscription.</p>
      </div>

      <form className="pile-l" onSubmit={envoyer}>
        <label className="champ">
          <span className="champ-etiquette">Numéro de téléphone</span>
          <span className="rang" style={{ gap: 'var(--e2)' }}>
            <span className="indicatif">+226</span>
            <input className="champ-saisie mono" inputMode="numeric" autoComplete="username"
                   value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />
          </span>
        </label>

        <label className={erreur ? 'champ champ-erreur' : 'champ'}>
          <span className="champ-etiquette rang-espace">
            Mot de passe
            <button type="button" className="lien"
                    style={{ minHeight: 0, fontWeight: 400, fontSize: 'var(--t-appui)' }}
                    onClick={() => setMontrer(!montrer)}>
              {montrer ? <><EyeOff size={16} strokeWidth={1.75} />Masquer</>
                       : <><Eye size={16} strokeWidth={1.75} />Montrer</>}
            </button>
          </span>
          <input className="champ-saisie" type={montrer ? 'text' : 'password'}
                 autoComplete="current-password" value={motDePasse}
                 onChange={(e) => setMotDePasse(e.target.value)} />
        </label>

        <MessageErreur>{erreur}</MessageErreur>

        <Bouton variante="principal" large type="submit" enCours={enCours}
                motEnCours="Connexion" onClick={envoyer}>
          Me connecter
        </Bouton>
      </form>

      <div style={{ textAlign: 'center' }}>
        <Link href="/recuperation" className="lien">Retrouver mon compte</Link>
      </div>
    </main>
  );
}
