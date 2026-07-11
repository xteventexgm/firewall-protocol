export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  secret?: boolean; // If true, description is hidden until unlocked
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_win',
    name: 'Primera Sangre',
    description: 'Gana tu primera partida en cualquier equipo.',
    icon: '🏆',
  },
  {
    id: 'hacker_win',
    name: 'Sombrero Negro',
    description: 'Gana una partida siendo parte de la facción Black Hat.',
    icon: '🥷',
  },
  {
    id: 'system_win',
    name: 'Sistema Seguro',
    description: 'Gana una partida protegiendo el Sistema.',
    icon: '🛡️',
  },
  {
    id: 'flawless_victory',
    name: 'Ejecución Perfecta',
    description: 'Gana una partida sin que tu equipo sufra ninguna baja.',
    icon: '✨',
  },
  {
    id: 'troll_provoke',
    name: 'Troll de las Cavernas',
    description: 'Envía una provocación anónima durante la noche.',
    icon: '🧌',
  },
  {
    id: 'crypto_bribe',
    name: 'Plata o Plomo',
    description: 'Soborna con éxito a un nodo utilizando escudos criptográficos.',
    icon: '💰',
  },
  {
    id: 'survivor',
    name: 'Superviviente',
    description: 'Llega al final de una partida de más de 10 días sin ser eliminado.',
    icon: '❤️‍🩹',
    secret: true,
  },
  {
    id: 'hacked_system',
    name: 'Brecha de Seguridad',
    description: 'Infecta a más de 3 nodos en una sola partida.',
    icon: '🦠',
    secret: true,
  },
  {
    id: 'mastermind',
    name: 'Mente Maestra',
    description: 'Gana la partida sin ser descubierto como el líder de los hackers.',
    icon: '🧠',
  },
  {
    id: 'unstoppable',
    name: 'Imparable',
    description: 'Sobrevive a 3 intentos de infección en una misma partida.',
    icon: '🔥',
  },
  {
    id: 'traitor',
    name: 'Agente Doble',
    description: 'Gana una partida en una facción distinta a la que empezaste.',
    icon: '🕵️',
    secret: true,
  },
  {
    id: 'speedrunner',
    name: 'Speedrunner',
    description: 'Termina una partida en menos de 5 fases.',
    icon: '⏱️',
  },
  {
    id: 'lone_wolf',
    name: 'Lobo Solitario',
    description: 'Sé el único sobreviviente de tu facción y gana la partida.',
    icon: '🐺',
  },
  {
    id: 'observer',
    name: 'El Ojo Que Todo Lo Ve',
    description: 'Usa la habilidad de inteligencia 5 veces en la misma partida.',
    icon: '👁️',
  },
  {
    id: 'martyr',
    name: 'Mártir del Sistema',
    description: 'Sacrificate para salvar a un nodo clave del sistema.',
    icon: '🛡️',
    secret: true,
  },
  {
    id: 'social_engineer',
    name: 'Ingeniero Social',
    description: 'Convence al resto de los nodos de eliminar a un nodo inocente.',
    icon: '🎭',
    secret: true,
  },
  {
    id: 'pacifist',
    name: 'Protocolo Pacifista',
    description: 'Gana la partida sin haber votado por la eliminación de nadie.',
    icon: '🕊️',
    secret: true,
  },
  // --- M16 NUEVOS LOGROS ---
  // Progresión
  {
    id: 'net_veteran',
    name: 'Veterano de Red',
    description: 'Juega 10 partidas en la plataforma.',
    icon: '🎖️',
  },
  {
    id: 'soc_elite',
    name: 'Elite SOC',
    description: 'Juega 50 partidas en la plataforma.',
    icon: '🏅',
  },
  {
    id: 'legend',
    name: 'Leyenda',
    description: 'Juega 100 partidas en la plataforma.',
    icon: '👑',
  },
  // Roles específicos
  {
    id: 'net_surgeon',
    name: 'Cirujano de Red',
    description: 'Cura con éxito la infección de un jugador.',
    icon: '⚕️',
  },
  {
    id: 'death_trap',
    name: 'Trampa mortal',
    description: 'Como Honeypot, arrastra contigo a la tumba a un atacante.',
    icon: '🪤',
  },
  {
    id: 'zero_day_exploit',
    name: '0-Day exploit',
    description: 'Gana la partida en solitario como el Zero-Day.',
    icon: '☢️',
  },
  {
    id: 'ice_penguin',
    name: 'Pingüino de Hielo',
    description: 'Sobrevive a la partida después de haber sido congelado por Deep Freeze.',
    icon: '🐧',
  },
  // Sociales
  {
    id: 'diplomat',
    name: 'Diplomático',
    description: 'Envía más de 20 mensajes de chat en una partida.',
    icon: '🤝',
  },
  {
    id: 'radio_silence',
    name: 'Silencio de Radio',
    description: 'Gana una partida sin enviar ni un solo mensaje al chat global.',
    icon: '🤐',
  },
  // Secretos
  {
    id: 'error_418',
    name: 'Error 418: I\'m a teapot',
    description: 'Intenta realizar acciones imposibles 5 veces.',
    icon: '🫖',
    secret: true,
  },
  {
    id: 'trojan_horse',
    name: 'Caballo de Troya',
    description: 'Gana como Rootkit sin haber sido escaneado nunca como MALICIOSO.',
    icon: '🐴',
    secret: true,
  }
];
