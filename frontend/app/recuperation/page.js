'use client';
// =====================================================================
//  E11 · Retrouver mon compte, en trois temps.
//  Sans courriel et sans code envoyé par SMS : la question écrite par
//  le donneur suffit, et le retour se fait sur sa carte.
// =====================================================================
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import {
  recuperationQuestion, recuperationVerifier, changerMotDePasse, enregistrerJeton
} from '@/lib/api';
import Bouton from '../composants/Bouton';
import { MessageErreur } from '../composants/Message';

export default function Recuperation() {
  const routeur = useRouter();
  const mouvementReduit = useReducedMotion();

  const [temps, setTemps] = useState(1);
  const [numero, setNumero] = useState('');
  const [jour, setJour] = useState('');
  const [mois, setMois] = useState('');
  const [annee, setAnnee] = useState('');
  const [question, setQuestion] = useState('');
  const [reponse, setReponse] = useState('');
  const [jetonRecuperation, setJetonRecuperation] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [montrer, setMontrer] = useState(false);
  const [erreur, setErreur] = useState('');
  const [restantes, setRestantes] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const dateNaissance = `${annee}-${mois.padStart(2, '0')}-${jour.padStart(2, '0')}`;

  async function temps1(evenement) {
    evenement.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const resultat = await recuperationQuestion(numero, dateNaissance);
      setQuestion(resultat.question);
      setRestantes(resultat.tentatives_restantes);
      setTemps(2);
    } catch (probleme) {
      setErreur(probleme.message);
      if (probleme.donnees?.tentatives_restantes !== undefined) {
        setRestantes(probleme.donnees.tentatives_restantes);
      }
    }
    setEnCours(false);
  }

  async function temps2(evenement) {
    evenement.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const resultat = await recuperationVerifier(numero, dateNaissance, reponse);
      setJetonRecuperation(resultat.jeton_recuperation);
      setTemps(3);
    } catch (probleme) {
      setErreur(probleme.message);
      if (probleme.donnees?.tentatives_restantes !== undefined) {
        setRestantes(probleme.donnees.tentatives_restantes);
      }
    }
    setEnCours(false);
  }

  async function temps3(evenement) {
    evenement.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const resultat = await changerMotDePasse({ mot_de_passe: motDePasse }, jetonRecuperation);
      enregistrerJeton(resultat.jeton);
      routeur.push(resultat.espace || '/carte');
    } catch (probleme) {
      setErreur(probleme.message);
      setEnCours(false);
    }
  }

  const glissement = {
    initial: mouvementReduit ? false : { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: mouvementReduit ? undefined : { opacity: 0, x: -24 },
    transition: { duration: 0.22, ease: 'easeOut' }
  };

  return (
    <main className="page-telephone sans-barre pile-l">
      <Link href="/connexion" className="lien"><ArrowLeft size={18} strokeWidth={1.75} />Retour</Link>
      <span className="mono petit">{temps} sur 3</span>

      <AnimatePresence mode="wait" initial={false}>
        {temps === 1 && (
          <motion.form key="t1" className="pile-l" onSubmit={temps1} {...glissement}>
            <div className="pile-s">
              <h1 className="titre">Retrouver mon compte</h1>
              <p className="appui">Nous vérifions d&rsquo;abord qu&rsquo;il s&rsquo;agit bien de vous.</p>
              <p className="petit">
                Vous avez trois essais par heure. Passé ce nombre, il faudra attendre une
                heure ou vous présenter au centre.
              </p>
            </div>

            <label className="champ">
              <span className="champ-etiquette">Numéro principal</span>
              <span className="rang" style={{ gap: 'var(--e2)' }}>
                <span className="indicatif">+226</span>
                <input className="champ-saisie mono" inputMode="numeric" value={numero}
                       onChange={(e) => setNumero(e.target.value)} />
              </span>
              <span className="champ-aide">Celui que vous avez donné en premier à l&rsquo;inscription.</span>
            </label>

            <div className="champ">
              <span className="champ-etiquette">Date de naissance</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: 'var(--e4)' }}>
                {[[jour, setJour, 'Jour', 2], [mois, setMois, 'Mois', 2], [annee, setAnnee, 'Année', 4]]
                  .map(([valeur, poser, mot, taille]) => (
                    <label key={mot} className="pile-s">
                      <input className="champ-saisie mono" inputMode="numeric" maxLength={taille}
                             value={valeur}
                             onChange={(e) => poser(e.target.value.replace(/\D/g, ''))} />
                      <span className="petit">{mot}</span>
                    </label>
                  ))}
              </div>
            </div>

            <MessageErreur>{erreur}</MessageErreur>
            <div className="pile-s">
              <Bouton variante="principal" large type="submit" enCours={enCours} onClick={temps1}>
                Continuer
              </Bouton>
              {restantes !== null && (
                <p className={`petit ${restantes <= 1 ? 'etat-sang' : ''}`} style={{ textAlign: 'center' }}>
                  Il vous reste {restantes} tentative{restantes > 1 ? 's' : ''} cette heure-ci.
                </p>
              )}
            </div>
          </motion.form>
        )}

        {temps === 2 && (
          <motion.form key="t2" className="pile-l" onSubmit={temps2} {...glissement}>
            <h1 className="titre">Votre question</h1>

            <div className="pile-s">
              <span className="petit">Vous avez écrit cette question à l&rsquo;inscription</span>
              <p style={{ fontWeight: 600 }}>{question}</p>
            </div>

            <label className={erreur ? 'champ champ-erreur' : 'champ'}>
              <span className="champ-etiquette">Votre réponse</span>
              <input className="champ-saisie" value={reponse} autoComplete="off"
                     onChange={(e) => setReponse(e.target.value)} />
              <span className="champ-aide">Les majuscules et les accents n&rsquo;ont pas d&rsquo;importance.</span>
            </label>

            <MessageErreur>{erreur}</MessageErreur>
            <div className="pile-s">
              <Bouton variante="principal" large type="submit" enCours={enCours} onClick={temps2}>
                Continuer
              </Bouton>
              {restantes !== null && (
                <p className={`petit ${restantes <= 1 ? 'etat-sang' : ''}`} style={{ textAlign: 'center' }}>
                  Il vous reste {restantes} tentative{restantes > 1 ? 's' : ''} cette heure-ci.
                </p>
              )}
            </div>
          </motion.form>
        )}

        {temps === 3 && (
          <motion.form key="t3" className="pile-l" onSubmit={temps3} {...glissement}>
            <h1 className="titre">Nouveau mot de passe</h1>

            <label className={erreur ? 'champ champ-erreur' : 'champ'}>
              <span className="champ-etiquette rang-espace">
                Choisissez votre mot de passe
                <button type="button" className="lien"
                        style={{ minHeight: 0, fontWeight: 400, fontSize: 'var(--t-appui)' }}
                        onClick={() => setMontrer(!montrer)}>
                  {montrer ? <><EyeOff size={16} strokeWidth={1.75} />Masquer</>
                           : <><Eye size={16} strokeWidth={1.75} />Montrer</>}
                </button>
              </span>
              <input className="champ-saisie" type={montrer ? 'text' : 'password'}
                     autoComplete="new-password" value={motDePasse}
                     onChange={(e) => setMotDePasse(e.target.value)} />
              <span className="champ-aide">
                Huit caractères au moins. Vous pouvez le relire avant d&rsquo;enregistrer,
                il n&rsquo;y a rien à recopier.
              </span>
            </label>

            <MessageErreur>{erreur}</MessageErreur>
            <div className="pile-s">
              <Bouton variante="principal" large type="submit" enCours={enCours} onClick={temps3}>
                Enregistrer
              </Bouton>
              <p className="petit" style={{ textAlign: 'center' }}>
                Vous serez conduit à votre carte de donneur.
              </p>
            </div>

            <hr className="filet" />
            <p className="petit">
              Si vous ne retrouvez pas votre réponse, présentez-vous à votre centre
              avec une pièce d&rsquo;identité. Un agent rouvrira votre compte sur place.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </main>
  );
}
