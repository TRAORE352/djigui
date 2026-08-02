'use client';
// =====================================================================
//  E19 · Suivi d'un appel au don.
//  Quatre compteurs sur une seule ligne réglée. Les refus comptés par
//  motif permettent de mieux cibler l'appel suivant. Le bloc envoi
//  redonne, à tout moment, ce qui est copiable pour les canaux hors
//  application (aucun service payant n'est utilisé).
// =====================================================================
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PhoneCall, Copy, Check } from 'lucide-react';
import { suiviAlerteGestion, cloturerAlerteGestion } from '@/lib/api';
import Bouton from '../../../../composants/Bouton';
import Etat from '../../../../composants/Etat';
import Confirmation from '../../../../composants/Confirmation';
import { MessageErreur, MessageReussite } from '../../../../composants/Message';
import { LignesEnAttente } from '../../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../../composants/AideEcran';
import { dateCourte, dateHeure, numeroLisible, pluriel } from '@/lib/format';

const MOTIF_MOT = {
  don_trop_recent: 'Don trop récent', absent_de_la_ville: 'Absent de la ville',
  raison_de_sante: 'Raison de santé', autre: 'Autre raison'
};
const MOYEN_MOT = {
  a_pied: 'À pied', deux_roues: 'Deux-roues', voiture: 'Voiture',
  transport_commun: 'Taxi ou bus', aucun: 'Aucun'
};
const STATUT_ETAT = {
  brouillon: { mot: 'Brouillon', ton: 'neutre' },
  envoyee: { mot: 'En cours', ton: 'ocre' },
  cloturee: { mot: 'Clos', ton: 'neutre' }
};

function BoutonCopier({ texte, children }) {
  const [copie, setCopie] = useState(false);
  return (
    <button type="button" className="lien" style={{ fontSize: 'var(--t-appui)' }}
            onClick={async () => {
              await navigator.clipboard.writeText(texte);
              setCopie(true);
              setTimeout(() => setCopie(false), 2000);
            }}>
      {copie ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.75} aria-hidden="true" />}
      {copie ? 'Copié' : children}
    </button>
  );
}

