'use client';
// =====================================================================
//  DJIGUI — champ « zone d'habitation ».
//  Le donneur écrit, la plateforme propose. Le texte libre n'est jamais
//  enregistré : seul l'identifiant de la zone choisie part au service.
//  C'est ce qui permet au centre de cibler « les donneurs O négatif de
//  Tanghin » plus tard (règle RG7).
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Check } from 'lucide-react';
import { listerZones } from '@/lib/api';

function sansAccent(texte) {
  return String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function ChampZone({ valeur, surChoix, enErreur, etiquette = 'Zone d\u2019habitation' }) {
  const [zones, setZones] = useState(null);
  const [saisie, setSaisie] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef(null);

  useEffect(() => {
    listerZones()
      .then((resultat) => setZones(resultat.zones))
      .catch(() => setZones([]));
  }, []);

  // Quand la zone vient d'ailleurs (profil déjà enregistré), on remplit.
  useEffect(() => {
    if (!zones || !valeur) return;
    const trouvee = zones.find((zone) => zone.id_zone === Number(valeur));
    if (trouvee) setSaisie(`${trouvee.nom} (${trouvee.ville})`);
  }, [zones, valeur]);

  useEffect(() => {
    function surClicExterieur(evenement) {
      if (conteneur.current && !conteneur.current.contains(evenement.target)) setOuvert(false);
    }
    document.addEventListener('mousedown', surClicExterieur);
    return () => document.removeEventListener('mousedown', surClicExterieur);
  }, []);

  const propositions = useMemo(() => {
    if (!zones || saisie.trim().length < 1) return [];
    const cherche = sansAccent(saisie);
    return zones
      .filter((zone) => sansAccent(zone.nom).includes(cherche) || sansAccent(zone.ville).includes(cherche))
      .slice(0, 6);
  }, [zones, saisie]);

  function choisir(zone) {
    setSaisie(`${zone.nom} (${zone.ville})`);
    setOuvert(false);
    surChoix(zone.id_zone);
  }

  return (
    <div className={enErreur ? 'champ champ-erreur' : 'champ'} ref={conteneur}
         style={{ position: 'relative' }}>
      <label className="champ-etiquette" htmlFor="champ-zone">{etiquette}</label>
      <div className="rang" style={{ gap: 'var(--e2)' }}>
        <input
          id="champ-zone"
          className="champ-saisie"
          value={saisie}
          autoComplete="off"
          placeholder={zones === null ? 'Chargement des zones…' : 'Écrivez votre quartier'}
          onChange={(evenement) => {
            setSaisie(evenement.target.value);
            setOuvert(true);
            surChoix(null);   // toute modification annule le choix
          }}
          onFocus={() => setOuvert(true)}
        />
        {valeur && <Check size={20} strokeWidth={2} color="var(--seve)" aria-label="Zone choisie" />}
      </div>

      {zones !== null && zones.length === 0 && (
        <span className="champ-aide">
          Aucune zone n&rsquo;est encore enregistrée. Le centre doit les créer avant les inscriptions.
        </span>
      )}
      {zones !== null && zones.length > 0 && !valeur && (
        <span className="champ-aide">Écrivez le début du nom, puis choisissez dans la liste.</span>
      )}

      <AnimatePresence>
        {ouvert && propositions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              listStyle: 'none', margin: 0, padding: 0,
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
              background: 'var(--surface)', border: '1px solid var(--trait-fort)'
            }}
          >
            {propositions.map((zone) => (
              <li key={zone.id_zone}>
                <button
                  type="button"
                  onClick={() => choisir(zone)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--e3)',
                    width: '100%', minHeight: 48, padding: '0 var(--e4)',
                    background: 'none', border: 'none',
                    borderBottom: '1px solid var(--trait)',
                    font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer'
                  }}
                >
                  <MapPin size={18} strokeWidth={1.6} aria-hidden="true" />
                  <span>{zone.nom} <span className="petit">({zone.ville})</span></span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {ouvert && saisie.trim().length > 0 && propositions.length === 0 && zones && zones.length > 0 && (
        <span className="champ-aide">Aucune zone ne porte ce nom. Vérifiez l&rsquo;orthographe.</span>
      )}
    </div>
  );
}
