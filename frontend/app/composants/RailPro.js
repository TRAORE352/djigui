'use client';
// DJIGUI — rail des espaces professionnels (gestion et administration).
// Libellés en toutes lettres, groupés par domaine, avec une icône par
// entrée. Le pied du rail nomme la personne connectée et sa structure :
// sur un poste partagé, on doit savoir sous quel nom on travaille.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { deconnexion, effacerJeton } from '@/lib/api';

export default function RailPro({ titre, groupes, compte, avertissement, piedExtra, gele = false }) {
  const chemin = usePathname();
  const routeur = useRouter();

  async function fermerSession() {
    try { await deconnexion(); } catch { /* la session locale s'efface quand même */ }
    effacerJeton();
    routeur.replace('/gestion/connexion');
  }

  return (
    <nav className="rail" aria-label="Navigation">
      <div className="rail-entete pile-s">
        <span className="mot-ecrit petit">DJIGUI</span>
        <span className="petit">{titre}</span>
      </div>

      {groupes.map((groupe) => (
        <div className="rail-groupe" key={groupe.nom}>
          <span className="etiquette">{groupe.nom}</span>
          {groupe.entrees.map(({ adresse, mot, Icone }) => {
            const actif = chemin === adresse || chemin.startsWith(`${adresse}/`);
            return (
              <Link key={adresse} href={gele ? '#' : adresse}
                    className={`${actif ? 'actif' : ''} ${gele ? 'desactive' : ''}`}
                    aria-current={actif ? 'page' : undefined}
                    aria-disabled={gele || undefined}>
                <Icone size={18} strokeWidth={actif ? 2 : 1.6} aria-hidden="true" />
                <span>{mot}</span>
              </Link>
            );
          })}
        </div>
      ))}

      <div className="rail-pied pile-s">
        {piedExtra}
        {avertissement && <span className="etat etat-ocre" style={{ fontSize: 'var(--t-petit)' }}>{avertissement}</span>}
        {compte && (
          <>
            <span style={{ fontSize: 'var(--t-appui)', fontWeight: 600 }}>
              {compte.prenom} {compte.nom}
            </span>
            <span className="petit">{compte.fonction || compte.role}</span>
          </>
        )}
        <button type="button" className="lien" onClick={fermerSession}>
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
          Se déconnecter
        </button>
      </div>
    </nav>
  );
}