export default function SuiviAppel() {
  const { id } = useParams();
  const routeur = useRouter();
  const [suivi, setSuivi] = useState(null);
  const [erreur, setErreur] = useState('');
  const [reussite, setReussite] = useState('');
  const [confirmationCloture, setConfirmationCloture] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [filtreTransport, setFiltreTransport] = useState(false);
  const [aideOuverte, alternerAide] = useAide('appels-suivi');

  function charger() {
    return suiviAlerteGestion(id).then(setSuivi).catch((probleme) => setErreur(probleme.message));
  }
  useEffect(() => { charger(); }, [id]);

  async function cloturer() {
    setEnCours(true);
    try {
      await cloturerAlerteGestion(id);
      setConfirmationCloture(false);
      setReussite('Appel clos.');
      await charger();
    } catch (probleme) {
      setErreur(probleme.message);
    } finally {
      setEnCours(false);
    }
  }

  if (erreur && !suivi) {
    return (
      <div className="contenu-registre pile-xl">
        <Link href="/gestion/appels" className="lien"><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Retour aux appels</Link>
        <MessageErreur>{erreur}</MessageErreur>
      </div>
    );
  }
  if (!suivi) {
    return <div className="contenu-registre pile-xl"><LignesEnAttente nombre={6} /></div>;
  }

  const { alerte, compteurs, viennent, refus_par_motif: refusParMotif, destinataires } = suivi;
  const etat = STATUT_ETAT[alerte.statut] || STATUT_ETAT.brouillon;
  const demandentTransport = viennent.filter((v) => v.besoin_aide_transport);
  const lignesViennent = filtreTransport ? demandentTransport : viennent;

  const numeros = destinataires.map((d) => d.numero_principal).filter(Boolean).join(', ');
  const liensWhatsapp = destinataires
    .filter((d) => d.accepte_messagerie && d.numero_principal)
    .map((d) => ({
      id_donneur: d.id_donneur, nom: `${d.prenom} ${d.nom}`,
      lien: `https://wa.me/${d.numero_principal.replace('+', '')}?text=${encodeURIComponent(alerte.message)}`
    }));

  return (
    <div className="contenu-registre pile-xl">
      <Link href="/gestion/appels" className="lien">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Retour aux appels
      </Link>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      <div className="entete-ecran">
        <div className="pile-s">
          <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
            <h1 className="titre-grand">Appel {alerte.groupe_cible}</h1>
            <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
          </div>
          <p className="ligne-registre">
            Envoyé le {dateHeure(alerte.date_envoi)} · limite le {dateCourte(alerte.date_limite)}
            {alerte.heure_limite ? ` à ${alerte.heure_limite.slice(0, 5)}` : ''} · zones {alerte.zones_noms || '—'}
          </p>
        </div>
        <Etat ton={etat.ton}>{etat.mot}</Etat>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran suit un appel au don déjà envoyé : combien de donneurs viennent, combien ne
        peuvent pas, et combien n’ont pas encore répondu. Les refus comptés par motif aident à
        mieux cibler le prochain appel. Le bloc « Envoi » redonne à tout moment le message et
        les numéros à copier pour les donneurs qui n’ont pas installé l’application.
      </PanneauAide>

      <div className="ligne-valeurs">
        <div>
          <p className="mot">Destinataires</p>
          <p className="valeur">{compteurs.destinataires}</p>
        </div>
        <div>
          <p className="mot">Viennent</p>
          <p className="valeur">{compteurs.viennent}</p>
        </div>
        <div>
          <p className="mot">Ne peuvent pas</p>
          <p className="valeur">{compteurs.ne_peuvent_pas}</p>
        </div>
        <div>
          <p className="mot">Sans réponse — à relancer</p>
          <p className="valeur">{compteurs.sans_reponse}</p>
        </div>
      </div>

      {alerte.statut === 'envoyee' && (
        <div className="rang" style={{ gap: 'var(--e3)' }}>
          <Bouton variante="principal" enfantIcone={PhoneCall}
                  onClick={() => routeur.push(`/gestion/appels/${id}/liste-appel`)}>
            Ouvrir la liste d’appel
          </Bouton>
          <Bouton variante="discret" onClick={() => setConfirmationCloture(true)}>
            Clôturer
          </Bouton>
        </div>
      )}

      <div className="pile-s">
        <div className="rang-espace">
          <span className="etiquette">Donneurs qui viennent</span>
          <button type="button" className="touche" aria-pressed={filtreTransport}
                  onClick={() => setFiltreTransport(!filtreTransport)}>
            Demandent une aide au transport ({demandentTransport.length})
          </button>
        </div>
        {viennent.length === 0 ? (
          <div className="etat-vide pile-s"><p className="appui">Personne n’a encore répondu « je viens ».</p></div>
        ) : lignesViennent.length === 0 ? (
          <div className="etat-vide pile-s"><p className="appui">Aucun de ceux qui viennent n’a demandé d’aide au transport.</p></div>
        ) : (
          <div className="registre-defilant">
            <table className="registre">
              <thead>
                <tr>
                  <th>Nom</th><th>Repère</th><th>Déplacement</th><th>Aide transport</th>
                  <th>Créneau</th><th>Téléphone</th>
                </tr>
              </thead>
              <tbody>
                {lignesViennent.map((v) => (
                  <tr key={v.id_donneur}>
                    <td style={{ fontWeight: 600 }}>{v.prenom} {v.nom}</td>
                    <td className="appui">{v.repere_position || '—'}</td>
                    <td className="appui">{MOYEN_MOT[v.moyen_deplacement] || '—'}</td>
                    <td className="appui">{v.besoin_aide_transport ? 'Oui' : 'Non'}</td>
                    <td className="mono appui">{v.creneau_prefere || '—'}</td>
                    <td className="mono">{numeroLisible(v.numero_principal) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pile-s">
        <span className="etiquette">Refus, par motif</span>
        {refusParMotif.length === 0 ? (
          <p className="appui">Aucun refus pour l’instant.</p>
        ) : (
          <div className="pile-s">
            {refusParMotif.map((r) => (
              <div key={r.motif_refus || 'sans_motif'} className="ligne-fait">
                <span className="appui">{MOTIF_MOT[r.motif_refus] || 'Motif non précisé'}</span>
                <span className="valeur">{r.nb}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="carte pile-s">
        <span className="etiquette">Envoi</span>
        <p className="petit">
          Les donneurs qui ont installé DJIGUI ont reçu l’appel dans l’application. Pour les
          autres, copiez le message et la liste des numéros.
        </p>
        <div className="pile-s">
          <span className="champ-etiquette">Message</span>
          <p className="citation">« {alerte.message} »</p>
          <BoutonCopier texte={alerte.message}>Copier le message</BoutonCopier>
        </div>
        <div className="pile-s">
          <span className="champ-etiquette">Numéros ({destinataires.length})</span>
          <p className="mono appui" style={{ wordBreak: 'break-word' }}>{numeros || '—'}</p>
          <BoutonCopier texte={numeros}>Copier la liste des numéros</BoutonCopier>
        </div>
        {liensWhatsapp.length > 0 && (
          <div className="pile-s">
            <span className="champ-etiquette">WhatsApp, un lien par destinataire</span>
            <div className="rang" style={{ gap: 'var(--e3)', flexWrap: 'wrap' }}>
              {liensWhatsapp.map((l) => (
                <a key={l.id_donneur} href={l.lien} target="_blank" rel="noreferrer" className="lien">
                  {l.nom}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <Confirmation
        ouverte={confirmationCloture}
        titre="Clôturer cet appel ?"
        motAction="Clôturer" motRetour="Revenir en arrière"
        varianteAction="secondaire" enCours={enCours}
        surConfirmer={cloturer} surAnnuler={() => setConfirmationCloture(false)}
      >
        <p className="appui">
          Les donneurs qui n’ont pas encore répondu ({compteurs.sans_reponse}) ne pourront plus
          le faire pour cet appel.
        </p>
      </Confirmation>
    </div>
  );
}
