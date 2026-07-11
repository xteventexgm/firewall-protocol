/** Rutas de assets en mobile (src/assets/sfx/). */
export const SFX_BASE = '/assets/sfx';

export const SOUND_FILES: Record<string, string | string[]> = {
  game_start: `${SFX_BASE}/phase/game-start.mp3`,
  day: `${SFX_BASE}/phase/day-begin.mp3`,
  vote: `${SFX_BASE}/phase/vote-cast.mp3`,
  action: `${SFX_BASE}/combat/action-sent.mp3`,
  action_accepted: `${SFX_BASE}/ui/button-confirm.mp3`,
  kill: `${SFX_BASE}/combat/node-down.mp3`,
  incident: `${SFX_BASE}/combat/incident-kill.mp3`,
  chat: `${SFX_BASE}/social/chat-message.mp3`,
  game_over_system: `${SFX_BASE}/victory/win-system.mp3`,
  game_over_hacker: `${SFX_BASE}/victory/win-hacker.mp3`,
  game_over_solo: `${SFX_BASE}/victory/win-solo.mp3`,
  role_reveal: `${SFX_BASE}/phase/game-start.mp3`,
  death: `${SFX_BASE}/combat/node-down.mp3`,
  skill_success: `${SFX_BASE}/ui/button-confirm.mp3`,
  skill_fail: `${SFX_BASE}/ui/toast-warning.mp3`,
  defeat: `${SFX_BASE}/victory/defeat.mp3`,
  ui_click: `${SFX_BASE}/ui/ui-click.mp3`,
  ui_confirm: `${SFX_BASE}/ui/ui-confirm.mp3`,
  scan_safe: `${SFX_BASE}/phase/scan-safe.mp3`,
  scan_malicious: `${SFX_BASE}/phase/scan-malicious.mp3`,
  vote_tie: `${SFX_BASE}/combat/vote-tie.mp3`,
  timer_warning: `${SFX_BASE}/ui/timer-warning.mp3`,
};

