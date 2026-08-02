'use client';
// =====================================================================
//  E8 · Ma disponibilité.
//  Trois questions. Aucune carte, aucun GPS, aucune autorisation
//  système : le repère est un texte libre écrit par le donneur.
// =====================================================================
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Footprints, Bike, Bus } from 'lucide-react';
import { detailAlerteDonneur, enregistrerDisponibiliteDonneur } from '@/lib/api';
import Bouton from '../../../../composants/Bouton';
import { MessageErreur, MessageReussite } from '../../../../composants/Message';
import { LignesEnAttente } from '../../../../composants/Squelette';

const MOYENS = [
  { cle: 'a_pied', mot: 'À pied', Icone: Footprints },
  { cle: 'deux_roues', mot: 'Deux-roues', Icone: Bike },
  { cle: 'transport_commun', mot: 'Taxi ou bus', Icone: Bus }
];
const CRENEAUX = ['8h à 10h', '10h à 12h', '12h à 14h', '14h à 16h'];

export default function MaDisponibilite() {
  const { id } = useParams();
  const [alerte, setAlerte] = useState(null);
  const [erreur, setErreur] = useState('');
  const [reussite, setReussite] = useState('');
  const [enCours, setEnCours] = useState(false);

  const [repere, setRepere] = useState('');
  const [moyen, setMoyen] = useState('');
  const [aideTransport, setAideTransport] = useState(false);
  const [creneau, setCreneau] = useState('');
  const [dejaRempli, setDejaRempli] = useState(false);

  useEffect(() => {
    detailAlerteDonneur(id).then((resultat) => {
      setAlerte(resultat);
      const fiche = resultat.fiche_disponibilite;
      if (fiche) {
        setRepere(fiche.repere_position || '');
        setMoyen(fiche.moyen_deplacement || '');
        setAideTransport(Boolean(fiche.besoin_aide_transport));
        setCreneau(fiche.creneau_prefere || '');
        setDejaRempli(true);
      }
    }).catch((probleme) => setErreur(probleme.message));
  }, [id]);

  async function enregistrer() {
    setEnCours(true); setErreur(''); setReussite('');
    try {
      await enregistrerDisponibiliteDonneur(id, {
        repere_position: repere.trim(),
        moyen_deplacement: moyen,
        besoin_aide_transport: aideTransport,
        creneau_prefere: creneau || null
      });
      setReussite('Disponibilité enregistrée.');
      setDejaRempli(true);
    } catch (probleme) {
      setErreur(probleme.message);
    } finally {
      setEnCours(false);
    }
  }

  if (erreur && !alerte) {
    return (
      <main className="page-telephone sans-barre pile-l">
        <Link href={`/alertes/${id}`} className="lien"><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Retour à l&rsquo;appel</Link>
        <MessageErreur>{erreur}</MessageErreur>
      </main>
    );
  }
  if (!alerte) {
    return <main className="page-telephone sans-barre pile-l"><LignesEnAttente /></main>;
  }

  const bloque = repere.trim().length < 3 || !moyen;

  return (
    <main className="page-telephone sans-barre pile-l">
      <Link href={`/alertes/${id}`} className="lien">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Retour à l&rsquo;appel
      </Link>

      <div className="pile-s">
        <h1 className="titre">Vous venez au {alerte.structure_nom}</h1>
        <p className="appui">Trois questions, pour organiser votre venue.</p>
      </div>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      <div className="pile-s">
        <label className="champ" htmlFor="repere">
          <span className="champ-etiquette">Où pouvons-nous vous situer ?</span>
          <input id="repere" className="champ-saisie" value={repere}
                 placeholder="Près du grand marché de Koulouba, portail bleu"
                 onChange={(e) => setRepere(e.target.value)} />
        </label>
        <span className="champ-aide">
          Aucune carte, aucune localisation : seulement ce que vous écrivez ici, pour que le
          centre sache d&rsquo;où vous venez.
        </span>
      </div>

      <div className="pile-s">
        <span className="champ-etiquette">Comment viendrez-vous ?</span>
        <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
          {MOYENS.map(({ cle, mot, Icone }) => (
            <button key={cle} type="button" className="touche" aria-pressed={moyen === cle}
                    onClick={() => setMoyen(cle)}>
              <Icone size={18} strokeWidth={1.75} aria-hidden="true" />{mot}
            </button>
          ))}
        </div>
      </div>

      <label className="rang" style={{ gap: 'var(--e3)' }}>
        <input type="checkbox" className="case-a-cocher" checked={aideTransport}
               onChange={(e) => setAideTransport(e.target.checked)} />
        <span>J&rsquo;ai besoin d&rsquo;aide pour me déplacer</span>
      </label>
      {aideTransport && (
        <p className="petit">Le centre vous rappelle pour organiser le trajet.</p>
      )}

      <div className="pile-s">
        <span className="champ-etiquette">Quel créneau vous convient ?</span>
        <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
          {CRENEAUX.map((c) => (
            <button key={c} type="button" className="touche mono" aria-pressed={creneau === c}
                    onClick={() => setCreneau(creneau === c ? '' : c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <Bouton variante="principal" large enCours={enCours} disabled={bloque}
              motEnCours="Enregistrement" onClick={enregistrer}>
        {dejaRempli ? 'Modifier ma disponibilité' : 'Enregistrer ma disponibilité'}
      </Bouton>
    </main>
  );
}
