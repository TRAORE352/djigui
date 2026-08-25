'use client';
// =====================================================================
//  E10 · Mon compte.
//  Page de paramètres : la hiérarchie visuelle suit la sensibilité de
//  chaque action, pas seulement le thème. Lecture seule vs modifiable
//  est immédiatement visible ; la zone dangereuse ne partage jamais le
//  poids visuel d'« Enregistrer » ou « Me déconnecter ». Le changement
//  de mot de passe prévient avant (sessions fermées) et ramène
//  proprement vers la connexion après, plutôt que de laisser une
//  session dont le jeton n'a plus cours.
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Phone, MessageSquare, MessageCircle, X, Eye, EyeOff, LogOut, Lock, ChevronDown
} from 'lucide-react';
import {
  monProfil, modifierProfil, changerQuestionSecurite, mesTelephones,
  ajouterTelephone, retirerTelephone, remplacerNumeroPrincipal,
  desactiverMonCompte, changerMotDePasse, deconnexion, effacerJeton
} from '@/lib/api';
import { etatNotifications, activerNotifications, desactiverNotifications } from '@/lib/notifications';
import { dateCourte, numeroLisible, ORDRE_GROUPES } from '@/lib/format';
import ChampZone from '../../composants/ChampZone';
import Repliable from '../../composants/Repliable';
import Bouton from '../../composants/Bouton';
import Confirmation from '../../composants/Confirmation';
import Etat from '../../composants/Etat';
import { MessageErreur, MessageReussite } from '../../composants/Message';
import { LignesEnAttente } from '../../composants/Squelette';

// Confirmation brève qui s'efface d'elle-même.
function useConfirmation() {
  const [mot, setMot] = useState('');
  useEffect(() => {
    if (!mot) return;
    const minuterie = setTimeout(() => setMot(''), 2500);
    return () => clearTimeout(minuterie);
  }, [mot]);
  return [mot, setMot];
}

