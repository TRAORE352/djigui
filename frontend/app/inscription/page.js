'use client';
// =====================================================================
//  E2, E3, E4 · Inscription en trois étapes.
//  E2 identité, E3 contact, E4 profil de don et accord.
//  La saisie déjà faite est conservée quand on revient en arrière.
//  Le rouge n'apparaît qu'à l'erreur constatée, jamais sur un champ
//  encore vide.
// =====================================================================
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, Plus, Phone, MessageSquare, MessageCircle } from 'lucide-react';
import { inscription, enregistrerJeton, ErreurService } from '@/lib/api';
import ChampZone from '../composants/ChampZone';
import Bouton from '../composants/Bouton';
import { MessageErreur } from '../composants/Message';
import { ORDRE_GROUPES } from '@/lib/format';

const CANAUX = [
  { cle: 'appel',    mot: 'Appel',    Icone: Phone },
  { cle: 'sms',      mot: 'SMS',      Icone: MessageSquare },
  { cle: 'whatsapp', mot: 'WhatsApp', Icone: MessageCircle }
];

function ageRevolu(jour, mois, annee) {
  const naissance = new Date(Number(annee), Number(mois) - 1, Number(jour));
  const aujourdHui = new Date();
  let age = aujourdHui.getFullYear() - naissance.getFullYear();
  const passe = aujourdHui.getMonth() > naissance.getMonth() ||
    (aujourdHui.getMonth() === naissance.getMonth() && aujourdHui.getDate() >= naissance.getDate());
  return passe ? age : age - 1;
}

