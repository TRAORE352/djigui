'use client';
// =====================================================================
//  E22 · Registre des poches.
//  Filtres écrits comme on parle, jamais un mot de code. La ligne
//  choisie porte un filet épais, jamais un fond coloré ni une case à
//  cocher : l'action principale nomme la poche choisie.
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HeartHandshake } from 'lucide-react';
import { listerPochesGestion } from '@/lib/api';
import BlocGroupe from '../../../composants/BlocGroupe';
import Bouton from '../../../composants/Bouton';
import Repliable from '../../../composants/Repliable';
import { MessageErreur } from '../../../composants/Message';
import { LignesEnAttente } from '../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../composants/AideEcran';
import { dateCourte, ORDRE_GROUPES, pluriel } from '@/lib/format';

const SITUATIONS_FILTRE = [
  { cle: '', mot: 'Toutes' },
  { cle: 'disponible', mot: 'Disponible' },
  { cle: 'en_controle', mot: 'En contrôle' },
  { cle: 'reservee', mot: 'Réservée' },
  { cle: 'remise_au_service', mot: 'Remise au service' },
  { cle: 'perimee', mot: 'Poche périmée' }
];

// Explications des situations, dans l'ordre du parcours d'une poche.
const SITUATIONS_EXPLIQUEES = [
  { mot: 'Collectée', texte: 'le don vient d’être fait, la poche part au laboratoire.' },
  { mot: 'En contrôle', texte: 'le laboratoire vérifie la poche.' },
  { mot: 'Disponible', texte: 'la poche est prête, elle compte dans le stock.' },
  { mot: 'Réservée', texte: 'gardée pour un service, elle ne compte plus dans le stock.' },
  { mot: 'Remise au service', texte: 'elle a quitté le centre.' },
  { mot: 'Périmée', texte: 'la date de péremption est passée, seule la destruction reste possible.' },
  { mot: 'Détruite', texte: 'sortie du registre, avec son motif.' }
];

const LIMITE = 50;

