// DJIGUI — état écrit.
// Toujours l'icône ET le mot : un écran mal réglé, une impression en
// noir et blanc ou un daltonisme ne doivent jamais faire perdre le sens.
import {
  CircleCheck, CircleAlert, TriangleAlert, Clock, CircleMinus, Info
} from 'lucide-react';

const FIGURES = {
  seve:   { Icone: CircleCheck,   classe: 'etat-seve' },
  ocre:   { Icone: Clock,         classe: 'etat-ocre' },
  sang:   { Icone: TriangleAlert, classe: 'etat-sang' },
  alerte: { Icone: CircleAlert,   classe: 'etat-sang' },
  neutre: { Icone: CircleMinus,   classe: 'etat-neutre' },
  info:   { Icone: Info,          classe: 'etat-neutre' }
};

export default function Etat({ ton = 'neutre', children, taille = 20 }) {
  const { Icone, classe } = FIGURES[ton] || FIGURES.neutre;
  return (
    <span className={`etat ${classe}`}>
      <Icone size={taille} strokeWidth={1.75} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
