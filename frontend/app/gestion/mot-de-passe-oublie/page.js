// =====================================================================
//  E15 · Mot de passe oublié.
//  Page d'information, et non formulaire : un mot de passe du centre
//  est toujours remis par une personne, après vérification de
//  l'identité. C'est ce qui empêche qu'un compte soit repris.
// =====================================================================
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Mot de passe oublié' };

export default function MotDePasseOublie() {
  return (
    <main className="page-tache">
      <div className="pile-l">
        <div className="pile-s">
          <span className="mot-ecrit">DJIGUI</span>
          <span className="appui">Espace professionnel du centre de transfusion</span>
        </div>

        <div className="pile-s">
          <h1 className="titre">Mot de passe oublié</h1>
          <p className="appui">
            Il n&rsquo;y a rien à remplir ici. Un mot de passe du centre est toujours
            remis par une personne, après vérification de votre identité :
            c&rsquo;est ce qui empêche qu&rsquo;un compte d&rsquo;agent soit repris par
            quelqu&rsquo;un d&rsquo;autre.
          </p>
        </div>

        <div className="carte pile-s">
          <span className="etiquette">Administrateur du centre</span>
          <p className="appui">
            Adressez-vous à l&rsquo;administrateur de votre centre. Il ne peut pas
            vous redonner votre mot de passe : il vous en délivre un nouveau,
            valable quarante-huit heures, que vous remplacez à la première
            connexion.
          </p>
        </div>

        <Link href="/gestion/connexion" className="bouton bouton-principal bouton-large">
          <ArrowLeft size={18} strokeWidth={1.75} />Retour à la connexion
        </Link>

        <p className="petit" style={{ textAlign: 'center' }}>
          En cas d&rsquo;absence de l&rsquo;administrateur, l&rsquo;appel est pris par le
          secrétariat du centre.
        </p>
      </div>
    </main>
  );
}
