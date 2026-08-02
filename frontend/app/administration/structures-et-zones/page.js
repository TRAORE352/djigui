'use client';
// =====================================================================
//  E29 · Structures et zones.
//  Les deux référentiels dont dépend tout le reste du produit : les
//  structures auxquelles les comptes sont rattachés, et les zones qui
//  servent au ciblage des appels au don.
//
//  C'est cet écran qui remplace tout fichier de remplissage
//  automatique : la base démarre vide, l'administrateur la garnit ici.
//  Sans zone, aucun donneur ne peut s'inscrire.
// =====================================================================
import { useEffect, useState } from 'react';
import { Plus, MapPin, Building2, X } from 'lucide-react';
import {
  listerReferentiels, creerStructure, supprimerStructure, creerZone, supprimerZone
} from '@/lib/api';
import Bouton from '../../composants/Bouton';
import { MessageErreur, MessageReussite } from '../../composants/Message';
import { LignesEnAttente } from '../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../composants/AideEcran';
import { numeroLisible } from '@/lib/format';

const TYPES = [
  { code: 'crts', mot: 'Centre régional de transfusion sanguine' },
  { code: 'depot', mot: 'Dépôt de sang' },
  { code: 'banque_hopital', mot: 'Banque de sang hospitalière' }
];

export default function StructuresEtZones() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const [reussite, setReussite] = useState('');
  const [enCours, setEnCours] = useState(false);

  const [formStructure, setFormStructure] = useState(null);
  const [formZone, setFormZone] = useState(null);
  const [aRetirer, setARetirer] = useState('');
  const [aideOuverte, alternerAide] = useAide('structures-et-zones');

  async function recharger() {
    setDonnees(await listerReferentiels());
  }
  useEffect(() => { recharger().catch((probleme) => setErreur(probleme.message)); }, []);

  useEffect(() => {
    if (!reussite) return;
    const minuterie = setTimeout(() => setReussite(''), 3000);
    return () => clearTimeout(minuterie);
  }, [reussite]);

  async function agir(action, mot) {
    setErreur(''); setEnCours(true);
    try {
      await action();
      setReussite(mot);
      await recharger();
      return true;
    } catch (probleme) {
      setErreur(probleme.message);
      return false;
    } finally {
      setEnCours(false);
    }
  }

  if (!donnees) {
    return <div className="contenu-registre pile-l"><LignesEnAttente nombre={5} /></div>;
  }

  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Structures et zones</h1>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran gère les deux référentiels dont dépend tout le reste du produit : les
        structures auxquelles les comptes gestionnaires sont rattachés, et les zones utilisées
        à l’inscription des donneurs et pour cibler un appel au don. Une structure ne se retire
        pas si un compte y est rattaché ; une zone ne se retire pas si un donneur y habite.
        Commencez toujours par créer au moins une structure et quelques zones.
      </PanneauAide>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      {/* ------------------------- Structures ------------------------- */}
      <section className="pile">
        <div className="rang-espace section-titre">
          <h2 className="lead rang">
            <Building2 size={20} strokeWidth={1.75} aria-hidden="true" />Structures
          </h2>
          {!formStructure && (
            <Bouton variante="discret" compact enfantIcone={Plus}
                    onClick={() => setFormStructure({
                      nom: '', type: 'crts', ville: '', adresse: '', telephone: '', horaires: ''
                    })}>
              Ajouter une structure
            </Bouton>
          )}
        </div>

        <p className="appui">
          Une structure est un centre de transfusion, un dépôt de sang ou une banque
          hospitalière. Chaque agent est rattaché à une seule structure et n’y voit que son
          propre stock. Créez-en une avant de créer des comptes gestionnaires. Sa création crée
          aussi ses huit seuils de stock, que l’agent réglera ensuite selon les besoins du
          centre.
        </p>

        {formStructure && (
          <div className="carte pile">
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--e5)' }}>
              <label className="champ champ-encadre">
                <span className="champ-etiquette">Nom</span>
                <input className="champ-saisie" autoFocus value={formStructure.nom}
                       placeholder="Centre régional de transfusion sanguine de Ouagadougou"
                       onChange={(e) => setFormStructure({ ...formStructure, nom: e.target.value })} />
              </label>
              <label className="champ champ-encadre">
                <span className="champ-etiquette">Ville</span>
                <input className="champ-saisie" value={formStructure.ville}
                       onChange={(e) => setFormStructure({ ...formStructure, ville: e.target.value })} />
              </label>
            </div>

            <div className="champ">
              <span className="champ-etiquette">Type</span>
              <div className="rang" style={{ gap: 'var(--e3)', flexWrap: 'wrap', marginTop: 'var(--e2)' }}>
                {TYPES.map(({ code, mot }) => (
                  <button key={code} type="button" className="touche"
                          aria-pressed={formStructure.type === code}
                          onClick={() => setFormStructure({ ...formStructure, type: code })}>
                    {mot}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--e5)' }}>
              <label className="champ champ-encadre">
                <span className="champ-etiquette">Adresse</span>
                <input className="champ-saisie" value={formStructure.adresse}
                       placeholder="Avenue Kunda Yonré, secteur 4"
                       onChange={(e) => setFormStructure({ ...formStructure, adresse: e.target.value })} />
              </label>
              <label className="champ champ-encadre">
                <span className="champ-etiquette">Téléphone</span>
                <input className="champ-saisie mono" value={formStructure.telephone}
                       onChange={(e) => setFormStructure({ ...formStructure, telephone: e.target.value })} />
              </label>
              <label className="champ champ-encadre">
                <span className="champ-etiquette">Horaires</span>
                <input className="champ-saisie" value={formStructure.horaires}
                       placeholder="7h30 à 16h00"
                       onChange={(e) => setFormStructure({ ...formStructure, horaires: e.target.value })} />
              </label>
            </div>

            <p className="petit">
              Les huit seuils de stock de cette structure sont créés en même temps
              qu&rsquo;elle. Un agent les règlera ensuite selon les besoins du centre.
            </p>

            <div className="rang" style={{ gap: 'var(--e3)' }}>
              <Bouton variante="encre" enCours={enCours}
                      onClick={async () => {
                        const fait = await agir(
                          () => creerStructure(formStructure),
                          `${formStructure.nom} est enregistrée.`);
                        if (fait) setFormStructure(null);
                      }}>
                Créer la structure
              </Bouton>
              <button type="button" className="lien" onClick={() => setFormStructure(null)}>
                Revenir à la liste
              </button>
            </div>
          </div>
        )}

        {donnees.structures.length === 0 ? (
          <div className="etat-vide pile-s">
            <p className="lead">Aucune structure n&rsquo;est encore enregistrée.</p>
            <p className="appui">
              Une structure est un centre, un dépôt ou une banque de sang. Chaque
              compte gestionnaire est rattaché à l&rsquo;une d&rsquo;elles, et n&rsquo;y voit
              que son propre stock.
            </p>
          </div>
        ) : (
          <div className="registre-defilant">
            <table className="registre">
              <thead>
                <tr>
                  <th>Nom</th><th>Type</th><th>Ville</th><th>Téléphone</th>
                  <th className="nombre">Comptes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {donnees.structures.map((structure) => (
                  <tr key={structure.id_structure}>
                    <td style={{ fontWeight: 600 }}>{structure.nom}</td>
                    <td className="appui">{structure.type_lisible}</td>
                    <td>{structure.ville}</td>
                    <td className="mono">{numeroLisible(structure.telephone) || '\u2014'}</td>
                    <td className="nombre">{structure.nb_comptes}</td>
                    <td className="actions">
                      {aRetirer === `s${structure.id_structure}` ? (
                        <button type="button" className="lien lien-sang"
                                onClick={() => agir(
                                  () => supprimerStructure(structure.id_structure),
                                  'Structure retirée.')}>
                          Confirmer le retrait
                        </button>
                      ) : (
                        <button type="button" className="lien"
                                style={{ fontSize: 'var(--t-appui)' }}
                                onClick={() => setARetirer(`s${structure.id_structure}`)}>
                          <X size={15} strokeWidth={1.75} />Retirer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="petit">
          Une structure ne peut pas être retirée si un compte y est rattaché.
        </p>
      </section>

      {/* ---------------------------- Zones --------------------------- */}
      <section className="pile">
        <div className="rang-espace section-titre">
          <h2 className="lead rang">
            <MapPin size={20} strokeWidth={1.75} aria-hidden="true" />Zones
          </h2>
          {!formZone && (
            <Bouton variante="discret" compact enfantIcone={Plus}
                    onClick={() => setFormZone({ nom: '', ville: '' })}>
              Ajouter une zone
            </Bouton>
          )}
        </div>

        <p className="appui">
          Une zone est un quartier. Elle sert à deux choses : le donneur la choisit à
          l’inscription, et l’agent l’utilise pour cibler un appel au don sur un secteur de la
          ville. Sans zone, personne ne peut s’inscrire. Commencez par les quartiers d’où
          viennent le plus de donneurs : la liste peut être complétée à tout moment.
        </p>

        {formZone && (
          <div className="carte pile">
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 'var(--e5)', alignItems: 'end' }}>
              <label className="champ champ-encadre">
                <span className="champ-etiquette">Nom de la zone</span>
                <input className="champ-saisie" autoFocus value={formZone.nom}
                       placeholder="Gounghin"
                       onChange={(e) => setFormZone({ ...formZone, nom: e.target.value })} />
              </label>
              <label className="champ champ-encadre">
                <span className="champ-etiquette">Ville</span>
                <input className="champ-saisie" value={formZone.ville}
                       placeholder="Ouagadougou"
                       onChange={(e) => setFormZone({ ...formZone, ville: e.target.value })} />
              </label>
              <Bouton variante="encre" enCours={enCours}
                      onClick={async () => {
                        const fait = await agir(
                          () => creerZone(formZone), `${formZone.nom} est enregistrée.`);
                        if (fait) setFormZone({ nom: '', ville: formZone.ville });
                      }}>
                Ajouter
              </Bouton>
            </div>
            <div className="rang" style={{ gap: 'var(--e3)' }}>
              <button type="button" className="lien" onClick={() => setFormZone(null)}>
                Terminer l&rsquo;ajout de zones
              </button>
              <span className="petit">
                La ville reste remplie : vous pouvez enchaîner les quartiers.
              </span>
            </div>
          </div>
        )}

        {donnees.zones.length === 0 ? (
          <div className="etat-vide pile-s">
            <p className="lead">Aucune zone n&rsquo;est encore enregistrée.</p>
            <p className="appui">
              Tant qu&rsquo;il n&rsquo;y a aucune zone, personne ne peut s&rsquo;inscrire
              comme donneur : la zone est demandée à l&rsquo;inscription, et c&rsquo;est
              elle qui permet ensuite de cibler un appel au don sur un quartier.
            </p>
            <p className="appui">
              Commencez par les quartiers où le centre reçoit le plus de donneurs.
            </p>
          </div>
        ) : (
          <div className="registre-defilant">
            <table className="registre">
              <thead>
                <tr>
                  <th>Nom</th><th>Ville</th>
                  <th className="nombre">Donneurs</th><th></th>
                </tr>
              </thead>
              <tbody>
                {donnees.zones.map((zone) => (
                  <tr key={zone.id_zone}>
                    <td style={{ fontWeight: 600 }}>{zone.nom}</td>
                    <td>{zone.ville}</td>
                    <td className="nombre">{zone.nb_donneurs}</td>
                    <td className="actions">
                      {zone.nb_donneurs === 0 && (
                        aRetirer === `z${zone.id_zone}` ? (
                          <button type="button" className="lien lien-sang"
                                  onClick={() => agir(
                                    () => supprimerZone(zone.id_zone), 'Zone retirée.')}>
                            Confirmer le retrait
                          </button>
                        ) : (
                          <button type="button" className="lien"
                                  style={{ fontSize: 'var(--t-appui)' }}
                                  onClick={() => setARetirer(`z${zone.id_zone}`)}>
                            <X size={15} strokeWidth={1.75} />Retirer
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="petit">
          Les zones servent au ciblage des appels au don. Une zone habitée ne peut
          pas être retirée. L&rsquo;administrateur ne lance jamais d&rsquo;appel au don :
          il prépare seulement le découpage.
        </p>
      </section>
    </div>
  );
}
