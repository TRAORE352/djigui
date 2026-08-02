'use client';
// =====================================================================
//  E9 · Mes dons.
//  Le compteur est la récompense : il occupe la place d'un titre.
//  Aucune couleur dans la liste : un registre se lit en Encre.
// =====================================================================
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { mesDons } from '@/lib/api';
import { dateLongue } from '@/lib/format';
import { LignesEnAttente } from '../../composants/Squelette';
import { MessageErreur } from '../../composants/Message';

// Un compte de plus de trois mois sans aucun don a probablement déjà
// donné ailleurs avant d'installer DJIGUI : c'est la question qu'il se
// pose en voyant une liste vide après tout ce temps.
function creeDepuisPlusDeTroisMois(dateCreation) {
  if (!dateCreation) return false;
  const seuil = new Date();
  seuil.setMonth(seuil.getMonth() - 3);
  return new Date(dateCreation) < seuil;
}

export default function MesDons() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const mouvementReduit = useReducedMotion();

  useEffect(() => {
    mesDons().then(setDonnees).catch((probleme) => setErreur(probleme.message));
  }, []);

  if (erreur) {
    return <main className="page-telephone"><MessageErreur>{erreur}</MessageErreur></main>;
  }
  if (!donnees) {
    return <main className="page-telephone pile-l"><LignesEnAttente /></main>;
  }

  return (
    <motion.main
      className="page-telephone pile-l"
      initial={mouvementReduit ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <div className="pile-s">
        <span className="archivo" style={{ fontSize: 56, lineHeight: 1 }}>{donnees.nb_dons}</span>
        <span style={{ fontWeight: 600 }}>
          don{donnees.nb_dons > 1 ? 's' : ''} enregistré{donnees.nb_dons > 1 ? 's' : ''}
        </span>
        {donnees.premier_don && (
          <span className="petit">depuis {dateLongue(donnees.premier_don)}</span>
        )}
      </div>

      {donnees.dons.length === 0 ? (
        <p className="appui">
          {creeDepuisPlusDeTroisMois(donnees.date_creation)
            ? 'Si vous avez déjà donné dans un centre, vos dons passés n’apparaissent pas ici : seuls les dons enregistrés dans DJIGUI y figurent.'
            : 'Cette liste se remplira après votre premier passage au centre.'}
        </p>
      ) : (
        <div>
          {donnees.dons.map((don) => (
            <div key={don.id_don} className="ligne-fait" style={{ alignItems: 'flex-start' }}>
              <span className="pile-s">
                <span className="mono">{dateLongue(don.date_don)}</span>
                <span className="petit">{don.structure_nom}</span>
              </span>
              {don.code_poche && <span className="valeur petit">{don.code_poche}</span>}
            </div>
          ))}
        </div>
      )}

      <hr className="filet" />
      <p className="petit">
        Seuls les dons enregistrés par un centre apparaissent ici. Si un don
        manque, signalez-le à l&rsquo;accueil du centre concerné.
      </p>
    </motion.main>
  );
}