export default function Inscription() {
  const routeur = useRouter();
  const mouvementReduit = useReducedMotion();

  const [etape, setEtape] = useState(1);
  const [sens, setSens] = useState(1);
  const [erreur, setErreur] = useState('');
  const [champFautif, setChampFautif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [montrerMotDePasse, setMontrerMotDePasse] = useState(false);
  const [secondairesOuverts, setSecondairesOuverts] = useState(false);

  const [d, setD] = useState({
    nom: '', prenom: '', sexe: '', jour: '', mois: '', annee: '',
    numero: '', confirmation: '', secondaires: [], motDePasse: '',
    groupe: '', groupeInconnu: false, poids: '', idZone: null,
    question: '', reponse: '',
    canaux: { appel: true, sms: true, whatsapp: false },
    consentement: false
  });

  const changer = (cle, valeur) => setD((avant) => ({ ...avant, [cle]: valeur }));
  const poserErreur = (message, champ) => { setErreur(message); setChampFautif(champ || ''); };
  const classe = (champ) => champFautif === champ ? 'champ champ-erreur' : 'champ';
  const allerA = (numero) => { setSens(numero > etape ? 1 : -1); poserErreur('', ''); setEtape(numero); };

  function validerEtape1() {
    if (!d.nom.trim()) return poserErreur('Écrivez votre nom.', 'nom');
    if (!d.prenom.trim()) return poserErreur('Écrivez votre prénom.', 'prenom');
    if (!d.sexe) return poserErreur('Choisissez Femme ou Homme.', 'sexe');
    if (!/^\d{1,2}$/.test(d.jour) || !/^\d{1,2}$/.test(d.mois) || !/^\d{4}$/.test(d.annee)) {
      return poserErreur('La date de naissance est incomplète.', 'date');
    }
    if (ageRevolu(d.jour, d.mois, d.annee) < 18) {
      return poserErreur(
        'Il faut avoir 18 ans révolus pour donner son sang. Vous pourrez créer votre compte à votre majorité.',
        'date');
    }
    allerA(2);
  }

  function validerEtape2() {
    const numero = d.numero.replace(/\D/g, '');
    if (numero.length !== 8) return poserErreur('Le numéro doit compter 8 chiffres.', 'numero');
    if (numero !== d.confirmation.replace(/\D/g, '')) {
      return poserErreur(
        'Les deux numéros ne sont pas les mêmes. Corrigez celui du bas ou celui du haut.',
        'confirmation');
    }
    for (const secondaire of d.secondaires) {
      if (secondaire.trim() && secondaire.replace(/\D/g, '').length !== 8) {
        return poserErreur('Un numéro de secours est incomplet : 8 chiffres attendus.', '');
      }
    }
    if (d.motDePasse.length < 8) {
      return poserErreur('Le mot de passe doit compter huit caractères au moins.', 'motDePasse');
    }
    allerA(3);
  }

  async function envoyer() {
    if (!d.groupe && !d.groupeInconnu) {
      return poserErreur('Choisissez votre groupe, ou « Je ne sais pas ».', 'groupe');
    }
    if (!Number(d.poids)) return poserErreur('Écrivez votre poids en kilogrammes.', 'poids');
    if (!d.idZone) return poserErreur('Choisissez votre zone dans les propositions.', 'zone');
    if (d.question.trim().length < 5) return poserErreur('Écrivez votre question de sécurité.', 'question');
    if (d.reponse.trim().length < 2) return poserErreur('Écrivez la réponse à votre question.', 'reponse');
    if (!d.canaux.appel && !d.canaux.sms && !d.canaux.whatsapp) {
      return poserErreur('Choisissez au moins un moyen de contact.', 'canaux');
    }
    if (!d.consentement) return poserErreur('L\u2019accord est nécessaire pour créer le compte.', 'consentement');

    poserErreur('', '');
    setEnCours(true);
    try {
      const resultat = await inscription({
        nom: d.nom.trim(), prenom: d.prenom.trim(), sexe: d.sexe,
        date_naissance: `${d.annee}-${d.mois.padStart(2, '0')}-${d.jour.padStart(2, '0')}`,
        numero_principal: d.numero, numero_confirmation: d.confirmation,
        numeros_secondaires: d.secondaires.filter((numero) => numero.trim()),
        mot_de_passe: d.motDePasse,
        groupe_sanguin: d.groupeInconnu ? null : d.groupe,
        poids_declare: Number(d.poids), id_zone: d.idZone,
        question_securite: d.question.trim(), reponse_securite: d.reponse,
        accepte_sms: d.canaux.sms, accepte_messagerie: d.canaux.whatsapp,
        consentement: true
      });
      enregistrerJeton(resultat.jeton);
      routeur.push('/carte');
    } catch (probleme) {
      const champs = {
        numero_principal: 'numero', numero_confirmation: 'confirmation',
        mot_de_passe: 'motDePasse', date_naissance: 'date', id_zone: 'zone',
        groupe_sanguin: 'groupe', poids_declare: 'poids',
        question_securite: 'question', reponse_securite: 'reponse'
      };
      const champ = probleme instanceof ErreurService ? champs[probleme.champ] : '';
      // Une erreur d'identité ou de contact renvoie à son étape.
      if (['numero', 'confirmation', 'motDePasse'].includes(champ)) allerA(2);
      else if (['date'].includes(champ)) allerA(1);
      poserErreur(probleme.message, champ);
      setEnCours(false);
    }
  }

  const glissement = {
    initial: mouvementReduit ? false : { opacity: 0, x: sens * 24 },
    animate: { opacity: 1, x: 0 },
    exit: mouvementReduit ? undefined : { opacity: 0, x: sens * -24 },
    transition: { duration: 0.22, ease: 'easeOut' }
  };

  return (
    <main className="page-telephone sans-barre pile-l">
      {etape === 1 ? (
        <Link href="/" className="lien"><ArrowLeft size={18} strokeWidth={1.75} />Retour</Link>
      ) : (
        <button type="button" className="lien" onClick={() => allerA(etape - 1)}>
          <ArrowLeft size={18} strokeWidth={1.75} />Retour
        </button>
      )}

      <div className="pile-s">
        <div className="segments" aria-hidden="true">
          {[1, 2, 3].map((rang) => (
            <span key={rang} className={etape >= rang ? 'actif' : ''} />
          ))}
        </div>
        <span className="mono petit">Étape {etape} sur 3</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {/* ============================ E2 ============================ */}
        {etape === 1 && (
          <motion.section key="e2" className="pile-l" {...glissement}>
            <div className="pile-s">
              <h1 className="titre">Qui êtes-vous ?</h1>
              <p className="appui">Quatre questions, puis nous passons à la suite.</p>
            </div>

            <label className={classe('nom')}>
              <span className="champ-etiquette">Nom</span>
              <input className="champ-saisie" value={d.nom} autoComplete="family-name"
                     onChange={(e) => changer('nom', e.target.value)} />
            </label>

            <label className={classe('prenom')}>
              <span className="champ-etiquette">Prénom</span>
              <input className="champ-saisie" value={d.prenom} autoComplete="given-name"
                     onChange={(e) => changer('prenom', e.target.value)} />
            </label>

            <div className={classe('sexe')}>
              <span className="champ-etiquette">Sexe</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--e3)' }}>
                {[['F', 'Femme'], ['M', 'Homme']].map(([code, mot]) => (
                  <button key={code} type="button" className="touche"
                          aria-pressed={d.sexe === code}
                          onClick={() => changer('sexe', code)}>{mot}</button>
                ))}
              </div>
            </div>

            <div className={classe('date')}>
              <span className="champ-etiquette">Date de naissance</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: 'var(--e4)' }}>
                {[['jour', 'Jour', 2, '14'], ['mois', 'Mois', 2, '03'], ['annee', 'Année', 4, '1998']]
                  .map(([cle, mot, taille, exemple]) => (
                    <label key={cle} className="pile-s">
                      <input className="champ-saisie mono" inputMode="numeric" maxLength={taille}
                             placeholder={exemple} value={d[cle]}
                             onChange={(e) => changer(cle, e.target.value.replace(/\D/g, ''))} />
                      <span className="petit">{mot}</span>
                    </label>
                  ))}
              </div>
              <span className="champ-aide">Il faut avoir 18 ans révolus pour donner son sang.</span>
            </div>

            <MessageErreur>{erreur}</MessageErreur>
            <Bouton variante="principal" large onClick={validerEtape1}>Continuer</Bouton>
          </motion.section>
        )}

        {/* ============================ E3 ============================ */}
        {etape === 2 && (
          <motion.section key="e3" className="pile-l" {...glissement}>
            <h1 className="titre">Comment vous joindre ?</h1>

            <label className={classe('numero')}>
              <span className="champ-etiquette">Numéro principal</span>
              <span className="rang" style={{ gap: 'var(--e2)' }}>
                <span className="indicatif">+226</span>
                <input className="champ-saisie mono" inputMode="numeric" maxLength={11}
                       autoComplete="tel-national" value={d.numero}
                       onChange={(e) => changer('numero', e.target.value)} />
              </span>
            </label>

            <label className={classe('confirmation')}>
              <span className="champ-etiquette">Écrivez à nouveau ce numéro</span>
              <span className="rang" style={{ gap: 'var(--e2)' }}>
                <span className="indicatif">+226</span>
                <input className="champ-saisie mono" inputMode="numeric" maxLength={11}
                       autoComplete="off" value={d.confirmation}
                       onPaste={(e) => e.preventDefault()}
                       onChange={(e) => changer('confirmation', e.target.value)} />
              </span>
              <span className="champ-aide">
                Le collage et le remplissage automatique sont désactivés dans ce champ.
              </span>
            </label>

            <hr className="filet" />
            <p className="appui">
              Ce numéro doit être actif et vous appartenir. C&rsquo;est par lui que le
              centre vous joindra le jour où votre groupe manque.
            </p>
            <hr className="filet" />

            {!secondairesOuverts ? (
              <button type="button" className="lien"
                      onClick={() => { setSecondairesOuverts(true); changer('secondaires', ['']); }}>
                <Plus size={18} strokeWidth={1.75} />Ajouter un autre numéro
              </button>
            ) : (
              <div className="pile">
                <span className="champ-etiquette">Numéros de secours</span>
                {d.secondaires.map((secondaire, indice) => (
                  <span key={indice} className="rang" style={{ gap: 'var(--e2)' }}>
                    <span className="indicatif">+226</span>
                    <input className="champ-saisie mono" inputMode="numeric" maxLength={11}
                           value={secondaire}
                           onChange={(e) => {
                             const liste = [...d.secondaires];
                             liste[indice] = e.target.value;
                             changer('secondaires', liste);
                           }} />
                  </span>
                ))}
                {d.secondaires.length < 3 && (
                  <button type="button" className="lien" style={{ fontSize: 'var(--t-appui)' }}
                          onClick={() => changer('secondaires', [...d.secondaires, ''])}>
                    <Plus size={16} strokeWidth={1.75} />Ajouter un autre numéro
                  </button>
                )}
                <span className="petit">Jusqu&rsquo;à trois numéros de secours, facultatifs.</span>
              </div>
            )}

            <label className={classe('motDePasse')}>
              <span className="champ-etiquette rang-espace">
                Mot de passe
                <button type="button" className="lien"
                        style={{ minHeight: 0, fontWeight: 400, fontSize: 'var(--t-appui)' }}
                        onClick={() => setMontrerMotDePasse(!montrerMotDePasse)}>
                  {montrerMotDePasse
                    ? <><EyeOff size={16} strokeWidth={1.75} />Masquer</>
                    : <><Eye size={16} strokeWidth={1.75} />Montrer</>}
                </button>
              </span>
              <input className="champ-saisie" type={montrerMotDePasse ? 'text' : 'password'}
                     autoComplete="new-password" value={d.motDePasse}
                     onChange={(e) => changer('motDePasse', e.target.value)} />
              <span className="champ-aide">Huit caractères au moins.</span>
            </label>

            <MessageErreur>{erreur}</MessageErreur>
            <Bouton variante="principal" large onClick={validerEtape2}>Continuer</Bouton>
          </motion.section>
        )}

        {/* ============================ E4 ============================ */}
        {etape === 3 && (
          <motion.section key="e4" className="pile-l" {...glissement}>
            <h1 className="titre">Dernière étape</h1>

            <div className={classe('groupe')}>
              <span className="champ-etiquette rang-espace">
                Groupe sanguin
                <button type="button" className="lien"
                        style={{ minHeight: 0, fontWeight: 400, fontSize: 'var(--t-appui)' }}
                        aria-pressed={d.groupeInconnu}
                        onClick={() => setD((avant) => ({
                          ...avant, groupeInconnu: !avant.groupeInconnu, groupe: ''
                        }))}>
                  {d.groupeInconnu ? 'Je ne sais pas ✓' : 'Je ne sais pas'}
                </button>
              </span>
              <div className="grille-groupes" style={{ marginTop: 'var(--e2)' }}>
                {ORDRE_GROUPES.map((groupe) => (
                  <button key={groupe} type="button" className="touche-groupe"
                          aria-pressed={d.groupe === groupe} disabled={d.groupeInconnu}
                          onClick={() => changer('groupe', groupe)}>{groupe}</button>
                ))}
              </div>
              {d.groupeInconnu && (
                <span className="champ-aide">Le centre vérifiera votre groupe sur place.</span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--e5)' }}>
              <label className={classe('poids')}>
                <span className="champ-etiquette">Poids</span>
                <span className="rang" style={{ gap: 'var(--e2)' }}>
                  <input className="champ-saisie mono" inputMode="numeric" maxLength={3}
                         value={d.poids}
                         onChange={(e) => changer('poids', e.target.value.replace(/\D/g, ''))} />
                  <span className="appui">kg</span>
                </span>
                {d.poids && Number(d.poids) < 50 && (
                  <span className="champ-aide">Sous 50 kg, le centre décidera sur place.</span>
                )}
              </label>
              <ChampZone valeur={d.idZone} enErreur={champFautif === 'zone'}
                         surChoix={(id) => changer('idZone', id)} />
            </div>

            <hr className="filet" />

            <div className="pile">
              <div className="pile-s">
                <span className="champ-etiquette">Votre question de sécurité</span>
                <p className="petit">
                  Écrivez votre propre question. Si vous oubliez votre mot de passe,
                  c&rsquo;est le seul moyen de retrouver votre compte.
                </p>
              </div>
              <label className={classe('question')}>
                <span className="petit">Question</span>
                <input className="champ-saisie" value={d.question}
                       placeholder="Le nom de l&rsquo;école de mon quartier"
                       onChange={(e) => changer('question', e.target.value)} />
              </label>
              <label className={classe('reponse')}>
                <span className="petit">Réponse</span>
                <input className="champ-saisie" value={d.reponse} autoComplete="off"
                       onChange={(e) => changer('reponse', e.target.value)} />
              </label>
            </div>

            <div className={classe('canaux')}>
              <span className="champ-etiquette">Comment le centre peut vous contacter</span>
              <div className="rang" style={{ gap: 'var(--e3)', marginTop: 'var(--e2)', flexWrap: 'wrap' }}>
                {CANAUX.map(({ cle, mot, Icone }) => (
                  <button key={cle} type="button" className="touche"
                          aria-pressed={d.canaux[cle]}
                          onClick={() => changer('canaux', { ...d.canaux, [cle]: !d.canaux[cle] })}>
                    <Icone size={18} strokeWidth={1.75} aria-hidden="true" />{mot}
                  </button>
                ))}
              </div>
            </div>

            <label className={`${classe('consentement')} rang`} style={{ alignItems: 'flex-start', gap: 'var(--e3)' }}>
              <input type="checkbox" className="case-a-cocher" checked={d.consentement}
                     onChange={(e) => changer('consentement', e.target.checked)} />
              <span style={{ fontSize: 'var(--t-appui)' }}>
                J&rsquo;autorise le centre à conserver ces informations et à me contacter
                quand mon groupe manque. Je peux le retirer depuis mon compte.
              </span>
            </label>

            <MessageErreur>{erreur}</MessageErreur>
            <Bouton variante="principal" large onClick={envoyer}
                    disabled={!d.consentement} enCours={enCours}
                    motEnCours="Création du compte">
              Créer mon compte
            </Bouton>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
