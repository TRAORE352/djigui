'use client';
// =====================================================================
//  DJIGUI — écran de verrouillage de l'application (E5 et suivants).
//  Même habillage que l'accueil et la connexion : dégradé bordeaux,
//  courbe, logo en pulsation — pour que revenir dans l'application
//  ressemble à y entrer. Le jeton reste valide : cet écran ne fait que
//  masquer le contenu et redemander une preuve (empreinte ou mot de
//  passe), jamais le numéro. Cinq essais de mot de passe, comme le
//  verrouillage de connexion (RG35) ; le cinquième échec déconnecte
//  complètement plutôt que de laisser insister sur un compte bloqué.
//  Un échec de l'empreinte ne consomme jamais ces essais : c'est un
//  chemin à part, qui retombe toujours proprement sur le mot de passe.
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { Eye, EyeOff, LogOut, Fingerprint } from 'lucide-react';
import { deverrouillerApplication, enregistrerJeton, marquerDeverrouille, effacerJeton } from '@/lib/api';
import {
  deverrouillerAvecPasskey, enregistrerPasskey, biometrieVerifiablePourAppareil,
  passkeyActifLocalement, marquerPasskeyActifLocalement,
  passkeyDejaPropose, marquerPasskeyPropose
} from '@/lib/webauthn';
import Bouton from './Bouton';
import { MessageErreur } from './Message';

const ESSAIS_MAX = 5;

