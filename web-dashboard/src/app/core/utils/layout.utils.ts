import { PublicPlayer } from '../models/game-state.model';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  player: PublicPlayer;
  angle: number;
  tier: number;
  slotIndex: number;
  parentSlotIndex?: number;
}

export interface SlotPosition {
  index: number;
  x: number;
  y: number;
  angle: number;
  tier: number;
  parentIndex?: number;
}

/** Radios cardinales: N, E, S, O (como diagrama estrella extendida). */
const CARDINAL_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI] as const;
/** 4–6 jugadores: estrella clásica; 7+ estrella extendida. */
const CLASSIC_STAR_MAX = 6;
/** Apertura del abanico de 3 hojas por rama (rad). */
const FAN_SPREAD = 0.82;
const NODE_MARGIN = 46;

/** Escala radial base (fracción del viewport). */
const CLASSIC_RING = 0.46;
const PRIMARY_RING = 0.44;
const BRANCH_DIST = 0.4;
/** No comprimir por debajo del viewport: siempre escala para que quepan todos los nodos. */
const SAFE_TOP = 68;
const SAFE_BOTTOM = 72;
const SAFE_LEFT = 40;
const SAFE_RIGHT = 40;


/** Anillo único: N nodos repartidos a ángulos iguales (topología estrella clásica). */
function computeClassicStarSlotLayout(
  slotCount: number,
  width: number,
  height: number,
): SlotPosition[] {
  const availW = Math.max(120, width - SAFE_LEFT - SAFE_RIGHT);
  const availH = Math.max(120, height - SAFE_TOP - SAFE_BOTTOM);
  const { cx, cy } = layoutCenter(width, height);
  const base = Math.min(availW, availH);
  const radius = base * CLASSIC_RING;
  const raw: SlotPosition[] = [];

  for (let i = 0; i < slotCount; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / slotCount;
    raw.push({
      index: i,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle,
      tier: 0,
    });
  }

  return fitSlotsToViewport(raw, width, height, cx, cy);
}

/** Total simétrico 8/12/16… para calcular coords antes de recortar slots. */
function extendedSymmetricTotal(slotCount: number): number {
  if (slotCount <= 4) return 4;
  const leavesPerArm = Math.ceil((slotCount - 4) / 4);
  return 4 + leavesPerArm * 4;
}

/** Selecciona N slots: 4 primarios + hojas en orden de brazo (mismas coords que layout simétrico). */
function selectExtendedSlots(full: SlotPosition[], targetCount: number): SlotPosition[] {
  if (targetCount >= full.length) return full;
  const primaries = full.filter((s) => s.tier === 0);
  const leaves = full.filter((s) => s.tier === 1);
  const picked = [...primaries];
  for (const leaf of leaves) {
    if (picked.length >= targetCount) break;
    picked.push(leaf);
  }
  return picked.map((s, i) => ({ ...s, index: i }));
}

/** Ángulos del abanico: centro + laterales, no colineales. */
function fanLeafAngles(parentAngle: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [parentAngle];
  if (count === 2) {
    const half = FAN_SPREAD * 0.7;
    return [parentAngle - half, parentAngle + half];
  }
  return [parentAngle - FAN_SPREAD, parentAngle, parentAngle + FAN_SPREAD];
}

/** Centro útil del canvas (respeta HUD y márgenes laterales). */
export function layoutCenter(width: number, height: number): { cx: number; cy: number } {
  const availW = Math.max(120, width - SAFE_LEFT - SAFE_RIGHT);
  const availH = Math.max(120, height - SAFE_TOP - SAFE_BOTTOM);
  return {
    cx: SAFE_LEFT + availW / 2,
    cy: SAFE_TOP + availH / 2,
  };
}

function fitSlotsToViewport(
  slots: SlotPosition[],
  width: number,
  height: number,
  _cx: number,
  _cy: number,
): SlotPosition[] {
  if (!slots.length) return slots;

  const { cx, cy } = layoutCenter(width, height);
  const availW = Math.max(120, width - SAFE_LEFT - SAFE_RIGHT);
  const availH = Math.max(120, height - SAFE_TOP - SAFE_BOTTOM);

  let minX = cx - 64;
  let maxX = cx + 64;
  let minY = cy - 64;
  let maxY = cy + 64;

  for (const s of slots) {
    minX = Math.min(minX, s.x - NODE_MARGIN);
    maxX = Math.max(maxX, s.x + NODE_MARGIN);
    minY = Math.min(minY, s.y - NODE_MARGIN - 8);
    maxY = Math.max(maxY, s.y + NODE_MARGIN + 22);
  }

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  const scale = Math.min(1, availW / boxW, availH / boxH);

  // Escala desde el hub: evita acercar un brazo cuando el reparto de hojas es asimétrico (p. ej. 7 jugadores).
  return slots.map((s) => ({
    ...s,
    x: cx + (s.x - cx) * scale,
    y: cy + (s.y - cy) * scale,
  }));
}

/**
 * Topología de red:
 * - 4–6 jugadores: estrella clásica (un anillo, ángulos iguales).
 * - 7+ jugadores: estrella extendida (4 cardinales + hojas en abanico).
 */
