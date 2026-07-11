
import { writeFileSync } from 'fs';
import { ROLE_CATALOG, Team } from '../src/types/roles.types';

let md = '# Catalogo Oficial de Roles - Firewall Protocol\n\n';
md += '> Documento auto-generado basado en el codigo fuente.\n\n';

const teams = [Team.SYSTEM, Team.BLACK_HAT, Team.CHAOTIC];
const teamNames = {
  [Team.SYSTEM]: '??? System (Blue Team)',
  [Team.BLACK_HAT]: '?? Black Hat (Red Team)',
  [Team.CHAOTIC]: '?? Caoticos (Green/Purple Team)'
};

for (const t of teams) {
  md += '## ' + teamNames[t] + '\n\n';
  const roles = Object.values(ROLE_CATALOG).filter(r => r.team === t);
  for (const r of roles) {
    md += '### ' + r.displayName + '\n';
    md += '**Descripcion**: ' + r.description + '\n\n';
    md += '**Guia del Jugador**:\n' + (r.playerGuide || 'Sin guia.') + '\n\n';
    md += '---\n\n';
  }
}

writeFileSync('../../ROLES.md', md);
console.log('ROLES.md generated successfully!');