// Même pulsation que le logo de l'accueil (page.js) : deux battements
// rapprochés puis un creux, jamais un aller-retour mécanique.
function LogoEntete({ mouvementReduit }) {
  return (
    <motion.div
      animate={mouvementReduit ? {} : { scale: [1, 1.06, 1, 1.03, 1], y: [0, -4, -1, -3, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.5 }}
    >
      <Image src="/logo/logo_djigui.png" alt="DJIGUI" width={112} height={112} priority
             style={{ filter: 'drop-shadow(0 10px 22px rgba(36,14,10,.35))' }} />
    </motion.div>
  );
}

export default function EcranVerrouillage({ onDeverrouille }) {
  const routeur = useRouter();
  const mouvementReduit = useReducedMotion();
  const [etape, setEtape] = useState('saisie');
  const [passkeyDispo, setPasskeyDispo] = useState(false);
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');
  const [montrer, setMontrer] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [enCoursPasskey, setEnCoursPasskey] = useState(false);
  const [enCoursOffre, setEnCoursOffre] = useState(false);
  const [essais, setEssais] = useState(0);

  useEffect(() => { setPasskeyDispo(passkeyActifLocalement()); }, []);

  function deconnecterCompletement() {
    effacerJeton();
    routeur.replace('/connexion');
  }

  // Après un déverrouillage réussi (empreinte ou mot de passe), propose
  // une seule fois d'enregistrer l'empreinte si l'appareil le permet et
  // qu'elle n'est ni déjà active ni déjà refusée.
  async function terminerOuProposer() {
    if (!passkeyActifLocalement() && !passkeyDejaPropose() && await biometrieVerifiablePourAppareil()) {
      setEtape('offre_passkey');
      return;
    }
    onDeverrouille();
  }

  async function tenter(evenement) {
    evenement.preventDefault();
    if (!motDePasse || enCours) return;
    setErreur('');
    setEnCours(true);
    try {
      const resultat = await deverrouillerApplication(motDePasse);
      enregistrerJeton(resultat.jeton);
      marquerDeverrouille();
      await terminerOuProposer();
    } catch (probleme) {
      const essaisFaits = essais + 1;
      setEssais(essaisFaits);
      setMotDePasse('');
      setEnCours(false);
      if (probleme.statut === 423 || probleme.donnees?.essais_restants === 0 || essaisFaits >= ESSAIS_MAX) {
        deconnecterCompletement();
        return;
      }
      setErreur(probleme.message);
    }
  }

  // Déclenché UNIQUEMENT par le toucher de l'empreinte (bouton réel) :
  // jamais au chargement, un navigateur refuserait WebAuthn sans geste.
  async function tenterPasskey() {
    setErreur('');
    setEnCoursPasskey(true);
    try {
      const resultat = await deverrouillerAvecPasskey();
      enregistrerJeton(resultat.jeton);
      marquerDeverrouille();
      onDeverrouille();
    } catch (probleme) {
      setEnCoursPasskey(false);
      // Annulation volontaire (croix système, retour) : silencieux, on
      // reste sur l'empreinte plutôt que de basculer sans qu'on le demande.
      if (probleme?.name === 'NotAllowedError') return;
      setErreur('L’empreinte n’a pas été reconnue. Utilisez votre mot de passe.');
      setAfficherMotDePasse(true);
    }
  }

  async function accepterOffrePasskey() {
    setEnCoursOffre(true);
    try {
      await enregistrerPasskey();
      marquerPasskeyActifLocalement();
    } catch {
      // Échec silencieux : le mot de passe reste le repli normal, ce
      // n'est pas une raison de bloquer l'entrée dans l'application.
    }
    marquerPasskeyPropose();
    setEnCoursOffre(false);
    onDeverrouille();
  }

  function refuserOffrePasskey() {
    marquerPasskeyPropose();
    onDeverrouille();
  }

  if (etape === 'offre_passkey') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'var(--fond)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <motion.div
          initial={mouvementReduit ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="page-telephone"
          style={{ width: '100%', padding: 'var(--e5)' }}
        >
          <div className="pile-l" style={{ alignItems: 'center', textAlign: 'center' }}>
            <motion.div
              animate={mouvementReduit ? {} : { scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ color: 'var(--sang)' }}
            >
              <Fingerprint size={56} strokeWidth={1.5} aria-hidden="true" />
            </motion.div>
            <div className="pile-s" style={{ alignItems: 'center' }}>
              <h1 className="titre-grand">Déverrouiller plus vite ?</h1>
              <p className="appui">
                Utilisez votre empreinte ou votre visage la prochaine fois, au lieu du mot de
                passe. Rien n&rsquo;est envoyé à DJIGUI : votre appareil garde l&rsquo;empreinte
                pour lui seul.
              </p>
            </div>
            <div className="pile-l" style={{ width: '100%' }}>
              <Bouton variante="principal" large enCours={enCoursOffre} motEnCours="Enregistrement"
                      onClick={accepterOffrePasskey}>
                Activer l&rsquo;empreinte
              </Bouton>
              <button type="button" className="bouton-fantome" onClick={refuserOffrePasskey} disabled={enCoursOffre}>
                Plus tard
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const montrerBiometrie = passkeyDispo && !afficherMotDePasse;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--fond)', overflowY: 'auto' }}>
      <div className="carte-entete" style={{
        minHeight: '34dvh', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <LogoEntete mouvementReduit={mouvementReduit} />
        <svg className="carte-entete-courbe" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,40 C 360,110 1080,-30 1440,40 L1440,100 L0,100 Z" fill="var(--fond)" />
        </svg>
      </div>

      <motion.div
        initial={mouvementReduit ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="page-telephone"
        style={{ width: '100%', padding: 'var(--e5)', paddingBottom: 'var(--e9)' }}
      >
        <div className="pile-l" style={{ alignItems: 'center', textAlign: 'center' }}>
          {montrerBiometrie ? (
            <>
              <div className="pile-l" style={{ alignItems: 'center', paddingTop: 'var(--e4)' }}>
                <motion.button
                  type="button"
                  aria-label="Déverrouiller avec l’empreinte"
                  onClick={tenterPasskey}
                  disabled={enCoursPasskey}
                  animate={mouvementReduit || enCoursPasskey ? {} : { scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'relative', background: 'none', border: 'none', padding: 'var(--e5)',
                    cursor: enCoursPasskey ? 'default' : 'pointer', color: 'var(--sang)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  {!mouvementReduit && (
                    <motion.span
                      aria-hidden="true"
                      animate={{ scale: [1, 1.45, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'var(--sang-clair)', zIndex: 0
                      }}
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}>
                    <Fingerprint size={72} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                </motion.button>
                <p className="appui">
                  {enCoursPasskey ? 'Vérification en cours…' : 'Touchez pour déverrouiller'}
                </p>
              </div>

              <MessageErreur>{erreur}</MessageErreur>

              <button type="button" className="bouton bouton-discret bouton-compact"
                      style={{ borderRadius: 999 }}
                      onClick={() => setAfficherMotDePasse(true)}>
                Utiliser mon mot de passe
              </button>
            </>
          ) : (
            <>
              <div className="pile-s" style={{ alignItems: 'center' }}>
                <h1 className="titre-grand">Content de vous revoir</h1>
                <p className="appui">Entrez votre mot de passe pour retrouver votre compte.</p>
              </div>

              <form className="pile-l" style={{ width: '100%' }} onSubmit={tenter}>
                <label className={erreur ? 'champ champ-erreur' : 'champ'} style={{ textAlign: 'left' }}>
                  <span className="champ-etiquette">Mot de passe</span>
                  <span className="champ-saisie-groupe">
                    <input className="champ-saisie-nue" type={montrer ? 'text' : 'password'}
                           autoComplete="current-password" autoFocus
                           value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
                    <button type="button" className="champ-bouton-interne" onClick={() => setMontrer(!montrer)}>
                      {montrer ? <><EyeOff size={16} strokeWidth={1.75} />Masquer</>
                               : <><Eye size={16} strokeWidth={1.75} />Montrer</>}
                    </button>
                  </span>
                </label>

                <MessageErreur>{erreur}</MessageErreur>

                <Bouton variante="principal" large type="submit" enCours={enCours}
                        disabled={!motDePasse} motEnCours="Vérification" onClick={tenter}>
                  Déverrouiller
                </Bouton>
              </form>

              {passkeyDispo && (
                <button type="button" className="bouton bouton-discret bouton-compact"
                        style={{ borderRadius: 999 }}
                        onClick={() => { setAfficherMotDePasse(false); setErreur(''); }}>
                  Utiliser mon empreinte
                </button>
              )}
            </>
          )}

          <button type="button" className="lien" onClick={deconnecterCompletement}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--e2)', fontSize: 'var(--t-appui)' }}>
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            Ce n&rsquo;est pas moi, me déconnecter
          </button>
        </div>
      </motion.div>
    </div>
  );
}