// Carte-section dépliable : titre en petites capitales, filet dessous,
// chevron qui pivote — même repère que les .section-titre d'avant,
// devenu interactif. « Mes informations » ouverte par défaut : c'est
// ce qu'on vient vérifier le plus souvent ; le reste se déplie au besoin.
function CarteSection({ titre, ouvertParDefaut = false, children }) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const mouvementReduit = useReducedMotion();

  return (
    <section className="bloc-donneur pile">
      <button type="button" className="carte-section-entete"
              onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
        <span className="etiquette">{titre}</span>
        <motion.span
          animate={{ rotate: ouvert ? 180 : 0 }}
          transition={{ duration: mouvementReduit ? 0 : 0.18 }}
          style={{ display: 'flex' }}
        >
          <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {ouvert && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: mouvementReduit ? 0 : 0.25, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pile" style={{ paddingTop: 'var(--e4)' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// Section Notifications de la carte-section du même nom. Quatre états,
// jamais de demande de permission au chargement — uniquement sur clic
// du bouton « Activer ».
function NotificationsPush() {
  const [etat, setEtat] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = () => etatNotifications().then(setEtat);
  useEffect(() => { charger(); }, []);

  async function activer() {
    setEnCours(true); setErreur('');
    const resultat = await activerNotifications();
    if (resultat.etat === 'erreur') {
      setErreur(resultat.message || 'Impossible d’activer les notifications pour l’instant.');
    }
    await charger();
    setEnCours(false);
  }

  async function desactiver() {
    setEnCours(true); setErreur('');
    await desactiverNotifications();
    await charger();
    setEnCours(false);
  }

  if (!etat) return <p className="petit">Vérification…</p>;

  if (!etat.supporte) {
    return (
      <div className="pile-s">
        <p className="appui">
          Installez d&rsquo;abord DJIGUI sur votre écran d&rsquo;accueil pour activer les alertes.
        </p>
        <Link href="/installation" className="lien">Voir la marche à suivre</Link>
      </div>
    );
  }

  if (etat.permission === 'denied') {
    return (
      <p className="appui">
        Les notifications sont bloquées pour DJIGUI dans les réglages de votre téléphone.
        Autorisez-les depuis ces réglages pour recevoir les alertes ici.
      </p>
    );
  }

  if (etat.abonne) {
    return (
      <div className="pile-s">
        <Etat ton="seve">Alertes activées</Etat>
        <button type="button" className="bouton-fantome" style={{ alignSelf: 'flex-start' }}
                disabled={enCours} onClick={desactiver}>
          Désactiver
        </button>
        <MessageErreur>{erreur}</MessageErreur>
      </div>
    );
  }

  return (
    <div className="pile-s">
      <p className="petit">Recevez une notification dès qu&rsquo;un centre a besoin de votre groupe.</p>
      <Bouton variante="secondaire" className="bouton-souleve" compact
              style={{ alignSelf: 'flex-start' }} enCours={enCours} motEnCours="Activation"
              onClick={activer}>
        Activer les alertes sur ce téléphone
      </Bouton>
      <MessageErreur>{erreur}</MessageErreur>
    </div>
  );
}

export default function MonCompte() {
  const routeur = useRouter();
  const mouvementReduit = useReducedMotion();
  const [profil, setProfil] = useState(null);
  const [telephones, setTelephones] = useState([]);
  const [maximum, setMaximum] = useState(4);
  const [erreur, setErreur] = useState('');
  const [reussite, setReussite] = useConfirmation();

  // Informations modifiables
  const [poids, setPoids] = useState('');
  const [idZone, setIdZone] = useState(null);
  const [groupe, setGroupe] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  // Numéros
  const [nouveauNumero, setNouveauNumero] = useState('');
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [aRetirer, setARetirer] = useState(null);
  const [retraitEnCours, setRetraitEnCours] = useState(null);
  const [remplacement, setRemplacement] = useState({ numero: '', confirmation: '', conserver: true });
  const [remplacementEnCours, setRemplacementEnCours] = useState(false);

  // Canaux
  const [canalEnCours, setCanalEnCours] = useState(null);

  // Question de sécurité
  const [question, setQuestion] = useState('');
  const [reponse, setReponse] = useState('');
  const [questionEnCours, setQuestionEnCours] = useState(false);
  const [questionConfirmOuverte, setQuestionConfirmOuverte] = useState(false);

  // Mot de passe
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [montrer, setMontrer] = useState(false);
  const [motDePasseEnCours, setMotDePasseEnCours] = useState(false);
  const [motDePasseConfirmOuverte, setMotDePasseConfirmOuverte] = useState(false);

  // Désactivation
  const [desactivationOuverte, setDesactivationOuverte] = useState(false);
  const [desactivationEnCours, setDesactivationEnCours] = useState(false);

  async function recharger() {
    const [donneesProfil, donneesTelephones] = await Promise.all([monProfil(), mesTelephones()]);
    setProfil(donneesProfil);
    setPoids(donneesProfil.poids_declare != null ? String(donneesProfil.poids_declare) : '');
    setIdZone(donneesProfil.id_zone);
    setGroupe(donneesProfil.groupe_sanguin || '');
    setTelephones(donneesTelephones.telephones);
    setMaximum(donneesTelephones.maximum);
  }

  useEffect(() => { recharger().catch((probleme) => setErreur(probleme.message)); }, []);

  async function agir(action, motDeReussite) {
    setErreur('');
    try {
      await action();
      if (motDeReussite) setReussite(motDeReussite);
      await recharger();
      return true;
    } catch (probleme) {
      setErreur(probleme.message);
      return false;
    }
  }

  async function fermerSession() {
    try { await deconnexion(); } catch { /* la session locale s'efface quand même */ }
    effacerJeton();
    routeur.replace('/');
  }

  async function confirmerChangementMotDePasse() {
    setMotDePasseEnCours(true);
    setErreur('');
    try {
      await changerMotDePasse({ ancien_mot_de_passe: ancien, mot_de_passe: nouveau });
      setMotDePasseConfirmOuverte(false);
      setAncien(''); setNouveau('');
      // Le service referme les autres sessions (règle RG31). Plutôt que de
      // garder cet onglet ouvert avec un jeton dont la portée vient de
      // changer, on ramène le donneur se reconnecter avec le mot de passe
      // qu'il vient de choisir — jamais d'appel silencieux voué à échouer.
      setReussite('Mot de passe changé. Reconnexion avec votre nouveau mot de passe…');
      // Le bandeau de succès vit en haut de la page : sur cet écran dense,
      // le donneur peut très bien être descendu jusqu'à la carte Sécurité.
      // Sans remonter, il serait redirigé sans jamais l'avoir vu.
      window.scrollTo({ top: 0, behavior: mouvementReduit ? 'auto' : 'smooth' });
      effacerJeton();
      setTimeout(() => routeur.replace('/connexion'), 1800);
    } catch (probleme) {
      setErreur(probleme.message);
      setMotDePasseEnCours(false);
    }
  }

  if (!profil) {
    return <main className="page-telephone pile-l"><LignesEnAttente nombre={5} /></main>;
  }

  const canaux = [
    { cle: 'appel', mot: 'Appel', Icone: Phone, actif: true, fige: true },
    { cle: 'accepte_sms', mot: 'SMS', Icone: MessageSquare, actif: profil.accepte_sms },
    { cle: 'accepte_messagerie', mot: 'WhatsApp', Icone: MessageCircle, actif: profil.accepte_messagerie }
  ];

  const poidsInitial = profil.poids_declare != null ? String(profil.poids_declare) : '';
  const poidsValide = poids === '' || Number(poids) > 0;
  const groupeModifiable = !profil.groupe_sanguin;
  const groupeModifie = groupeModifiable && groupe !== '';
  const infosModifiees = poids !== poidsInitial || idZone !== profil.id_zone || groupeModifie;
  const infosValides = infosModifiees && idZone && poidsValide;

  const entree = (rang) => mouvementReduit ? {} : {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.06 * rang, duration: 0.35, ease: 'easeOut' }
  };

  return (
    <main className="page-telephone pile-xl">
      <h1 className="titre">Mon compte</h1>
      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      {/* ---------------- Mes informations ---------------- */}
      <motion.div {...entree(0)}>
      <CarteSection titre="Mes informations" ouvertParDefaut>
        <div className="pile-s">
          <div className="ligne-fait" style={{ borderTop: 'none', paddingTop: 0 }}>
            <span style={{ fontWeight: 600 }}>{profil.prenom} {profil.nom}</span>
            <span className="valeur">{dateCourte(profil.date_naissance)}</span>
          </div>
          <p className="petit rang" style={{ gap: 'var(--e2)' }}>
            <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
            Nom, prénom et date de naissance se corrigent au centre, avec une pièce
            d&rsquo;identité.
          </p>
        </div>

        <hr className="filet" />

        {groupeModifiable ? (
          <div className="pile-s">
            <span className="champ-etiquette">Groupe sanguin</span>
            <p className="petit">
              Vous ne l&rsquo;aviez pas renseigné à l&rsquo;inscription. Vous pouvez le régler
              une fois ici ; ensuite, seul le centre pourra le corriger.
            </p>
            <div className="grille-groupes">
              {ORDRE_GROUPES.map((g) => (
                <button key={g} type="button" className="touche-groupe" aria-pressed={groupe === g}
                        onClick={() => setGroupe(groupe === g ? '' : g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pile-s">
            <div className="ligne-fait" style={{ borderTop: 'none', paddingTop: 0 }}>
              <span className="appui">Groupe sanguin</span>
              <span className="valeur">{profil.groupe_sanguin}</span>
            </div>
            <p className="petit rang" style={{ gap: 'var(--e2)' }}>
              <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
              Modifiable au centre uniquement, avec une pièce d&rsquo;identité.
            </p>
          </div>
        )}

        <hr className="filet" />

        <p className="petit">
          Votre zone sert à savoir quel centre peut vous appeler. Tenez-la à jour si vous
          déménagez. Le poids reste facultatif.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--e5)' }}>
          <label className="champ">
            <span className="champ-etiquette">Poids (facultatif)</span>
            <span className="rang" style={{ gap: 'var(--e2)' }}>
              <input className="champ-saisie mono" inputMode="numeric" maxLength={3}
                     value={poids}
                     onChange={(e) => setPoids(e.target.value.replace(/\D/g, ''))} />
              <span className="appui">kg</span>
            </span>
          </label>
          <ChampZone valeur={idZone} surChoix={setIdZone} />
        </div>

        <Bouton variante="principal" enCours={enregistrement}
                disabled={!infosValides}
                onClick={async () => {
                  setEnregistrement(true);
                  await agir(() => modifierProfil({
                    poids_declare: poids === '' ? null : Number(poids),
                    id_zone: idZone,
                    ...(groupeModifie ? { groupe_sanguin: groupe } : {})
                  }), 'Enregistré.');
                  setEnregistrement(false);
                }}>
          Enregistrer
        </Bouton>
      </CarteSection>
      </motion.div>

      {/* ---------------- Mes numéros ---------------- */}
      <motion.div {...entree(1)}>
      <CarteSection titre="Mes numéros, dans l’ordre d’appel">
        <p className="petit">
          Le centre appelle dans cet ordre. Le premier numéro est aussi votre identifiant de
          connexion.
        </p>

        {telephones.map((telephone) => (
          <div key={telephone.id_telephone} className="ligne-fait" style={{ minHeight: 44, alignItems: 'center' }}>
            <span className="rang" style={{ gap: 'var(--e3)' }}>
              <span className="mono petit">{telephone.rang}</span>
              <span className="mono">+226 {numeroLisible(telephone.numero)}</span>
            </span>
            {telephone.rang === 1 ? (
              <span className="petit">principal</span>
            ) : aRetirer === telephone.id_telephone ? (
              <Bouton variante="danger" compact enCours={retraitEnCours === telephone.id_telephone}
                      motEnCours="Retrait"
                      onClick={async () => {
                        setRetraitEnCours(telephone.id_telephone);
                        await agir(() => retirerTelephone(telephone.id_telephone), 'Numéro retiré.');
                        setRetraitEnCours(null);
                        setARetirer(null);
                      }}>
                Confirmer le retrait
              </Bouton>
            ) : (
              <button type="button" className="bouton-fantome" onClick={() => setARetirer(telephone.id_telephone)}>
                <X size={16} strokeWidth={1.75} />Retirer
              </button>
            )}
          </div>
        ))}

        {telephones.length < maximum && (
          <Repliable
            titre="Ajouter un numéro"
            apercu="Un numéro de secours, pour rester joignable."
            ouvert={ajoutOuvert}
            surBascule={setAjoutOuvert}>
            <div className="pile-s">
              <span className="rang" style={{ gap: 'var(--e2)' }}>
                <span className="indicatif">+226</span>
                <input className="champ-saisie mono" inputMode="numeric" maxLength={11}
                       value={nouveauNumero}
                       onChange={(e) => setNouveauNumero(e.target.value)} />
              </span>
              <Bouton variante="secondaire" className="bouton-souleve" compact enCours={ajoutEnCours}
                      motEnCours="Ajout" disabled={!nouveauNumero.trim()}
                      onClick={async () => {
                        setAjoutEnCours(true);
                        const fait = await agir(() => ajouterTelephone(nouveauNumero), 'Numéro ajouté.');
                        setAjoutEnCours(false);
                        if (fait) { setNouveauNumero(''); setAjoutOuvert(false); }
                      }}>
                Ajouter ce numéro
              </Bouton>
            </div>
          </Repliable>
        )}

        <Repliable titre="Remplacer mon numéro principal"
                   apercu="Ce numéro est aussi votre identifiant de connexion.">
          <div className="pile">
            <label className="champ">
              <span className="champ-etiquette">Nouveau numéro</span>
              <span className="rang" style={{ gap: 'var(--e2)' }}>
                <span className="indicatif">+226</span>
                <input className="champ-saisie mono" inputMode="numeric" maxLength={11}
                       value={remplacement.numero}
                       onChange={(e) => setRemplacement({ ...remplacement, numero: e.target.value })} />
              </span>
            </label>
            <label className="champ">
              <span className="champ-etiquette">Écrivez à nouveau ce numéro</span>
              <span className="rang" style={{ gap: 'var(--e2)' }}>
                <span className="indicatif">+226</span>
                <input className="champ-saisie mono" inputMode="numeric" maxLength={11}
                       autoComplete="off" value={remplacement.confirmation}
                       onPaste={(e) => e.preventDefault()}
                       onChange={(e) => setRemplacement({ ...remplacement, confirmation: e.target.value })} />
              </span>
            </label>
            <label className="rang" style={{ alignItems: 'flex-start', gap: 'var(--e3)' }}>
              <input type="checkbox" className="case-a-cocher" checked={remplacement.conserver}
                     onChange={(e) => setRemplacement({ ...remplacement, conserver: e.target.checked })} />
              <span style={{ fontSize: 'var(--t-appui)' }}>
                Garder l&rsquo;ancien numéro comme numéro de secours.
              </span>
            </label>
            <p className="petit">
              Ce nouveau numéro deviendra votre identifiant de connexion.
            </p>
            <Bouton variante="secondaire" className="bouton-souleve" enCours={remplacementEnCours}
                    motEnCours="Remplacement"
                    disabled={!remplacement.numero.trim() || !remplacement.confirmation.trim()}
                    onClick={async () => {
                      setRemplacementEnCours(true);
                      const fait = await agir(() => remplacerNumeroPrincipal({
                        nouveau_numero: remplacement.numero,
                        confirmation: remplacement.confirmation,
                        conserver_ancien: remplacement.conserver
                      }), 'Numéro principal remplacé.');
                      setRemplacementEnCours(false);
                      if (fait) setRemplacement({ numero: '', confirmation: '', conserver: true });
                    }}>
              Remplacer le numéro principal
            </Bouton>
          </div>
        </Repliable>
      </CarteSection>
      </motion.div>

      {/* ---------------- Canaux ---------------- */}
      <motion.div {...entree(2)}>
      <CarteSection titre="Comment le centre me contacte">
        <p className="petit">
          Vous recevez les appels au don dans l&rsquo;application. Les autres moyens servent au
          centre pour vous joindre s&rsquo;il a besoin d&rsquo;une précision.
        </p>
        <div className="rang" style={{ gap: 'var(--e3)', flexWrap: 'wrap' }}>
          {canaux.map(({ cle, mot, Icone, actif, fige }) => (
            <button key={cle} type="button" className="touche touche-canal" aria-pressed={actif}
                    disabled={fige || canalEnCours === cle}
                    onClick={async () => {
                      setCanalEnCours(cle);
                      await agir(() => modifierProfil({ [cle]: !actif }), 'Enregistré.');
                      setCanalEnCours(null);
                    }}>
              <Icone size={18} strokeWidth={1.75} aria-hidden="true" />{mot}
            </button>
          ))}
        </div>
        <p className="petit">
          L&rsquo;appel reste toujours possible : c&rsquo;est à cela que servent vos numéros.
        </p>
      </CarteSection>
      </motion.div>

      {/* ---------------- Notifications ---------------- */}
      <motion.div {...entree(3)}>
      <CarteSection titre="Notifications">
        <NotificationsPush />
      </CarteSection>
      </motion.div>

      {/* ---------------- Sécurité ---------------- */}
      <motion.div {...entree(4)}>
      <CarteSection titre="Sécurité">
        <div className="encadre encadre-ocre">
          <Lock size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>
            Votre question de sécurité est le <strong>seul</strong> moyen de retrouver votre
            compte si vous oubliez votre mot de passe. Choisissez-la avec soin.
          </span>
        </div>

        <div className="pile-s">
          <span className="champ-etiquette">Ma question de sécurité</span>
          <p style={{ fontWeight: 600, fontSize: 'var(--t-appui)' }}>{profil.question_securite}</p>
        </div>
        <Repliable titre="Changer ma question" apercu="Nouvelle question, nouvelle réponse.">
          <div className="pile">
            <label className="champ">
              <span className="champ-etiquette">Nouvelle question</span>
              <input className="champ-saisie" value={question}
                     onChange={(e) => setQuestion(e.target.value)} />
            </label>
            <label className="champ">
              <span className="champ-etiquette">Nouvelle réponse</span>
              <input className="champ-saisie" value={reponse} autoComplete="off"
                     onChange={(e) => setReponse(e.target.value)} />
            </label>
            <Bouton variante="secondaire" className="bouton-souleve"
                    disabled={!question.trim() || !reponse.trim()}
                    onClick={() => setQuestionConfirmOuverte(true)}>
              Enregistrer la question
            </Bouton>
          </div>
        </Repliable>

        <hr className="filet" />

        <Repliable titre="Changer mon mot de passe">
          <div className="pile">
            <label className="champ">
              <span className="champ-etiquette">Mot de passe actuel</span>
              <input className="champ-saisie" type="password" autoComplete="current-password"
                     value={ancien} onChange={(e) => setAncien(e.target.value)} />
            </label>
            <label className="champ">
              <span className="champ-etiquette">Nouveau mot de passe</span>
              <span className="champ-saisie-groupe">
                <input className="champ-saisie-nue" type={montrer ? 'text' : 'password'}
                       autoComplete="new-password" value={nouveau}
                       onChange={(e) => setNouveau(e.target.value)} />
                <button type="button" className="champ-bouton-interne" onClick={() => setMontrer(!montrer)}>
                  {montrer ? <><EyeOff size={16} strokeWidth={1.75} />Masquer</>
                           : <><Eye size={16} strokeWidth={1.75} />Montrer</>}
                </button>
              </span>
              <span className="champ-aide">Huit caractères au moins.</span>
            </label>
            <Bouton variante="secondaire" className="bouton-souleve"
                    disabled={!ancien || nouveau.length < 8}
                    onClick={() => setMotDePasseConfirmOuverte(true)}>
              Changer le mot de passe
            </Bouton>
          </div>
        </Repliable>
      </CarteSection>
      </motion.div>

      {/* ---------------- Zone sensible ---------------- */}
      <motion.section className="carte-zone-sensible pile-s" {...entree(5)} style={{ marginTop: 'var(--e4)' }}>
        <span className="etiquette" style={{ color: 'var(--sang)' }}>Zone sensible</span>

        <p className="petit">
          Vous ne recevrez plus aucun appel au don. Vos dons enregistrés restent
          au centre. Vous pouvez réactiver le compte en vous reconnectant.
        </p>
        <Bouton variante="danger" className="bouton-minuscule" style={{ alignSelf: 'flex-start' }}
                onClick={() => setDesactivationOuverte(true)}>
          Désactiver mon compte
        </Bouton>

        <hr className="filet" />

        <button type="button" className="bouton-fantome" style={{ alignSelf: 'flex-start' }}
                onClick={fermerSession}>
          <LogOut size={14} strokeWidth={1.75} />Me déconnecter
        </button>
      </motion.section>

      <Confirmation
        ouverte={desactivationOuverte}
        titre="Désactiver votre compte ?"
        motAction="Désactiver mon compte"
        motRetour="Garder mon compte"
        varianteAction="danger"
        enCours={desactivationEnCours}
        surAnnuler={() => setDesactivationOuverte(false)}
        surConfirmer={async () => {
          setDesactivationEnCours(true);
          try {
            await desactiverMonCompte();
            effacerJeton();
            routeur.replace('/');
          } catch (probleme) {
            setErreur(probleme.message);
            setDesactivationEnCours(false);
            setDesactivationOuverte(false);
          }
        }}
      >
        <p className="appui">
          Vous ne recevrez plus aucun appel au don, à partir de maintenant.
        </p>
        <p className="appui">
          Vos {profil.nb_dons} don{profil.nb_dons > 1 ? 's' : ''} restent enregistrés au centre.
        </p>
        <p className="appui">
          Vous pouvez réactiver le compte à tout moment en vous reconnectant.
        </p>
      </Confirmation>

      <Confirmation
        ouverte={questionConfirmOuverte}
        titre="Changer votre question de sécurité ?"
        motAction="Confirmer le changement"
        motRetour="Revenir en arrière"
        varianteAction="secondaire"
        enCours={questionEnCours}
        surAnnuler={() => setQuestionConfirmOuverte(false)}
        surConfirmer={async () => {
          setQuestionEnCours(true);
          const fait = await agir(() => changerQuestionSecurite({
            question_securite: question, reponse_securite: reponse
          }), 'Question enregistrée.');
          setQuestionEnCours(false);
          setQuestionConfirmOuverte(false);
          if (fait) { setQuestion(''); setReponse(''); }
        }}
      >
        <p className="appui">
          C&rsquo;est le seul moyen de retrouver votre compte en cas d&rsquo;oubli du mot de
          passe. Assurez-vous de vous souvenir de la réponse.
        </p>
      </Confirmation>

      <Confirmation
        ouverte={motDePasseConfirmOuverte}
        titre="Changer votre mot de passe ?"
        motAction="Confirmer le changement"
        motRetour="Revenir en arrière"
        varianteAction="secondaire"
        enCours={motDePasseEnCours}
        surAnnuler={() => setMotDePasseConfirmOuverte(false)}
        surConfirmer={confirmerChangementMotDePasse}
      >
        <p className="appui">
          Après ce changement, vous devrez vous reconnecter avec votre nouveau mot de passe :
          vos autres sessions se ferment aussitôt.
        </p>
      </Confirmation>
    </main>
  );
}
