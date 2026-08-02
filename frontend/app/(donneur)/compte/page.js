'use client';
// =====================================================================
//  E10 · Mon compte.
//  Cinq sections en petites capitales, séparées par des filets pleine
//  largeur plutôt que par des cartes : on repère un sujet sans lire.
//  La désactivation est traitée comme les autres sections, sans
//  dramatisation, avec ses conséquences dites avant le geste.
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Phone, MessageSquare, MessageCircle, Plus, X, Eye, EyeOff, Check, LogOut
} from 'lucide-react';
import {
  monProfil, modifierProfil, changerQuestionSecurite, mesTelephones,
  ajouterTelephone, retirerTelephone, remplacerNumeroPrincipal,
  desactiverMonCompte, changerMotDePasse, deconnexion, effacerJeton, enregistrerJeton
} from '@/lib/api';
import { dateCourte, numeroLisible } from '@/lib/format';
import ChampZone from '../../composants/ChampZone';
import Repliable from '../../composants/Repliable';
import Bouton from '../../composants/Bouton';
import Confirmation from '../../composants/Confirmation';
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

export default function MonCompte() {
  const routeur = useRouter();
  const [profil, setProfil] = useState(null);
  const [telephones, setTelephones] = useState([]);
  const [maximum, setMaximum] = useState(4);
  const [erreur, setErreur] = useState('');
  const [reussite, setReussite] = useConfirmation();

  // Informations modifiables
  const [poids, setPoids] = useState('');
  const [idZone, setIdZone] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);

  // Numéros
  const [nouveauNumero, setNouveauNumero] = useState('');
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [aRetirer, setARetirer] = useState(null);
  const [remplacement, setRemplacement] = useState({ numero: '', confirmation: '', conserver: true });

  // Question de sécurité
  const [question, setQuestion] = useState('');
  const [reponse, setReponse] = useState('');

  // Mot de passe
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [montrer, setMontrer] = useState(false);

  // Désactivation
  const [desactivationOuverte, setDesactivationOuverte] = useState(false);
  const [desactivationEnCours, setDesactivationEnCours] = useState(false);

  async function recharger() {
    const [donneesProfil, donneesTelephones] = await Promise.all([monProfil(), mesTelephones()]);
    setProfil(donneesProfil);
    setPoids(String(donneesProfil.poids_declare));
    setIdZone(donneesProfil.id_zone);
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

  if (!profil) {
    return <main className="page-telephone pile-l"><LignesEnAttente nombre={5} /></main>;
  }

  const canaux = [
    { cle: 'appel', mot: 'Appel', Icone: Phone, actif: true, fige: true },
    { cle: 'accepte_sms', mot: 'SMS', Icone: MessageSquare, actif: profil.accepte_sms },
    { cle: 'accepte_messagerie', mot: 'WhatsApp', Icone: MessageCircle, actif: profil.accepte_messagerie }
  ];

  return (
    <main className="page-telephone pile-xl">
      <h1 className="titre">Mon compte</h1>
      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      {/* ---------------- Mes informations ---------------- */}
      <section className="pile">
        <div className="section-titre"><span className="etiquette">Mes informations</span></div>
        <p className="petit">
          Votre zone sert à savoir quel centre peut vous appeler. Tenez-la à jour si vous
          déménagez.
        </p>

        <div className="ligne-fait" style={{ borderTop: 'none', paddingTop: 0 }}>
          <span style={{ fontWeight: 600 }}>{profil.prenom} {profil.nom}</span>
          <span className="valeur">{dateCourte(profil.date_naissance)}</span>
        </div>
        <div className="ligne-fait">
          <span className="appui">Groupe sanguin</span>
          <span className="valeur">{profil.groupe_sanguin || 'à préciser au centre'}</span>
        </div>
        <p className="petit">
          Pour corriger votre nom, votre date de naissance ou votre groupe,
          adressez-vous à votre centre avec une pièce d&rsquo;identité.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--e5)' }}>
          <label className="champ">
            <span className="champ-etiquette">Poids</span>
            <span className="rang" style={{ gap: 'var(--e2)' }}>
              <input className="champ-saisie mono" inputMode="numeric" maxLength={3}
                     value={poids}
                     onChange={(e) => setPoids(e.target.value.replace(/\D/g, ''))} />
              <span className="appui">kg</span>
            </span>
          </label>
          <ChampZone valeur={idZone} surChoix={setIdZone} />
        </div>

        <Bouton variante="secondaire" enCours={enregistrement}
                disabled={!idZone || !Number(poids)}
                onClick={async () => {
                  setEnregistrement(true);
                  await agir(() => modifierProfil({
                    poids_declare: Number(poids), id_zone: idZone
                  }), 'Enregistré.');
                  setEnregistrement(false);
                }}>
          Enregistrer
        </Bouton>
      </section>

      {/* ---------------- Mes numéros ---------------- */}
      <section className="pile">
        <div className="section-titre">
          <span className="etiquette">Mes numéros, dans l&rsquo;ordre d&rsquo;appel</span>
        </div>
        <p className="petit">
          Le centre appelle dans cet ordre. Le premier numéro est aussi votre identifiant de
          connexion.
        </p>

        {telephones.map((telephone) => (
          <div key={telephone.id_telephone} className="ligne-fait" style={{ minHeight: 44 }}>
            <span className="rang" style={{ gap: 'var(--e3)' }}>
              <span className="mono petit">{telephone.rang}</span>
              <span className="mono">+226 {numeroLisible(telephone.numero)}</span>
            </span>
            {telephone.rang === 1 ? (
              <span className="petit">principal</span>
            ) : aRetirer === telephone.id_telephone ? (
              <button type="button" className="lien lien-sang"
                      onClick={() => agir(
                        () => retirerTelephone(telephone.id_telephone), 'Numéro retiré.')}>
                Confirmer le retrait
              </button>
            ) : (
              <button type="button" className="lien"
                      onClick={() => setARetirer(telephone.id_telephone)}>
                <X size={16} strokeWidth={1.75} />Retirer
              </button>
            )}
          </div>
        ))}

        {telephones.length < maximum && (
          ajoutOuvert ? (
            <div className="pile-s">
              <span className="rang" style={{ gap: 'var(--e2)' }}>
                <span className="indicatif">+226</span>
                <input className="champ-saisie mono" inputMode="numeric" maxLength={11}
                       value={nouveauNumero}
                       onChange={(e) => setNouveauNumero(e.target.value)} />
              </span>
              <div className="rang" style={{ gap: 'var(--e3)' }}>
                <Bouton variante="secondaire" compact
                        onClick={async () => {
                          const fait = await agir(
                            () => ajouterTelephone(nouveauNumero), 'Numéro ajouté.');
                          if (fait) { setNouveauNumero(''); setAjoutOuvert(false); }
                        }}>
                  Ajouter ce numéro
                </Bouton>
                <button type="button" className="lien"
                        onClick={() => { setAjoutOuvert(false); setNouveauNumero(''); }}>
                  Revenir en arrière
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="lien" onClick={() => setAjoutOuvert(true)}>
              <Plus size={18} strokeWidth={1.75} />Ajouter un numéro
            </button>
          )
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
            <Bouton variante="secondaire"
                    onClick={async () => {
                      const fait = await agir(() => remplacerNumeroPrincipal({
                        nouveau_numero: remplacement.numero,
                        confirmation: remplacement.confirmation,
                        conserver_ancien: remplacement.conserver
                      }), 'Numéro principal remplacé.');
                      if (fait) setRemplacement({ numero: '', confirmation: '', conserver: true });
                    }}>
              Remplacer le numéro principal
            </Bouton>
          </div>
        </Repliable>
      </section>

      {/* ---------------- Canaux ---------------- */}
      <section className="pile">
        <div className="section-titre">
          <span className="etiquette">Comment le centre me contacte</span>
        </div>
        <p className="petit">
          Vous recevez les appels au don dans l&rsquo;application. Les autres moyens servent au
          centre pour vous joindre s&rsquo;il a besoin d&rsquo;une précision.
        </p>
        <div className="rang" style={{ gap: 'var(--e3)', flexWrap: 'wrap' }}>
          {canaux.map(({ cle, mot, Icone, actif, fige }) => (
            <button key={cle} type="button" className="touche" aria-pressed={actif}
                    disabled={fige}
                    onClick={() => agir(() => modifierProfil({ [cle]: !actif }), 'Enregistré.')}>
              <Icone size={18} strokeWidth={1.75} aria-hidden="true" />{mot}
            </button>
          ))}
        </div>
        <p className="petit">
          L&rsquo;appel reste toujours possible : c&rsquo;est à cela que servent vos numéros.
        </p>
      </section>

      {/* ---------------- Question de sécurité ---------------- */}
      <section className="pile">
        <div className="section-titre">
          <span className="etiquette">Ma question de sécurité</span>
        </div>
        <p style={{ fontWeight: 600, fontSize: 'var(--t-appui)' }}>{profil.question_securite}</p>
        <Repliable titre="Changer ma question"
                   apercu="C&rsquo;est le seul moyen de retrouver votre compte.">
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
            <Bouton variante="secondaire"
                    onClick={async () => {
                      const fait = await agir(() => changerQuestionSecurite({
                        question_securite: question, reponse_securite: reponse
                      }), 'Question enregistrée.');
                      if (fait) { setQuestion(''); setReponse(''); }
                    }}>
              Enregistrer la question
            </Bouton>
          </div>
        </Repliable>
      </section>

      {/* ---------------- Mot de passe ---------------- */}
      <section className="pile">
        <div className="section-titre"><span className="etiquette">Mon mot de passe</span></div>
        <Repliable titre="Changer mon mot de passe">
          <div className="pile">
            <label className="champ">
              <span className="champ-etiquette">Mot de passe actuel</span>
              <input className="champ-saisie" type="password" autoComplete="current-password"
                     value={ancien} onChange={(e) => setAncien(e.target.value)} />
            </label>
            <label className="champ">
              <span className="champ-etiquette rang-espace">
                Nouveau mot de passe
                <button type="button" className="lien"
                        style={{ minHeight: 0, fontWeight: 400, fontSize: 'var(--t-appui)' }}
                        onClick={() => setMontrer(!montrer)}>
                  {montrer ? <><EyeOff size={16} strokeWidth={1.75} />Masquer</>
                           : <><Eye size={16} strokeWidth={1.75} />Montrer</>}
                </button>
              </span>
              <input className="champ-saisie" type={montrer ? 'text' : 'password'}
                     autoComplete="new-password" value={nouveau}
                     onChange={(e) => setNouveau(e.target.value)} />
              <span className="champ-aide">Huit caractères au moins.</span>
            </label>
            <Bouton variante="secondaire"
                    onClick={async () => {
                      setErreur('');
                      try {
                        const resultat = await changerMotDePasse({
                          ancien_mot_de_passe: ancien, mot_de_passe: nouveau
                        });
                        enregistrerJeton(resultat.jeton);
                        setAncien(''); setNouveau('');
                        setReussite('Mot de passe changé. Vos autres sessions sont fermées.');
                      } catch (probleme) { setErreur(probleme.message); }
                    }}>
              Changer le mot de passe
            </Bouton>
          </div>
        </Repliable>
      </section>

      {/* ---------------- Quitter ---------------- */}
      <section className="pile">
        <div className="section-titre"><span className="etiquette">Quitter DJIGUI</span></div>
        <p className="appui">
          Vous ne recevrez plus aucun appel au don. Vos dons enregistrés restent
          au centre. Vous pouvez réactiver le compte en vous reconnectant.
        </p>
        <button type="button" className="lien" onClick={() => setDesactivationOuverte(true)}>
          Désactiver mon compte
        </button>
        <hr className="filet" />
        <button type="button" className="lien" onClick={fermerSession}>
          <LogOut size={18} strokeWidth={1.75} />Me déconnecter
        </button>
      </section>

      <Confirmation
        ouverte={desactivationOuverte}
        titre="Désactiver votre compte ?"
        motAction="Désactiver mon compte"
        motRetour="Garder mon compte"
        varianteAction="principal"
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
    </main>
  );
}
