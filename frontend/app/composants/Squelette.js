// DJIGUI — squelette de chargement.
// Il montre la forme de ce qui arrive et nomme la cause du délai
// (maquette donneur, page 8, série 4).
export function Barre({ largeur = '100%', hauteur = 14 }) {
  return <span className="squelette" style={{ display: 'block', width: largeur, height: hauteur }} />;
}

export function CarteEnAttente({ mot = 'Le réseau est lent en ce moment.' }) {
  return (
    <div className="carte pile">
      <div className="rang" style={{ gap: 'var(--e4)' }}>
        <span className="squelette" style={{ width: 120, height: 120, flexShrink: 0 }} />
        <div className="pile-s" style={{ flex: 1 }}>
          <Barre largeur="80%" hauteur={18} />
          <Barre largeur="60%" hauteur={18} />
          <Barre largeur="45%" hauteur={12} />
        </div>
      </div>
      <hr className="filet" />
      <Barre largeur="70%" hauteur={16} />
      <Barre largeur="100%" />
      <Barre largeur="90%" />
      <span className="petit">{mot}</span>
    </div>
  );
}

export function LignesEnAttente({ nombre = 4 }) {
  return (
    <div className="pile">
      {Array.from({ length: nombre }).map((rien, indice) => (
        <div key={indice} className="rang" style={{ gap: 'var(--e4)' }}>
          <span className="squelette" style={{ width: 40, height: 40, flexShrink: 0 }} />
          <div className="pile-s" style={{ flex: 1 }}>
            <Barre largeur="55%" />
            <Barre largeur="35%" hauteur={11} />
          </div>
        </div>
      ))}
    </div>
  );
}
