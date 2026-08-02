// =====================================================================
//  E12 · Installer l'application.
//  Le titre dit le résultat, pas la procédure. Deux colonnes séparées
//  par un filet : on lit la sienne, on ignore l'autre.
// =====================================================================
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Installer l\u2019application' };

const MARCHES = [
  {
    systeme: 'Android',
    etapes: [
      'Touchez les trois points en haut à droite du navigateur.',
      'Dans la liste, choisissez « Ajouter à l\u2019écran d\u2019accueil ».',
      'Confirmez « Ajouter ». L\u2019icône DJIGUI apparaît avec vos autres applications.'
    ]
  },
  {
    systeme: 'iPhone',
    etapes: [
      'Touchez le bouton de partage, en bas au milieu de l\u2019écran.',
      'Faites défiler, puis choisissez « Sur l\u2019écran d\u2019accueil ».',
      'Touchez « Ajouter » en haut à droite. C\u2019est fait.'
    ]
  }
];

export default function Installation() {
  return (
    <main className="page-telephone sans-barre pile-l">
      <Link href="/" className="lien"><ArrowLeft size={18} strokeWidth={1.75} />Retour</Link>

      <div className="pile-s">
        <h1 className="titre">Mettre DJIGUI sur votre écran d&rsquo;accueil</h1>
        <p className="appui">Trois touches, une fois pour toutes. Rien à télécharger.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--e5)' }}>
        {MARCHES.map(({ systeme, etapes }, rang) => (
          <div key={systeme} className="pile-s"
               style={rang === 1
                 ? { borderLeft: '1px solid var(--trait)', paddingLeft: 'var(--e5)' }
                 : undefined}>
            <span className="etiquette">{systeme}</span>
            <ol className="pile-s" style={{ listStyle: 'none', padding: 0, fontSize: 'var(--t-appui)' }}>
              {etapes.map((etape, indice) => (
                <li key={etape} className="rang" style={{ alignItems: 'flex-start', gap: 'var(--e2)' }}>
                  <span className="mono petit" style={{ minWidth: 14, paddingTop: 2 }}>{indice + 1}</span>
                  <span>{etape}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <hr className="filet" />
      <p className="petit">
        Une fois installée, l&rsquo;application s&rsquo;ouvre sans navigateur et garde
        vos alertes même quand le réseau est coupé.
      </p>

      <Link href="/" className="bouton bouton-principal bouton-large">
        J&rsquo;ai installé l&rsquo;application
      </Link>
    </main>
  );
}
