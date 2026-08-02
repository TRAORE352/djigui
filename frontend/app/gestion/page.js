// La gestion s'ouvre sur le tableau de bord : c'est la première chose
// qu'un agent doit voir en arrivant au poste.
import { redirect } from 'next/navigation';
export default function Gestion() { redirect('/gestion/tableau-de-bord'); }