export default function RegistreDesPoches() {
  const routeur = useRouter();
  const [situationFiltre, setSituationFiltre] = useState('');
  const [groupeFiltre, setGroupeFiltre] = useState('');
  const [lignes, setLignes] = useState(null);
  const [total, setTotal] = useState(0);
  const [erreur, setErreur] = useState('');
  const [enCoursSuite, setEnCoursSuite] = useState(false);
  const [selection, setSelection] = useState(null);
  const [aideOuverte, alternerAide] = useAide('poches');

  function charger(depart) {
    return listerPochesGestion({
      situation: situationFiltre || undefined,
      groupe: groupeFiltre || undefined,
      limite: LIMITE,
      depart
    });
  }

  useEffect(() => {
    setLignes(null);
    setSelection(null);
    charger(0)
      .then((resultat) => { setLignes(resultat.lignes); setTotal(resultat.total); })
      .catch((probleme) => setErreur(probleme.message));
  }, [situationFiltre, groupeFiltre]);

  function voirPlus() {
    setEnCoursSuite(true);
    charger(lignes.length)
      .then((resultat) => setLignes([...lignes, ...resultat.lignes]))
      .catch((probleme) => setErreur(probleme.message))
      .finally(() => setEnCoursSuite(false));
  }

  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Poches</h1>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
        <Bouton variante="principal" disabled={!selection}
                onClick={() => selection && routeur.push(`/gestion/poches/${encodeURIComponent(selection)}`)}>
          {selection ? `Ouvrir la poche ${selection}` : 'Choisissez une poche'}
        </Bouton>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran liste toutes les poches enregistrées dans votre structure, quelle que soit
        leur situation. Filtrez par situation ou par groupe pour retrouver rapidement ce que
        vous cherchez. Choisissez une poche pour ouvrir sa fiche complète et, si besoin, faire
        avancer sa situation.
      </PanneauAide>

      <p className="lead">
        Chaque don enregistré crée une poche. Cet écran suit leur parcours, du prélèvement
        jusqu’à la transfusion. Choisissez une poche pour changer sa situation.
      </p>

      <Repliable titre="Que veulent dire ces situations ?">
        <div className="pile-s">
          {SITUATIONS_EXPLIQUEES.map((s) => (
            <p key={s.mot} className="appui">
              <strong>{s.mot}</strong> : {s.texte}
            </p>
          ))}
        </div>
      </Repliable>

      <MessageErreur>{erreur}</MessageErreur>

      <div className="pile-s">
        <span className="etiquette">Situation</span>
        <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
          {SITUATIONS_FILTRE.map(({ cle, mot }) => (
            <button key={cle} type="button" className="touche"
                    aria-pressed={situationFiltre === cle}
                    onClick={() => setSituationFiltre(cle)}>
              {mot}
            </button>
          ))}
        </div>
      </div>

      <div className="pile-s">
        <span className="etiquette">Groupe</span>
        <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
          <button type="button" className="touche"
                  aria-pressed={groupeFiltre === ''}
                  onClick={() => setGroupeFiltre('')}>
            Tous les groupes
          </button>
          {ORDRE_GROUPES.map((groupe) => (
            <button key={groupe} type="button" className="touche-groupe" style={{ minHeight: 48, width: 64 }}
                    aria-pressed={groupeFiltre === groupe}
                    onClick={() => setGroupeFiltre(groupeFiltre === groupe ? '' : groupe)}>
              {groupe}
            </button>
          ))}
        </div>
      </div>

      {!lignes ? (
        <LignesEnAttente nombre={6} />
      ) : lignes.length === 0 && total === 0 && !situationFiltre && !groupeFiltre ? (
        <div className="etat-vide pile-s">
          <p className="lead">Aucune poche au registre pour l’instant.</p>
          <p className="appui">
            Les poches apparaîtront ici dès le premier don enregistré.{' '}
            <Link href="/gestion/enregistrer-un-don" className="lien" style={{ display: 'inline-flex' }}>
              <HeartHandshake size={16} strokeWidth={1.75} aria-hidden="true" />
              Enregistrer un don
            </Link>
          </p>
        </div>
      ) : lignes.length === 0 ? (
        <div className="etat-vide pile-s">
          <p className="lead">Aucune poche ne correspond à ces filtres.</p>
          <p className="appui">Changez la situation ou le groupe, ou revenez à « Toutes ».</p>
        </div>
      ) : (
        <>
          <div className="registre-defilant">
            <table className="registre">
              <thead>
                <tr>
                  <th>Code</th><th>Groupe</th><th>Prélevée le</th><th>Périme le</th>
                  <th className="nombre">Jours restants</th><th>Situation</th><th>Destination</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((poche) => {
                  const choisie = selection === poche.code_poche;
                  const enDanger = poche.statut !== 'perimee' && poche.statut !== 'detruite'
                    && poche.statut !== 'transfusee' && poche.jours_restants <= 0;
                  const bientot = poche.statut !== 'perimee' && poche.statut !== 'detruite'
                    && poche.statut !== 'transfusee' && poche.jours_restants > 0 && poche.jours_restants < 7;
                  return (
                    <tr key={poche.id_poche} className={`cliquable ${choisie ? 'choisie' : ''}`}
                        tabIndex={0} role="button" aria-pressed={choisie}
                        aria-label={`Choisir la poche ${poche.code_poche}`}
                        onClick={() => setSelection(choisie ? null : poche.code_poche)}
                        onKeyDown={(evenement) => {
                          if (evenement.key === 'Enter' || evenement.key === ' ') {
                            evenement.preventDefault();
                            setSelection(choisie ? null : poche.code_poche);
                          }
                        }}>
                      <td className="mono" style={{ fontWeight: choisie ? 700 : 400 }}>{poche.code_poche}</td>
                      <td><BlocGroupe groupe={poche.groupe_sanguin} taille="xs" /></td>
                      <td className="mono">{dateCourte(poche.date_prelevement)}</td>
                      <td className="mono">{dateCourte(poche.date_peremption)}</td>
                      <td className="nombre mono"
                          style={{ color: enDanger ? 'var(--sang)' : bientot ? 'var(--ocre)' : undefined }}>
                        {poche.jours_restants}
                      </td>
                      <td className="appui">{poche.situation_lisible}</td>
                      <td className="appui">{poche.destination || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rang-espace">
            <span className="petit">{pluriel(lignes.length, 'poche')} sur {pluriel(total, 'poche')}</span>
            {lignes.length < total && (
              <Bouton variante="discret" compact enCours={enCoursSuite} onClick={voirPlus}>
                Voir plus
              </Bouton>
            )}
          </div>
        </>
      )}
    </div>
  );
}