export function computeExtendedStarSlotLayout(
  slotCount: number,
  width: number,
  height: number,
): SlotPosition[] {
  if (slotCount <= 0) return [];

  if (slotCount <= CLASSIC_STAR_MAX) {
    return computeClassicStarSlotLayout(slotCount, width, height);
  }

  const symCount = extendedSymmetricTotal(slotCount);
  const full = buildExtendedStarRaw(symCount, width, height);
  const selected = selectExtendedSlots(full, slotCount);
  const { cx, cy } = layoutCenter(width, height);
  return fitSlotsToViewport(selected, width, height, cx, cy);
}

function buildExtendedStarRaw(
  slotCount: number,
  width: number,
  height: number,
): SlotPosition[] {
  const availW = Math.max(120, width - SAFE_LEFT - SAFE_RIGHT);
  const availH = Math.max(120, height - SAFE_TOP - SAFE_BOTTOM);
  const { cx, cy } = layoutCenter(width, height);
  const base = Math.min(availW, availH);
  const raw: SlotPosition[] = [];

  const primaryR = base * PRIMARY_RING;
  const branchDist = base * BRANCH_DIST;

  for (let arm = 0; arm < 4; arm++) {
    const angle = CARDINAL_ANGLES[arm];
    raw.push({
      index: arm,
      x: cx + primaryR * Math.cos(angle),
      y: cy + primaryR * Math.sin(angle),
      angle,
      tier: 0,
    });
  }

  const secondaryTotal = slotCount - 4;
  const leavesPerArm = secondaryTotal / 4;
  let slotIdx = 4;

  for (let arm = 0; arm < 4; arm++) {
    const leafCount = leavesPerArm;
    if (leafCount <= 0) continue;

    const parent = raw[arm];
    const leafAngles = fanLeafAngles(parent.angle, leafCount);

    for (let j = 0; j < leafCount; j++) {
      const angle = leafAngles[j];
      raw.push({
        index: slotIdx,
        x: parent.x + branchDist * Math.cos(angle),
        y: parent.y + branchDist * Math.sin(angle),
        angle,
        tier: 1,
        parentIndex: arm,
      });
      slotIdx++;
    }
  }

  return raw;
}

/** @deprecated Alias de estrella extendida. */
export function computeSlotLayout(
  slotCount: number,
  width: number,
  height: number,
  _padding = 80,
): SlotPosition[] {
  return computeExtendedStarSlotLayout(slotCount, width, height);
}

export function computeExtendedStarLayoutFromSlots(
  assignments: Array<{ player: PublicPlayer; slotIndex: number }>,
  slots: SlotPosition[],
): NodePosition[] {
  if (!assignments.length || !slots.length) return [];

  return assignments.map(({ player, slotIndex }) => {
    const slot = slots[Math.min(slotIndex, slots.length - 1)];
    return {
      id: player.id,
      x: slot.x,
      y: slot.y,
      player,
      angle: slot.angle,
      tier: slot.tier,
      slotIndex: slot.index,
      parentSlotIndex: slot.parentIndex,
    };
  });
}

/** @deprecated Usar computeExtendedStarLayoutFromSlots */
export function computeSpiderLayoutFromSlots(
  assignments: Array<{ player: PublicPlayer; slotIndex: number }>,
  slotCount: number,
  width: number,
  height: number,
  _padding = 80,
): NodePosition[] {
  const slots = computeExtendedStarSlotLayout(slotCount, width, height);
  return computeExtendedStarLayoutFromSlots(assignments, slots);
}

/** Posiciones para votos: usa el mapa de slots completo si se pasa maxPlayers. */
export function computeSpiderLayout(
  players: PublicPlayer[],
  width: number,
  height: number,
  maxSlots?: number,
): NodePosition[] {
  if (!players.length) return [];

  const count = maxSlots ?? players.length;
  const slots = computeExtendedStarSlotLayout(count, width, height);
  return computeExtendedStarLayoutFromSlots(
    players.map((player, i) => ({ player, slotIndex: i })),
    slots,
  );
}

/** @deprecated Usar computeExtendedStarLayoutFromSlots */
export function computeCircularLayout(
  players: PublicPlayer[],
  width: number,
  height: number,
  maxSlots?: number,
): NodePosition[] {
  return computeSpiderLayout(players, width, height, maxSlots);
}

export function hubPoint(width: number, height: number): { x: number; y: number } {
  const { cx, cy } = layoutCenter(width, height);
  return { x: cx, y: cy };
}

export function edgePointToward(
  node: NodePosition,
  targetX: number,
  targetY: number,
  nodeRadius = 44,
): { x: number; y: number } {
  const dx = targetX - node.x;
  const dy = targetY - node.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: node.x + (dx / len) * nodeRadius,
    y: node.y + (dy / len) * nodeRadius,
  };
}

export function linkEndpoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  insetFrom = 52,
  insetTo = 36,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: fromX + ux * insetFrom,
    y1: fromY + uy * insetFrom,
    x2: toX - ux * insetTo,
    y2: toY - uy * insetTo,
  };
}

export function outerOrbitRadius(
  slots: SlotPosition[],
  hubX: number,
  hubY: number,
  extra = 24,
): number {
  if (!slots.length) return 120;
  return Math.max(...slots.map((s) => Math.hypot(s.x - hubX, s.y - hubY))) + extra;
}
