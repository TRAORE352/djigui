'use client';
// =====================================================================
//  DJIGUI — invites de première ouverture, une fois l'application
//  installée (mode standalone) seulement : jamais sur une page web
//  normale, jamais deux fois. D'abord les notifications, puis
//  l'empreinte si l'appareil la permet — deux pop-ups distinctes,
//  jamais ensemble, chacune avec sa propre sortie « Plus tard » qui ne
//  revient plus.
// =====================================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Bell, Fingerprint } from 'lucide-react';
import { etatNotifications, activerNotifications } from '@/lib/notifications';
import {
  biometrieVerifiablePourAppareil, enregistrerPasskey,
  passkeyActifLocalement, marquerPasskeyActifLocalement,
  passkeyDejaPropose, marquerPasskeyPropose
} from '@/lib/webauthn';
import Bouton from './Bouton';

const CLE_INVITES_VUES = 'djigui_invites_installation_vues';

function enModeInstalle() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export default function InvitesInstallation() {
  const mouvementReduit = useReducedMotion();
  const [etape, setEtape] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(CLE_INVITES_VUES)) return;
    if (!enModeInstalle()) return;
    let annule = false;

    async function verifierBiometrie() {
      if (annule) return;
      if (!passkeyActifLocalement() && !passkeyDejaPropose() && await biometrieVerifiablePourAppareil()) {
        if (!annule) setEtape('biometrie');
      } else {
        terminer();
      }
    }

    etatNotifications().then((etat) => {
      if (annule) return;
      if (etat.supporte && etat.permission === 'default' && !etat.abonne) setEtape('notifications');
      else verifierBiometrie();
    });

    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function terminer() {
    window.localStorage.setItem(CLE_INVITES_VUES, '1');
    setEtape(null);
  }

  async function verifierBiometrieApres() {
    if (!passkeyActifLocalement() && !passkeyDejaPropose() && await biometrieVerifiablePourAppareil()) {
      setEtape('biometrie');
    } else {
      terminer();
    }
  }

  async function activerLesNotifications() {
    setEnCours(true);
    await activerNotifications();
    setEnCours(false);
    await verifierBiometrieApres();
  }

  async function activerLaBiometrie() {
    setEnCours(true);
    try {
      await enregistrerPasskey();
      marquerPasskeyActifLocalement();
    } catch {
      // Repli silencieux : le mot de passe reste le chemin normal.
    }
    marquerPasskeyPropose();
    setEnCours(false);
    terminer();
  }

  function passerBiometrie() {
    marquerPasskeyPropose();
    terminer();
  }

  return (
    <AnimatePresence>
      {etape && (
        <motion.div
          className="voile"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: mouvementReduit ? 0 : 0.2 }}
          role="dialog" aria-modal="true"
        >
          <motion.div
            className="fenetre pile-l"
            style={{ textAlign: 'center', alignItems: 'center' }}
            initial={mouvementReduit ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={mouvementReduit ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {etape === 'notifications' ? (
              <>
                <motion.div
                  animate={mouvementReduit ? {} : { rotate: [0, -10, 10, -6, 6, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut' }}
                  style={{ color: 'var(--sang)' }}
                >
                  <Bell size={48} strokeWidth={1.5} aria-hidden="true" />
                </motion.div>
                <div className="pile-s" style={{ alignItems: 'center' }}>
                  <h2 className="titre-grand">Ne manquez aucun appel</h2>
                  <p className="appui">
                    Une notification dès qu&rsquo;un centre a besoin de votre groupe : c&rsquo;est
                    parfois la différence entre arriver à temps et l&rsquo;apprendre trop tard.
                  </p>
                </div>
                <div className="pile-l" style={{ width: '100%' }}>
                  <Bouton variante="principal" large enCours={enCours} motEnCours="Activation"
                          onClick={activerLesNotifications}>
                    Activer les notifications
                  </Bouton>
                  <button type="button" className="bouton-fantome" disabled={enCours}
                          onClick={verifierBiometrieApres}>
                    Plus tard
                  </button>
                </div>
              </>
            ) : (
              <>
                <motion.div
                  animate={mouvementReduit ? {} : { scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ color: 'var(--sang)' }}
                >
                  <Fingerprint size={48} strokeWidth={1.5} aria-hidden="true" />
                </motion.div>
                <div className="pile-s" style={{ alignItems: 'center' }}>
                  <h2 className="titre-grand">Un déverrouillage plus rapide</h2>
                  <p className="appui">
                    Utilisez votre empreinte ou votre visage pour retrouver votre compte, au lieu
                    du mot de passe. Rien n&rsquo;est envoyé à DJIGUI : votre appareil seul la
                    garde.
                  </p>
                </div>
                <div className="pile-l" style={{ width: '100%' }}>
                  <Bouton variante="principal" large enCours={enCours} motEnCours="Activation"
                          onClick={activerLaBiometrie}>
                    Activer l&rsquo;empreinte
                  </Bouton>
                  <button type="button" className="bouton-fantome" disabled={enCours} onClick={passerBiometrie}>
                    Plus tard
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
