'use client';
// =====================================================================
//  E18 · Lancer un appel au don.
//  Le compteur de ciblage se recalcule à chaque réglage, avant tout
//  envoi. La liste des destinataires n'est jamais approximative : le
//  dernier des quatre nombres est celui qui recevra réellement le
//  message, et lui seul.
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import {
  cibleAlerteGestion, creerAlerteGestion, envoyerAlerteGestion, tableauDeBordGestion, listerZones
} from '@/lib/api';
import BlocGroupe from '../../../../composants/BlocGroupe';
import Etat from '../../../../composants/Etat';
import Bouton from '../../../../composants/Bouton';
import Confirmation from '../../../../composants/Confirmation';
import { MessageErreur } from '../../../../composants/Message';
import { useAide, BoutonAide, PanneauAide } from '../../../../composants/AideEcran';
import { dateCourte, dateLongue, pluriel, ORDRE_GROUPES } from '@/lib/format';

const MOTS_NIVEAU = { critique: 'Critique', bas: 'Bas', normal: 'Normal', en_attente: 'En attente de premier don' };
const CANAUX = [
  { cle: 'whatsapp', mot: 'WhatsApp' },
  { cle: 'sms', mot: 'SMS' },
  { cle: 'appel', mot: 'Appel téléphonique' }
];

function messageType(groupe, dateLimite, heureLimite) {
  if (!groupe) return '';
  const quand = dateLimite ? `avant le ${dateLongue(dateLimite)}${heureLimite ? ` à ${heureLimite}` : ''}` : 'dès que possible';
  return `Le centre a besoin de dons ${groupe}. Merci de venir ${quand} si vous le pouvez. Répondez « je viens » ou « je ne peux pas » dans l’application.`;
}

