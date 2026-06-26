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
  /** Slot de asignación original (sin promoción). */
  homeSlotIndex?: number;
  /** Slot efectivo tras failover de brazo. */
  effectiveSlotIndex?: number;
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

/** @deprecated Alias de estrella extendida. */
export function computeLegacyExtendedStarSlotLayout(
  slotCount: number,
  width: number,
  height: number,
): SlotPosition[] {
  return computeExtendedStarSlotLayout(slotCount, width, height);
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

/** Vértice del hexágono (punta plana) más alineado hacia otro punto. */
export function hexVertexToward(
  cx: number,
  cy: number,
  targetX: number,
  targetY: number,
  radius: number,
): { x: number; y: number } {
  const angleToTarget = Math.atan2(targetY - cy, targetX - cx);
  let bestX = cx;
  let bestY = cy;
  let bestDiff = Infinity;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const vx = cx + radius * Math.cos(a);
    const vy = cy + radius * Math.sin(a);
    const va = Math.atan2(vy - cy, vx - cx);
    const diff = Math.abs(Math.atan2(Math.sin(va - angleToTarget), Math.cos(va - angleToTarget)));
    if (diff < bestDiff) {
      bestDiff = diff;
      bestX = vx;
      bestY = vy;
    }
  }
  return { x: bestX, y: bestY };
}

/** Enlace nodo↔nodo: de esquina a esquina del hexágono. */
export function nodeLinkEndpoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fromRadius: number,
  toRadius: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const p1 = hexVertexToward(fromX, fromY, toX, toY, fromRadius);
  const p2 = hexVertexToward(toX, toY, fromX, fromY, toRadius);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

/** Enlace hub circular → vértice del hexágono del nodo. */
export function hubToNodeEndpoints(
  hubX: number,
  hubY: number,
  nodeX: number,
  nodeY: number,
  hubPortRadius: number,
  nodeHexRadius: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const vtx = hexVertexToward(nodeX, nodeY, hubX, hubY, nodeHexRadius);
  const dx = vtx.x - hubX;
  const dy = vtx.y - hubY;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x1: hubX + (dx / len) * hubPortRadius,
    y1: hubY + (dy / len) * hubPortRadius,
    x2: vtx.x,
    y2: vtx.y,
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

function slotDistanceFromHub(
  slot: SlotPosition,
  hubX: number,
  hubY: number,
): number {
  return Math.hypot(slot.x - hubX, slot.y - hubY);
}

/** Cadena de slots de un brazo: primario + hojas, del hub hacia afuera. */
export function getArmSlotChain(
  slots: SlotPosition[],
  arm: number,
  hubX: number,
  hubY: number,
): SlotPosition[] {
  return slots
    .filter(
      (s) => (s.tier === 0 && s.index === arm) || (s.tier === 1 && s.parentIndex === arm),
    )
    .sort((a, b) => slotDistanceFromHub(a, hubX, hubY) - slotDistanceFromHub(b, hubX, hubY));
}

/** True si los 4 primarios (tier 0) tienen ocupante y todos están muertos. */
export function allPrimaryCentralsFallen(
  nodes: NodePosition[],
  slots: SlotPosition[],
): boolean {
  if (!slots.some((s) => s.tier === 1)) return false;

  let armed = 0;
  let fallen = 0;
  for (let arm = 0; arm < 4; arm++) {
    const primary = slots.find((s) => s.tier === 0 && s.index === arm);
    if (!primary) continue;
    const occ = nodes.find((n) => n.slotIndex === primary.index);
    if (!occ) return false;
    armed++;
    if (!occ.player.isAlive) fallen++;
  }
  return armed === 4 && fallen === 4;
}

/**
 * Failover global: solo si los 4 centrales cayeron, cada brazo promueve
 * vivos hacia el hub y deja muertos en la retaguardia.
 * Si solo cae un central, la topología no cambia (el mesh perimetral redirige datos).
 */
export function applyArmFailover(
  nodes: NodePosition[],
  slots: SlotPosition[],
  hubX: number,
  hubY: number,
): NodePosition[] {
  if (!slots.some((s) => s.tier === 1) || !nodes.length) {
    return nodes.map((n) => ({
      ...n,
      homeSlotIndex: n.slotIndex,
      effectiveSlotIndex: n.slotIndex,
    }));
  }

  const result = new Map(
    nodes.map((n) => [
      n.id,
      { ...n, homeSlotIndex: n.slotIndex, effectiveSlotIndex: n.slotIndex },
    ]),
  );

  if (!allPrimaryCentralsFallen(nodes, slots)) {
    return [...result.values()];
  }

  for (let arm = 0; arm < 4; arm++) {
    const armSlots = getArmSlotChain(slots, arm, hubX, hubY);
    if (!armSlots.length) continue;

    const occupants = nodes.filter((n) => armSlots.some((s) => s.index === n.slotIndex));
    if (!occupants.length) continue;

    const primarySlot = armSlots[0];
    const primaryOcc = occupants.find((o) => o.slotIndex === primarySlot.index);
    const needsArmReorder =
      occupants.some((o) => o.player.isAlive) &&
      (!primaryOcc?.player.isAlive || primaryOcc === undefined);

    if (!needsArmReorder) continue;

    const byProximity = [...occupants].sort(
      (a, b) =>
        slotDistanceFromHub(slots[a.slotIndex], hubX, hubY) -
        slotDistanceFromHub(slots[b.slotIndex], hubX, hubY),
    );
    const alive = byProximity.filter((o) => o.player.isAlive);
    const dead = byProximity.filter((o) => !o.player.isAlive);
    const reordered = [...alive, ...dead];

    for (let i = 0; i < reordered.length; i++) {
      const target = armSlots[i];
      if (!target) break;
      const o = reordered[i];
      const n = result.get(o.id)!;
      n.x = target.x;
      n.y = target.y;
      n.angle = target.angle;
      n.effectiveSlotIndex = target.index;
      n.tier = i === 0 ? 0 : 1;
      n.parentSlotIndex = i === 0 ? undefined : armSlots[i - 1].index;
    }
  }

  return [...result.values()];
}