export default function NouvelAppel() {
  const routeur = useRouter();
  const parametresUrl = useSearchParams();

  const [groupe, setGroupe] = useState(parametresUrl.get('groupe') || '');
  const [elargir, setElargir] = useState(false);
  const [zones, setZones] = useState(null);
  const [zonesChoisies, setZonesChoisies] = useState([]);
  const [dateLimite, setDateLimite] = useState('');
  const [heureLimite, setHeureLimite] = useState('18:00');
  const [canaux, setCanaux] = useState([]);
  const [message, setMessage] = useState('');
  const [messageAuto, setMessageAuto] = useState('');

  const [stock, setStock] = useState(null);
  const [cible, setCible] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [erreur, setErreur] = useState('');
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [aideOuverte, alternerAide] = useAide('appels-nouveau');

  useEffect(() => { listerZones().then((r) => setZones(r.zones)).catch(() => setZones([])); }, []);
  useEffect(() => { tableauDeBordGestion().then((r) => setStock(r.stock)).catch(() => {}); }, []);

  // Le message proposé se régénère tant que l'agent ne l'a pas modifié.
  useEffect(() => {
    const propose = messageType(groupe, dateLimite, heureLimite);
    if (message === messageAuto) setMessage(propose);
    setMessageAuto(propose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupe, dateLimite, heureLimite]);

  // Le compteur de ciblage, recalculé à chaque réglage.
  useEffect(() => {
    if (!groupe) { setCible(null); return; }
    const minuterie = setTimeout(() => {
      cibleAlerteGestion(groupe, zonesChoisies, elargir)
        .then(setCible)
        .catch((probleme) => setErreur(probleme.message));
    }, 300);
    return () => clearTimeout(minuterie);
  }, [groupe, elargir, zonesChoisies.join(',')]);

  // Zéro destinataire : on cherche lequel des réglages est de trop,
  // même principe que l'état vide de E24. On essaie d'abord
  // l'élargissement aux groupes compatibles, puis chaque zone non
  // cochée, et on garde la meilleure piste.
  useEffect(() => {
    setSuggestion(null);
    if (!cible || cible.recevront_appel > 0 || !groupe || !zones) return;
    let annule = false;

    async function chercher() {
      const nomsChoisis = zonesChoisies.map((id) => zones.find((z) => z.id_zone === id)?.nom).filter(Boolean);
      const base = nomsChoisis.length > 0
        ? `Aucun donneur ${groupe} à ${nomsChoisis.join(' et ')}.`
        : `Aucun donneur ${groupe} avec ce réglage.`;

      if (!elargir && !cible.sans_substitut) {
        try {
          const essai = await cibleAlerteGestion(groupe, zonesChoisies, true);
          if (!annule && essai.recevront_appel > 0) {
            setSuggestion({
              texte: `${base} En élargissant aux groupes compatibles, ${pluriel(essai.recevront_appel, 'donneur')} pourraient recevoir cet appel.`,
              appliquer: () => setElargir(true)
            });
            return;
          }
        } catch { /* on essaie la piste suivante */ }
      }

      const zonesRestantes = zones.filter((z) => !zonesChoisies.includes(z.id_zone));
      let meilleure = null;
      for (const zone of zonesRestantes) {
        try {
          const essai = await cibleAlerteGestion(groupe, [...zonesChoisies, zone.id_zone], elargir);
          if (essai.recevront_appel > 0 && (!meilleure || essai.recevront_appel > meilleure.nb)) {
            meilleure = { zone, nb: essai.recevront_appel };
          }
        } catch { /* zone ignorée */ }
      }
      if (annule) return;
      if (meilleure) {
        setSuggestion({
          texte: `${base} En ajoutant la zone ${meilleure.zone.nom}, ${pluriel(meilleure.nb, 'donneur')} pourraient recevoir cet appel.`,
          appliquer: () => toggleZone(meilleure.zone.id_zone)
        });
      } else {
        setSuggestion({ texte: `${base} Essayez d’autres zones ou groupes compatibles.` });
      }
    }
    chercher();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible, groupe, elargir, zonesChoisies.join(','), zones]);

  function toggleZone(idZone) {
    setZonesChoisies((z) => (z.includes(idZone) ? z.filter((v) => v !== idZone) : [...z, idZone]));
  }
  function toggleCanal(cle) {
    setCanaux((c) => (c.includes(cle) ? c.filter((v) => v !== cle) : [...c, cle]));
  }

  const niveauGroupe = stock?.find((l) => l.groupe_sanguin === groupe)?.niveau;
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const bloque = !groupe || zonesChoisies.length === 0 || !dateLimite || message.trim().length < 10
    || !cible || cible.recevront_appel === 0;

  async function envoyer() {
    setEnvoiEnCours(true); setErreur('');
    try {
      const { id_alerte: idAlerte } = await creerAlerteGestion({
        groupe, elargir_compatibles: elargir, zones: zonesChoisies,
        date_limite: dateLimite, heure_limite: heureLimite || null,
        message: message.trim(), canaux: ['application', ...canaux]
      });
      await envoyerAlerteGestion(idAlerte);
      routeur.push(`/gestion/appels/${idAlerte}`);
    } catch (probleme) {
      setConfirmationOuverte(false);
      setErreur(probleme.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Lancer un appel au don</h1>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
        <Bouton variante="principal" enfantIcone={Megaphone} disabled={bloque}
                onClick={() => setConfirmationOuverte(true)}>
          Lancer l’appel
        </Bouton>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran prépare un appel au don pour un groupe et des zones précises. Le compteur de
        ciblage, à droite, se recalcule à chaque réglage : il donne le nombre exact de
        donneurs qui recevront réellement le message. Rédigez ou ajustez le message envoyé,
        puis lancez l’appel une fois le nombre de destinataires confirmé.
      </PanneauAide>

      <MessageErreur>{erreur}</MessageErreur>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--e7)', alignItems: 'start' }}>
        <div className="pile-l">
          <div className="pile-s">
            <span className="etiquette">Groupe demandé</span>
            <div className="rang" style={{ gap: 'var(--e3)' }}>
              <div className="grille-groupes" style={{ flex: 1 }}>
                {ORDRE_GROUPES.map((g) => (
                  <button key={g} type="button" className="touche-groupe" aria-pressed={groupe === g}
                          onClick={() => setGroupe(g)}>
                    {g}
                  </button>
                ))}
              </div>
              {groupe && (
                <div className="rang" style={{ gap: 'var(--e3)' }}>
                  <BlocGroupe groupe={groupe} taille="m" />
                  {niveauGroupe && (
                    <Etat ton={niveauGroupe === 'critique' ? 'sang' : niveauGroupe === 'bas' ? 'ocre' : 'neutre'}>
                      {MOTS_NIVEAU[niveauGroupe]}
                    </Etat>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pile-s">
            <label className="rang" style={{ gap: 'var(--e3)' }}>
              <input type="checkbox" className="case-a-cocher" checked={elargir}
                     disabled={!groupe || cible?.sans_substitut}
                     onChange={(e) => setElargir(e.target.checked)} />
              <span>Élargir aux groupes compatibles</span>
            </label>
            {groupe && cible?.sans_substitut && (
              <span className="champ-aide">
                Aucun autre groupe ne peut remplacer une poche {groupe}.
              </span>
            )}
            {elargir && cible?.groupes_cibles?.length > 1 && (
              <span className="petit">Groupes retenus : {cible.groupes_cibles.join(', ')}.</span>
            )}
          </div>

          <div className="pile-s">
            <span className="etiquette">Zones</span>
            <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
              {(zones || []).map((zone) => (
                <label key={zone.id_zone} className="touche" style={{ gap: 'var(--e2)' }}
                       aria-pressed={zonesChoisies.includes(zone.id_zone)}>
                  <input type="checkbox" className="case-a-cocher" style={{ width: 18, height: 18 }}
                         checked={zonesChoisies.includes(zone.id_zone)}
                         onChange={() => toggleZone(zone.id_zone)} />
                  {zone.nom}
                </label>
              ))}
            </div>
          </div>

          <div className="rang" style={{ gap: 'var(--e4)' }}>
            <label className="champ champ-encadre">
              <span className="champ-etiquette">Date limite</span>
              <input type="date" className="champ-saisie mono" value={dateLimite} min={aujourdHui}
                     onChange={(e) => setDateLimite(e.target.value)} />
            </label>
            <label className="champ champ-encadre">
              <span className="champ-etiquette">Heure limite</span>
              <input type="time" className="champ-saisie mono" value={heureLimite}
                     onChange={(e) => setHeureLimite(e.target.value)} />
            </label>
          </div>
          <p className="petit">
            Conséquence : l’appel se clôture de lui-même à cette date et heure, sans action de
            votre part.
          </p>

          <div className="pile-s">
            <span className="etiquette">Canaux</span>
            <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
              <span className="touche" aria-pressed="true" style={{ cursor: 'default' }}>
                Notification dans l’application
              </span>
              {CANAUX.map(({ cle, mot }) => (
                <button key={cle} type="button" className="touche" aria-pressed={canaux.includes(cle)}
                        onClick={() => toggleCanal(cle)}>
                  {mot}
                </button>
              ))}
            </div>
          </div>

          <label className="champ champ-encadre">
            <span className="champ-etiquette rang-espace">
              Message
              <span className="petit">{message.length} caractères</span>
            </span>
            <textarea className="champ-saisie" rows={5} value={message}
                      onChange={(e) => setMessage(e.target.value)} />
          </label>
        </div>

        <div className="pile carte" style={{ position: 'sticky', top: 'var(--e6)' }}>
          <span className="etiquette">Ciblage</span>
          {!groupe ? (
            <p className="appui">Choisissez un groupe pour voir le nombre de destinataires.</p>
          ) : !cible ? (
            <p className="appui">Calcul en cours…</p>
          ) : (
            <div className="pile-s">
              <div className="rang-espace">
                <span className="appui">Donneurs du groupe, dans les zones</span>
                <span className="mono">{cible.donneurs_cible}</span>
              </div>
              <div className="rang-espace">
                <span className="appui">Dont numéros confirmés</span>
                <span className="mono">{cible.numeros_confirmes}</span>
              </div>
              <div className="rang-espace">
                <span className="appui">Dont pouvant donner aujourd’hui</span>
                <span className="mono">{cible.peuvent_donner_aujourdhui}</span>
              </div>
              <hr className="filet" />
              <div className="rang-espace">
                <span style={{ fontWeight: 600 }}>Recevront l’appel</span>
                <span className="mono" style={{ fontWeight: 700, fontSize: 'var(--t-titre)' }}>
                  {cible.recevront_appel}
                </span>
              </div>

              {cible.recevront_appel > 0 ? (
                <p className="appui">
                  Seuls {pluriel(cible.recevront_appel, 'donneur')} recevront le message : ils
                  peuvent donner aujourd’hui et au moins un de leurs numéros n’est pas signalé
                  injoignable.
                </p>
              ) : (
                <div className="etat-vide pile-s">
                  <p className="appui">{suggestion?.texte || 'Recherche d’une piste…'}</p>
                  {suggestion?.appliquer && (
                    <Bouton variante="discret" compact onClick={suggestion.appliquer}>
                      Appliquer ce réglage
                    </Bouton>
                  )}
                </div>
              )}

              {cible.ecartes_injoignables > 0 && (
                <p className="petit">
                  {cible.ecartes_injoignables === 1
                    ? '1 donneur n’est pas appelé : tous ses numéros ont été signalés injoignables.'
                    : `${cible.ecartes_injoignables} donneurs ne sont pas appelés : tous leurs numéros ont été signalés injoignables.`}
                </p>
              )}

              {cible.dernier_appel_meme_groupe && (
                <>
                  <hr className="filet" />
                  <span className="etiquette">Dernier appel {groupe}</span>
                  <p className="petit">
                    {dateCourte(cible.dernier_appel_meme_groupe.date_envoi)} ·{' '}
                    {pluriel(cible.dernier_appel_meme_groupe.nb_destinataires, 'destinataire')} ·{' '}
                    {pluriel(cible.dernier_appel_meme_groupe.donneurs_venus, 'donneur venu', 'donneurs venus')}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Confirmation
        ouverte={confirmationOuverte}
        titre={cible ? `Envoyer à ${pluriel(cible.recevront_appel, 'donneur')} ?` : 'Envoyer l’appel ?'}
        motAction={cible ? `Envoyer à ${pluriel(cible.recevront_appel, 'donneur')}` : 'Envoyer'}
        motRetour="Revenir au réglage"
        enCours={envoiEnCours}
        surConfirmer={envoyer}
        surAnnuler={() => setConfirmationOuverte(false)}
      >
        <p className="appui">
          Groupe {groupe}{elargir ? ' (élargi aux groupes compatibles)' : ''}, zones{' '}
          {zonesChoisies.map((id) => zones?.find((z) => z.id_zone === id)?.nom).filter(Boolean).join(', ')}.
        </p>
        <p className="appui">
          Réponses attendues avant le {dateLongue(dateLimite)}{heureLimite ? ` à ${heureLimite}` : ''}.
        </p>
        <p className="petit">
          Les donneurs qui ont installé DJIGUI reçoivent l’appel dans l’application. Pour les
          autres, le message et la liste des numéros seront copiables depuis le suivi de
          l’appel.
        </p>
      </Confirmation>
    </div>
  );
}
