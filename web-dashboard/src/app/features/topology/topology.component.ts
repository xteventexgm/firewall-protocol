import { NgClass } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
  inject,
} from '@angular/core';

import { GamePhase, PublicGameState, PublicPlayer } from '../../core/models/game-state.model';
import { countSkipVotes, roleTeamHint } from '../../core/utils/game.utils';
import { environment } from '../../../environments/environment';
import {
  allPrimaryCentralsFallen,
  applyArmFailover,
  computeExtendedStarLayoutFromSlots,
  computeExtendedStarSlotLayout,
  getArmSlotChain,
  hubPoint,
  linkEndpoints,
  NodePosition,
  outerOrbitRadius,
  SlotPosition,
} from '../../core/utils/layout.utils';

interface HubLink {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  visible: boolean;
  active: boolean;
  pulsing: boolean;
  isBranch: boolean;
  handshakeSec: string;
}

interface HubPort {
  id: string;
  px: number;
  py: number;
  active: boolean;
  pulsing: boolean;
}

interface LeavingNode extends NodePosition {
  leavingAt: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

interface BootSpoke {
  id: string;
  slotIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  branch: boolean;
  delay: number;
}

interface MeshSegment {
  id: string;
  slotA: number;
  slotB: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

@Component({
  selector: 'app-topology',
  standalone: true,
  imports: [NgClass],
  templateUrl: './topology.component.html',
  styleUrl: './topology.component.scss',
})
export class TopologyComponent implements OnChanges, AfterViewInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  @Input() state: PublicGameState | null = null;
  @Input() phase: GamePhase = 'LOBBY';
  @Input() glitchPlayerIds: string[] = [];
  @Input() skipVotes = 0;
  @Input() kickEnabled = false;

  @Output() kickPlayer = new EventEmitter<PublicPlayer>();

  kickMenu: { player: PublicPlayer; x: number; y: number } | null = null;
  avatarErrors = new Set<string>();

  // Devuelve la URL pública del avatar basándose en el ID del jugador
  getAvatarUrl(player: PublicPlayer): string {

    const base = environment.apiUrl.replace(/\/$/, '');
    if (player.avatarUrl) {
      // El backend manda /api/auth/avatars/ por compatibilidad con la app móvil.
      // El dashboard debe usar /api/media/avatars/ para acceder directamente.
      let url = player.avatarUrl;
      if (url.startsWith('/api/auth/avatars/')) {
        url = url.replace('/api/auth/avatars/', '/api/media/avatars/');
      }
      const finalUrl = url.startsWith('http') ? url : `${base}${url}`;
      return finalUrl;
    }
    const url = `${base}/api/media/avatars/${player.id}`;
    return url;
  }

  handleAvatarError(playerId: string, event?: Event): void {
    console.error(`[Avatar] Failed to load avatar for player ${playerId}. Event:`, event);
    this.avatarErrors.add(playerId);
  }

  resolveAvatarUrl(url?: string): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const base = environment.apiUrl.replace(/\/$/, '');
    return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
  }

  get currentUrl(): string {
    return window.location.pathname;
  }

  // Dimensiones del canvas SVG

  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<HTMLElement>;
  @ViewChild('particlesCanvas') particlesCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('linkPacketsCanvas') linkPacketsCanvas?: ElementRef<HTMLCanvasElement>;

  nodes: NodePosition[] = [];
  leavingNodes: LeavingNode[] = [];
  hubLinks: HubLink[] = [];
  hubPorts: HubPort[] = [];
  hub = { x: 400, y: 300 };
  width = 800;
  height = 600;
  readonly Math = Math;

  cableExtendingIds = new Set<string>();
  spawningIds = new Set<string>();
  connectedBlinkIds = new Set<string>();
  linkPulseIds = new Set<string>();
  ghostSlots: SlotPosition[] = [];
  starSlots: SlotPosition[] = [];
  returningGhostSlots = new Set<number>();
  spokeGuides: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  ringMeshLinks: HubLink[] = [];

  avatarBlobUrls = new Map<string, string>();

  slotGuides: BootSpoke[] = [];
  phaseTransition = false;
  networkBooting = false;
  networkBootReady = true;
  networkBootFlash = false;
  networkBootFading = false;
  bootStatusText = '';
  bootSlotLit = new Set<number>();
  bootGuideLit = new Set<string>();

  /** Debe coincidir con animación `node-leave` en SCSS (~1.1s). */
  private static readonly LINK_HANDSHAKE_MS = 1200;
  /** Trazado wireframe del hexágono desde la punta del cable. */
  private static readonly SPAWN_BUILD_MS = 1200;
  /** Parpadeos de confirmación al terminar la construcción. */
  private static readonly CONNECT_BLINK_MS = 780;
  private static readonly FAILOVER_PROMOTE_MS = 950;
  private static readonly NETWORK_BOOT_MS = 8300;
  private static readonly NETWORK_BOOT_FADE_MS = 2400;
  private static readonly LEAVE_MS = 1100;

  private viewReady = false;
  private particleFrame?: number;
  private packetFrame?: number;
  private particles: Particle[] = [];
  private prevPlayerIds = new Set<string>();
  private prevAliveIds = new Set<string>();
  private banAnimationIds = new Set<string>();
  private spawnTimers: ReturnType<typeof setTimeout>[] = [];
  private layoutReady = false;
  private playerSlotIndex = new Map<string, number>();
  private linkHandshakeMsById = new Map<string, number>();
  private pulseStartedAt = new Map<string, number>();
  private flowPhaseByLink = new Map<string, { out: number; in: number }>();
  private lastPacketTickMs: number | null = null;
  private particlePhase: GamePhase = 'LOBBY';
  private bootRoomKey: string | null = null;
  private currentRoomId: string | null = null;
  private meshLinksInitialized = false;
  private prevMeshLinkActive = new Set<string>();
  private prevConnectedIds = new Set<string>();
  private prevArmAnchor = new Map<number, string | null>();
  private failoverDisplay = new Map<string, { x: number; y: number }>();
  private failoverPromotingIds = new Set<string>();

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.particlePhase = this.phase;
    this.updateLayout(true);
    this.syncFromState();
    this.initParticles();
    this.animateParticles();
    this.resizeLinkPacketsCanvas();
    this.startLinkPacketLoop();
    this.tryStartNetworkBootForCurrentRoom();
    this.cdr.markForCheck();
  }

  /** Sincroniza enlaces y jugadores cuando ya hay estado (p. ej. re-entrada a sala). */
  private syncFromState(): void {
    if (!this.state) return;

    if (this.state.roomId) {
      this.currentRoomId = this.state.roomId;
    }

    this.detectPlayerChanges();
    this.detectAliveChanges();
    this.detectConnectionChanges();
    this.refreshHubLinks();
    this.fetchMissingAvatars();
  }

  private fetchMissingAvatars(): void {
    if (!this.state) return;
    this.state.players.forEach(p => {
      if (p.avatarUrl && !this.avatarBlobUrls.has(p.id)) {
        const url = this.resolveAvatarUrl(p.avatarUrl);
        if (url) {
          // Si es ngrok y no es una imagen externa, usamos fetch para saltar la página de advertencia.
          // Para todo lo demás (Render, local, o URLs externas), usamos la URL directa.
          if (url.includes('ngrok-free.app') || url.includes('ngrok.io') || url.includes('ngrok-free.dev')) {
            this.avatarBlobUrls.set(p.id, '');
            fetch(url, {
              headers: {
                'ngrok-skip-browser-warning': 'true',
                'Bypass-Tunnel-Reminder': 'true'
              }
            }).then(res => {
              if (!res.ok) throw new Error();
              return res.blob();
            }).then(blob => {
              const blobUrl = URL.createObjectURL(blob);
              this.avatarBlobUrls.set(p.id, blobUrl);
              this.cdr.markForCheck();
            }).catch(() => {
              this.avatarBlobUrls.delete(p.id);
            });
          } else {
            // URL normal o de Render, se asigna directo para no romper CORS en imágenes externas
            this.avatarBlobUrls.set(p.id, url);
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.particleFrame) cancelAnimationFrame(this.particleFrame);
    if (this.packetFrame) cancelAnimationFrame(this.packetFrame);
    this.spawnTimers.forEach(clearTimeout);
  }

  /** Loop dedicado: RAF + canvas overlay (Angular no repinta SVG fuera de NgZone). */
  private startLinkPacketLoop(): void {
    this.ngZone.runOutsideAngular(() => {
      const tick = (now: number) => {
        this.advanceLinkPacketPhases(now);
        this.drawLinkPacketsToCanvas();
        this.packetFrame = requestAnimationFrame(tick);
      };
      this.packetFrame = requestAnimationFrame(tick);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['glitchPlayerIds'] && this.glitchPlayerIds.length) {
      for (const id of this.glitchPlayerIds) {
        if (!this.banAnimationIds.has(id)) {
          this.scheduleNodeBan(id);
        }
      }
    }

    if (this.viewReady && (changes['state'] || changes['phase'])) {
      if (changes['state']) {
        if (this.state?.roomId && this.state.roomId !== this.currentRoomId) {
          this.currentRoomId = this.state.roomId;
          this.meshLinksInitialized = false;
          this.prevMeshLinkActive.clear();
          this.prevConnectedIds.clear();
          this.layoutReady = false;
          this.prevPlayerIds.clear();
          this.prevAliveIds.clear();
          this.prevArmAnchor.clear();
        }
        const prevPositions = new Map(
          this.nodes.map((n) => [n.id, { x: this.nodeX(n), y: this.nodeY(n) }]),
        );
        const prevAnchors = new Map(this.prevArmAnchor);
        this.updateLayout(false);
        this.detectArmFailoverPromotions(prevPositions, prevAnchors);
        this.syncFromState();
        this.tryStartNetworkBootForCurrentRoom();
      } else {
        this.updateLayout(false);
        this.refreshHubLinks();
      }
      if (changes['phase'] && !changes['phase'].firstChange && changes['phase'].previousValue !== this.phase) {
        this.triggerPhaseTransition(changes['phase'].previousValue as GamePhase);
        this.pruneAnimationState();
      }
      this.cdr.markForCheck();
    }
  }

  private pruneAnimationState(): void {
    if (this.spawnTimers.length > 80) {
      this.spawnTimers.splice(0, this.spawnTimers.length - 40).forEach(clearTimeout);
    }
    if (this.particles.length > 120) {
      this.particles.splice(0, this.particles.length - 90);
    }
  }

  private tryStartNetworkBootForCurrentRoom(): void {
    if (!this.viewReady || !this.state?.roomId || this.state.phase !== 'LOBBY') return;
    if (this.bootRoomKey === this.state.roomId) return;

    this.bootRoomKey = this.state.roomId;
    if ((this.state.players?.length ?? 0) > 0) {
      this.networkBootReady = true;
      this.networkBooting = false;
      return;
    }
    this.scheduleNetworkBoot();
  }

  private scheduleNetworkBoot(): void {
    this.networkBooting = true;
    this.networkBootReady = false;
    this.networkBootFlash = false;
    this.networkBootFading = false;
    this.bootStatusText = 'Inicializando núcleo FW…';
    this.bootSlotLit = new Set<number>();
    this.bootGuideLit = new Set<string>();
    this.buildSlotGuides();
    this.triggerHubRipple();
    this.scheduleGuideRevealTimers();
    this.cdr.markForCheck();

    const t1 = setTimeout(() => {
      this.bootStatusText = 'Desplegando topología…';
      this.cdr.markForCheck();
    }, 900);
    const t2 = setTimeout(() => {
      this.bootStatusText = 'Conectando slots de nodo…';
      this.cdr.markForCheck();
    }, 2200);
    const t3 = setTimeout(() => {
      this.bootStatusText = 'Red operativa';
      this.networkBootFlash = true;
      this.cdr.markForCheck();
    }, 5200);
    const tFade = setTimeout(() => {
      this.networkBootFlash = false;
      this.networkBootFading = true;
      for (const g of this.slotGuides) this.bootGuideLit.add(g.id);
      for (const s of this.starSlots) this.bootSlotLit.add(s.index);
      this.cdr.markForCheck();
    }, TopologyComponent.NETWORK_BOOT_MS - TopologyComponent.NETWORK_BOOT_FADE_MS);
    const tDone = setTimeout(() => {
      this.networkBooting = false;
      this.networkBootFading = false;
      this.networkBootReady = true;
      this.bootStatusText = '';
      for (const g of this.slotGuides) this.bootGuideLit.add(g.id);
      for (const s of this.starSlots) this.bootSlotLit.add(s.index);
      this.rebuildMeshLinks();
      this.cdr.markForCheck();
    }, TopologyComponent.NETWORK_BOOT_MS);
    this.spawnTimers.push(t1, t2, t3, tFade, tDone);
  }

  bootSlotVisible(index: number): boolean {
    return !this.networkBooting || this.bootSlotLit.has(index);
  }

  bootGuideVisible(guide: BootSpoke): boolean {
    if (!this.showLobbySlotGuides()) return false;
    if (this.isSlotOccupied(guide.slotIndex)) return false;
    return !this.networkBooting || this.bootGuideLit.has(guide.id);
  }

  showLobbySlotGuides(): boolean {
    return this.phase === 'LOBBY' && !!this.state;
  }

  private isSlotOccupied(slotIndex: number): boolean {
    return [...this.playerSlotIndex.values()].includes(slotIndex);
  }

  private scheduleGuideRevealTimers(): void {
    for (const guide of this.slotGuides) {
      const lineMs = Math.round(guide.delay * 1000);
      const nodeMs = lineMs + (guide.branch ? 480 : 620);
      const tGuide = setTimeout(() => {
        this.bootGuideLit.add(guide.id);
        this.cdr.markForCheck();
      }, lineMs);
      const tSlot = setTimeout(() => {
        this.bootSlotLit.add(guide.slotIndex);
        this.cdr.markForCheck();
      }, nodeMs);
      this.spawnTimers.push(tGuide, tSlot);
    }
  }

  hubRadarActive(): boolean {
    return !this.nodes.length && !this.leavingNodes.length && this.phase === 'LOBBY';
  }

  ghostBootDelay(index: number): string {
    return `${0.08}s`;
  }

  private triggerPhaseTransition(_from: GamePhase): void {
    this.phaseTransition = true;
    this.particlePhase = this.phase;
    this.triggerHubRipple();
    const t = setTimeout(() => {
      this.phaseTransition = false;
      this.cdr.markForCheck();
    }, 900);
    this.spawnTimers.push(t);
  }

  private triggerHubRipple(): void {
    const cx = this.hub.x;
    const cy = this.hub.y;
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * (1.4 + Math.random()),
        vy: Math.sin(angle) * (1.4 + Math.random()),
        size: 2 + Math.random() * 2.5,
        alpha: 0.7,
      });
    }
  }

  private assignPlayerSlot(playerId: string, maxSlots: number): number {
    const existing = this.playerSlotIndex.get(playerId);
    if (existing !== undefined) return existing;

    const used = new Set(this.playerSlotIndex.values());
    for (let i = 0; i < maxSlots; i++) {
      if (!used.has(i)) {
        this.playerSlotIndex.set(playerId, i);
        return i;
      }
    }
    this.playerSlotIndex.set(playerId, 0);
    return 0;
  }

  private releasePlayerSlot(playerId: string): void {
    this.playerSlotIndex.delete(playerId);
  }

  private nodePositionById(id: string): { x: number; y: number } | null {
    const node = this.nodes.find((n) => n.id === id);
    if (node) return { x: node.x, y: node.y };
    const slotIdx = this.playerSlotIndex.get(id);
    if (slotIdx === undefined || !this.state) return null;
    const max = Math.max(this.state.maxPlayers ?? 5, this.state.players.length);
    const slot = this.starSlots[slotIdx];
    return slot ? { x: slot.x, y: slot.y } : null;
  }

  private scheduleNodeArrival(id: string): void {
    this.cableExtendingIds.add(id);
    this.linkPulseIds.add(id);
    this.pulseStartedAt.set(id, performance.now());

    const node = this.nodes.find((n) => n.id === id);
    const handshakeMs = node ? this.computeLinkHandshakeMs(node) : TopologyComponent.LINK_HANDSHAKE_MS;
    this.linkHandshakeMsById.set(id, handshakeMs);
    this.refreshHubLinks();
    this.cdr.markForCheck();

    const tArrive = setTimeout(() => {
      this.cableExtendingIds.delete(id);
      this.spawningIds.add(id);
      const current = this.nodes.find((n) => n.id === id);
      const pos = this.nodePositionById(id);
      if (pos && current?.parentSlotIndex != null) {
        const parent = this.starSlots[current.parentSlotIndex];
        if (parent) this.triggerBranchParticleBurst(parent.x, parent.y, pos.x, pos.y);
        else if (pos) this.triggerParticleBurst('join', pos.x, pos.y);
      } else if (pos) {
        this.triggerParticleBurst('join', pos.x, pos.y);
      }
      this.refreshHubLinks();
      this.cdr.markForCheck();
    }, handshakeMs);
    this.spawnTimers.push(tArrive);

    const tBuildDone = setTimeout(() => {
      this.spawningIds.delete(id);
      this.connectedBlinkIds.add(id);
      this.cdr.markForCheck();
    }, handshakeMs + TopologyComponent.SPAWN_BUILD_MS);
    this.spawnTimers.push(tBuildDone);

    const tDone = setTimeout(() => {
      this.connectedBlinkIds.delete(id);
      this.linkPulseIds.delete(id);
      this.linkHandshakeMsById.delete(id);
      this.pulseStartedAt.delete(id);
      if (!this.flowPhaseByLink.has(id)) {
        this.flowPhaseByLink.set(id, { out: Math.random(), in: Math.random() * 0.5 });
      }
      this.refreshHubLinks();
      this.cdr.markForCheck();
    }, handshakeMs + TopologyComponent.SPAWN_BUILD_MS + TopologyComponent.CONNECT_BLINK_MS);
    this.spawnTimers.push(tDone);
  }

  private detectConnectionChanges(): void {
    const players = this.state?.players ?? [];
    const connectedNow = new Set(
      players.filter((p) => p.isAlive && p.isConnected).map((p) => p.id),
    );

    if (!this.layoutReady) {
      this.prevConnectedIds = connectedNow;
      return;
    }

    let changed = connectedNow.size !== this.prevConnectedIds.size;
    if (!changed) {
      for (const id of connectedNow) {
        if (!this.prevConnectedIds.has(id)) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) {
      for (const id of this.prevConnectedIds) {
        if (!connectedNow.has(id)) {
          changed = true;
          break;
        }
      }
    }

    this.prevConnectedIds = connectedNow;
    if (changed) {
      this.rebuildMeshLinks();
    }
  }

  private computeLinkHandshakeMs(node: NodePosition): number {
    const origin = this.resolveLinkOrigin(node);
    const dist = Math.hypot(node.x - origin.x, node.y - origin.y);
    if (node.parentSlotIndex != null) {
      return Math.round(Math.min(950, Math.max(580, dist * 5.5)));
    }
    return Math.round(Math.min(1300, Math.max(900, dist * 3.8)));
  }

  linkHandshakeSec(id: string, node?: NodePosition): string {
    const ms = this.linkHandshakeMsById.get(id) ?? (node ? this.computeLinkHandshakeMs(node) : TopologyComponent.LINK_HANDSHAKE_MS);
    return `${(ms / 1000).toFixed(2)}s`;
  }

  isBranchNode(node: NodePosition): boolean {
    return node.parentSlotIndex != null;
  }

  hexBuildPath(node: NodePosition, radius: number): string {
    const origin = this.resolveLinkOrigin(node);
    const hubAngle = Math.atan2(origin.y - node.y, origin.x - node.x);
    const verts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      verts.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    }

    let startIdx = 0;
    let best = Infinity;
    for (let i = 0; i < 6; i++) {
      const a = Math.atan2(verts[i].y, verts[i].x);
      const diff = Math.abs(Math.atan2(Math.sin(a - hubAngle), Math.cos(a - hubAngle)));
      if (diff < best) {
        best = diff;
        startIdx = i;
      }
    }

    let d = `M ${verts[startIdx].x} ${verts[startIdx].y}`;
    for (let i = 1; i <= 6; i++) {
      const v = verts[(startIdx + i) % 6];
      d += ` L ${v.x} ${v.y}`;
    }
    return `${d} Z`;
  }

  hexScaffoldLines(node: NodePosition, radius: number): Array<{ x1: number; y1: number; x2: number; y2: number }> {
    const attach = this.hexAttachPoint(node, radius);
    const origin = this.resolveLinkOrigin(node);
    const hubAngle = Math.atan2(origin.y - node.y, origin.x - node.x);
    const verts: Array<{ x: number; y: number; idx: number }> = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      verts.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle), idx: i });
    }
    verts.sort((a, b) => {
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(a.y, a.x) - hubAngle), Math.cos(Math.atan2(a.y, a.x) - hubAngle)));
      const db = Math.abs(Math.atan2(Math.sin(Math.atan2(b.y, b.x) - hubAngle), Math.cos(Math.atan2(b.y, b.x) - hubAngle)));
      return da - db;
    });
    return verts.slice(0, 3).map((v) => ({
      x1: attach.x,
      y1: attach.y,
      x2: v.x,
      y2: v.y,
    }));
  }

  hexAttachPoint(node: NodePosition, radius: number): { x: number; y: number } {
    const origin = this.resolveLinkOrigin(node);
    const dx = origin.x - node.x;
    const dy = origin.y - node.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: (dx / len) * radius, y: (dy / len) * radius };
  }

  private triggerBranchParticleBurst(fromX: number, fromY: number, toX: number, toY: number): void {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    for (let i = 0; i < 10; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      const speed = 0.8 + Math.random() * 1.2;
      this.particles.push({
        x: fromX + Math.cos(angle) * 38,
        y: fromY + Math.sin(angle) * 38,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        size: 1.5 + Math.random() * 2,
        alpha: 0.85,
      });
    }
    this.triggerParticleBurst('join', toX, toY);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateLayout(false);
    this.resizeParticlesCanvas();
    this.resizeLinkPacketsCanvas();
  }

  private detectPlayerChanges(): void {
    const players = this.state?.players ?? [];
    const currentIds = new Set(players.map((p) => p.id));

    if (!this.layoutReady) {
      this.prevPlayerIds = currentIds;
      this.prevAliveIds = new Set(players.filter((p) => p.isAlive).map((p) => p.id));
      this.layoutReady = true;
      return;
    }

    for (const id of currentIds) {
      if (!this.prevPlayerIds.has(id)) {
        this.scheduleNodeArrival(id);
      }
    }

    for (const id of this.prevPlayerIds) {
      if (!currentIds.has(id)) {
        this.scheduleNodeDeparture(id);
      }
    }

    this.prevPlayerIds = currentIds;
  }

  private detectAliveChanges(): void {
    const players = this.state?.players ?? [];
    const aliveNow = new Set(players.filter((p) => p.isAlive).map((p) => p.id));

    if (!this.layoutReady) {
      this.prevAliveIds = aliveNow;
      return;
    }

    for (const id of this.prevAliveIds) {
      if (!aliveNow.has(id) && !this.banAnimationIds.has(id)) {
        this.scheduleNodeBan(id);
      }
    }

    this.prevAliveIds = aliveNow;
  }

  private scheduleNodeBan(id: string): void {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) return;

    this.banAnimationIds.add(id);
    this.flowPhaseByLink.delete(id);
    this.linkPulseIds.add(id);
    this.pulseStartedAt.set(id, performance.now());
    this.linkHandshakeMsById.set(id, TopologyComponent.LEAVE_MS);
    this.triggerInterferenceBurst(node.x, node.y);
    this.refreshHubLinks();
    this.cdr.markForCheck();

    const tDone = setTimeout(() => {
      this.banAnimationIds.delete(id);
      this.linkPulseIds.delete(id);
      this.linkHandshakeMsById.delete(id);
      this.pulseStartedAt.delete(id);
      this.refreshHubLinks();
      this.cdr.markForCheck();
    }, TopologyComponent.LEAVE_MS);
    this.spawnTimers.push(tDone);
  }

  isBanAnimating(id: string): boolean {
    return this.banAnimationIds.has(id);
  }

  isFailoverPromoting(id: string): boolean {
    return this.failoverPromotingIds.has(id);
  }

  nodeX(node: NodePosition): number {
    return this.failoverDisplay.get(node.id)?.x ?? node.x;
  }

  nodeY(node: NodePosition): number {
    return this.failoverDisplay.get(node.id)?.y ?? node.y;
  }

  private detectArmFailoverPromotions(
    prevPositions: Map<string, { x: number; y: number }>,
    prevAnchors: Map<number, string | null>,
  ): void {
    if (!this.starSlots.some((s) => s.tier === 1)) return;
    if (!allPrimaryCentralsFallen(this.nodes, this.starSlots)) {
      for (let arm = 0; arm < 4; arm++) {
        this.prevArmAnchor.set(arm, this.getArmAnchorPlayerId(arm));
      }
      return;
    }

    const newHubAnchors = new Set<string>();

    for (let arm = 0; arm < 4; arm++) {
      const anchorId = this.getArmAnchorPlayerId(arm);
      const prevAnchor = prevAnchors.get(arm);
      this.prevArmAnchor.set(arm, anchorId);
      if (anchorId && prevAnchor !== anchorId && this.layoutReady) {
        const node = this.nodes.find((n) => n.id === anchorId);
        if (node?.player.isAlive) newHubAnchors.add(anchorId);
      }
    }

    if (!this.layoutReady) return;

    for (const node of this.nodes) {
      const from = prevPositions.get(node.id);
      if (!from) continue;
      const dist = Math.hypot(from.x - node.x, from.y - node.y);
      if (dist < 4) continue;
      this.scheduleFailoverPromotion(
        node.id,
        from.x,
        from.y,
        node.x,
        node.y,
        newHubAnchors.has(node.id),
      );
    }
  }

  private getArmAnchorPlayerId(arm: number): string | null {
    const chain = getArmSlotChain(this.starSlots, arm, this.hub.x, this.hub.y);
    const frontSlot = chain[0]?.index;
    if (frontSlot === undefined) return null;
    const node = this.nodes.find((n) => (n.effectiveSlotIndex ?? n.slotIndex) === frontSlot);
    if (!node?.player.isAlive) return null;
    return node.id;
  }

  private scheduleFailoverPromotion(
    id: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    connectHub = false,
  ): void {
    if (this.failoverPromotingIds.has(id)) return;
    this.failoverPromotingIds.add(id);
    const started = performance.now();
    const ms = TopologyComponent.FAILOVER_PROMOTE_MS;

    const tick = () => {
      const t = Math.min(1, (performance.now() - started) / ms);
      const p = this.easeOutCubic(t);
      this.failoverDisplay.set(id, {
        x: fromX + (toX - fromX) * p,
        y: fromY + (toY - fromY) * p,
      });
      this.refreshHubLinks();
      this.cdr.markForCheck();

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        this.failoverDisplay.delete(id);
        this.failoverPromotingIds.delete(id);
        const node = this.nodes.find((n) => n.id === id);
        if (connectHub && node?.player.isConnected && node.player.isAlive) {
          this.scheduleNodeArrival(id);
        } else {
          this.refreshHubLinks();
          this.rebuildMeshLinks();
          this.cdr.markForCheck();
        }
      }
    };

    requestAnimationFrame(tick);
    if (connectHub) {
      this.triggerParticleBurst('join', toX, toY);
    }
  }

  private scheduleNodeDeparture(id: string): void {
    const slotIdx = this.playerSlotIndex.get(id);
    let ghost = this.nodes.find((n) => n.id === id);
    if (!ghost && slotIdx !== undefined) {
      const slot = this.starSlots[slotIdx];
      if (slot) {
        ghost = {
          id,
          x: slot.x,
          y: slot.y,
          player: { id, name: '', isAlive: true, isConnected: false },
          angle: slot.angle,
          tier: slot.tier,
          slotIndex: slot.index,
          parentSlotIndex: slot.parentIndex,
        };
      }
    }
    if (!ghost) return;

    this.cableExtendingIds.delete(id);
    this.spawningIds.delete(id);
    this.connectedBlinkIds.delete(id);
    this.linkPulseIds.add(id);
    this.leavingNodes.push({ ...ghost, leavingAt: Date.now() });
    this.pulseStartedAt.set(id, performance.now());
    this.linkHandshakeMsById.set(id, TopologyComponent.LEAVE_MS);
    this.triggerInterferenceBurst(ghost.x, ghost.y);
    this.releasePlayerSlot(id);
    this.refreshHubLinks();
    this.updateGhostSlots();
    this.cdr.markForCheck();

    const freedSlot = ghost.slotIndex ?? slotIdx;
    const leaveMs = TopologyComponent.LEAVE_MS;

    const tDone = setTimeout(() => {
      this.leavingNodes = this.leavingNodes.filter((n) => n.id !== id);
      this.linkPulseIds.delete(id);
      this.linkHandshakeMsById.delete(id);
      this.pulseStartedAt.delete(id);
      if (freedSlot !== undefined) {
        this.returningGhostSlots.add(freedSlot);
        const tGhost = setTimeout(() => {
          this.returningGhostSlots.delete(freedSlot);
          this.cdr.markForCheck();
        }, 700);
        this.spawnTimers.push(tGhost);
      }
      this.refreshHubLinks();
      this.updateGhostSlots();
      this.cdr.markForCheck();
    }, leaveMs);
    this.spawnTimers.push(tDone);
  }

  private triggerInterferenceBurst(x: number, y: number): void {
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * (0.5 + Math.random()),
        vy: Math.sin(angle) * (0.5 + Math.random()),
        size: 1 + Math.random() * 2.5,
        alpha: 0.75,
      });
    }
  }

  isReturningGhost(index: number): boolean {
    return this.returningGhostSlots.has(index);
  }

  private initParticles(): void {
    const canvas = this.particlesCanvas?.nativeElement;
    if (!canvas) return;
    this.resizeParticlesCanvas();
    this.particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      size: 0.8 + Math.random() * 2.2,
      alpha: 0.12 + Math.random() * 0.5,
    }));
  }

  private resizeParticlesCanvas(): void {
    const canvas = this.particlesCanvas?.nativeElement;
    if (!canvas) return;
    canvas.width = this.width;
    canvas.height = this.height;
  }

  private animateParticles(): void {
    const canvas = this.particlesCanvas?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, this.width, this.height);

      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > this.width) p.vx *= -1;
        if (p.y < 0 || p.y > this.height) p.vy *= -1;
        if (p.alpha > 0.15) p.alpha *= 0.988;
      }

      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const a = this.particles[i];
          const b = this.particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 90) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${this.particleColor()}, ${0.08 * (1 - dist / 90)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      const rgb = this.particleColor();
      for (const p of this.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${p.alpha})`;
        ctx.fill();
      }

      this.particleFrame = requestAnimationFrame(draw);
    };
    draw();
  }

  private advanceLinkPacketPhases(now: number): void {
    const dt =
      this.lastPacketTickMs != null ? Math.min(0.05, (now - this.lastPacketTickMs) / 1000) : 0;
    this.lastPacketTickMs = now;

    for (const link of this.hubLinks) {
      if (!link.active || this.linkPulseIds.has(link.id)) continue;
      if (!this.flowPhaseByLink.has(link.id)) {
        this.flowPhaseByLink.set(link.id, { out: Math.random(), in: Math.random() * 0.5 });
      }
    }

    if (dt <= 0) return;

    const activeCount = this.hubLinks.filter(
      (l) => l.active && !this.linkPulseIds.has(l.id),
    ).length;
    const meshCount = this.ringMeshLinks.filter((l) => l.active).length;
    for (const link of this.hubLinks) {
      if (!link.active || this.linkPulseIds.has(link.id)) continue;
      const phase = this.flowPhaseByLink.get(link.id)!;
      const durOut = parseFloat(this.linkPacketDuration(activeCount));
      const durIn = parseFloat(this.linkPacketDuration(activeCount + 0.6));
      phase.out = (phase.out + dt / durOut) % 1;
      phase.in = (phase.in + dt / durIn) % 1;
    }

    for (const link of this.ringMeshLinks) {
      if (!link.active) continue;
      if (!this.flowPhaseByLink.has(link.id)) {
        this.flowPhaseByLink.set(link.id, { out: Math.random(), in: Math.random() * 0.5 });
      }
      const phase = this.flowPhaseByLink.get(link.id)!;
      const durOut = parseFloat(this.linkPacketDuration(activeCount + meshCount));
      const durIn = parseFloat(this.linkPacketDuration(activeCount + meshCount + 0.6));
      phase.out = (phase.out + dt / durOut) % 1;
      phase.in = (phase.in + dt / durIn) % 1;
    }

    const activeIds = new Set(
      [
        ...this.hubLinks.filter((l) => l.active && !this.linkPulseIds.has(l.id)).map((l) => l.id),
        ...this.ringMeshLinks.filter((l) => l.active).map((l) => l.id),
      ],
    );
    for (const id of this.flowPhaseByLink.keys()) {
      if (!activeIds.has(id)) this.flowPhaseByLink.delete(id);
    }
  }

  private drawLinkPacketsToCanvas(): void {
    const canvas = this.linkPacketsCanvas?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);
    const now = performance.now();

    if (this.networkBooting) {
      return;
    }

    for (const link of this.hubLinks) {
      if (this.linkPulseIds.has(link.id)) {
        const started = this.pulseStartedAt.get(link.id) ?? now;
        const ms = this.linkHandshakeMsById.get(link.id) ?? TopologyComponent.LINK_HANDSHAKE_MS;
        const t = Math.min(1, (now - started) / ms);
        const p = this.easeOutCubic(t);
        const tipX = link.x1 + (link.x2 - link.x1) * p;
        const tipY = link.y1 + (link.y2 - link.y1) * p;

        if (this.cableExtendingIds.has(link.id)) {
          this.paintExtendCable(ctx, link.x1, link.y1, tipX, tipY);
          if (t < 1) {
            this.paintPacket(ctx, tipX, tipY, 5, '#ffc832', 14);
          }
        }
        continue;
      }

      if (!link.active) continue;

      const phase = this.flowPhaseByLink.get(link.id);
      if (!phase) continue;

      this.paintPacket(
        ctx,
        link.x1 + (link.x2 - link.x1) * phase.out,
        link.y1 + (link.y2 - link.y1) * phase.out,
        3.5,
        '#ffc832',
        10,
      );
      this.paintPacket(
        ctx,
        link.x2 + (link.x1 - link.x2) * phase.in,
        link.y2 + (link.y1 - link.y2) * phase.in,
        2.5,
        '#ff5ec4',
        8,
      );
    }

    for (const link of this.ringMeshLinks) {
      if (this.linkPulseIds.has(link.id)) {
        const started = this.pulseStartedAt.get(link.id) ?? now;
        const ms = this.linkHandshakeMsById.get(link.id) ?? TopologyComponent.LINK_HANDSHAKE_MS;
        const t = Math.min(1, (now - started) / ms);
        const p = this.easeOutCubic(t);
        const tipX = link.x1 + (link.x2 - link.x1) * p;
        const tipY = link.y1 + (link.y2 - link.y1) * p;

        if (this.cableExtendingIds.has(link.id)) {
          this.paintExtendCable(ctx, link.x1, link.y1, tipX, tipY);
          if (t < 1) {
            this.paintPacket(ctx, tipX, tipY, 4.5, '#ffc832', 12);
          }
        }
        continue;
      }

      if (!link.active) continue;
      const phase = this.flowPhaseByLink.get(link.id);
      if (!phase) continue;
      this.paintPacket(
        ctx,
        link.x1 + (link.x2 - link.x1) * phase.out,
        link.y1 + (link.y2 - link.y1) * phase.out,
        3,
        '#ffc832',
        9,
      );
      this.paintPacket(
        ctx,
        link.x2 + (link.x1 - link.x2) * phase.in,
        link.y2 + (link.y1 - link.y2) * phase.in,
        2.2,
        '#ff5ec4',
        7,
      );
    }
  }

  private paintExtendCable(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = '#00e8ff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#00e8ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  private paintPacket(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
    glow: number,
  ): void {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  get effectiveSkipVotes(): number {
    return this.skipVotes || countSkipVotes(this.state?.votes ?? {});
  }

  isGlitching(id: string): boolean {
    return this.glitchPlayerIds.includes(id);
  }

  isCableExtending(id: string): boolean {
    return this.cableExtendingIds.has(id);
  }

  isConnectedBlink(id: string): boolean {
    return this.connectedBlinkIds.has(id);
  }

  isSpawning(id: string): boolean {
    return this.spawningIds.has(id);
  }

  isPendingConnection(id: string): boolean {
    return (
      this.failoverPromotingIds.has(id) ||
      this.cableExtendingIds.has(id) ||
      this.spawningIds.has(id) ||
      this.connectedBlinkIds.has(id)
    );
  }

  activeLinkCount(): number {
    return this.hubLinks.filter((l) => l.active && !l.pulsing).length;
  }

  isDimmed(): boolean {
    return this.phase === 'NOCHE';
  }

  showVoteStats(): boolean {
    return this.phase === 'VOTACION' || this.phase === 'DIA';
  }

  nodeClass(player: PublicPlayer): string {
    if (!player.isAlive) return 'node-dead';
    if (!player.isConnected) return 'node-offline';
    if (player.frozen) return 'node-frozen';
    if (player.infected) return 'node-infected';
    if (player.silenced) return 'node-silenced';
    if (this.phase === 'VOTACION' || this.phase === 'DIA') return 'node-active';
    return 'node-online';
  }

  nodeClasses(player: PublicPlayer): Record<string, boolean> {
    const team = roleTeamHint(player.role);
    return {
      'player-node': true,
      [this.nodeClass(player)]: true,
      [`team-${team}`]: !!team,
    };
  }

  showRole(player: PublicPlayer): boolean {
    return !!player.role && this.phase === 'FIN' && player.isAlive;
  }

  nodeStatusLabel(player: PublicPlayer): string | null {
    if (!player.isAlive) return player.role ? `BANEADO · ${player.role}` : 'BANEADO';
    if (!player.isConnected) return 'DESCONECTADO';
    if (player.frozen) return 'CONGELADO';
    if (player.infected) return 'INFECTADO';
    if (player.silenced) return 'SILENCIADO';
    return null;
  }

  isNodeHealthy(player: PublicPlayer): boolean {
    return player.isAlive && player.isConnected && !player.silenced;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeKickMenu();
  }

  onNodeClick(node: NodePosition, event: MouseEvent): void {
    if (!this.kickEnabled) return;
    event.stopPropagation();
    if (this.kickMenu?.player.id === node.id) {
      this.closeKickMenu();
      return;
    }
    this.kickMenu = { player: node.player, x: this.nodeX(node), y: this.nodeY(node) };
    this.cdr.markForCheck();
  }

  confirmKick(): void {
    if (!this.kickMenu) return;
    this.kickPlayer.emit(this.kickMenu.player);
    this.closeKickMenu();
  }

  closeKickMenu(): void {
    if (!this.kickMenu) return;
    this.kickMenu = null;
    this.cdr.markForCheck();
  }

  kickMenuLeftPct(): number {
    if (!this.kickMenu || !this.width) return 50;
    return (this.kickMenu.x / this.width) * 100;
  }

  kickMenuTopPct(): number {
    if (!this.kickMenu || !this.height) return 50;
    return (this.kickMenu.y / this.height) * 100;
  }

  get nodeMetrics() {
    return {
      outer: 50,
      inner: 38,
      initialSize: 22,
      nameSize: 14,
      statusSize: 11,
      roleSize: 11,
      nameY: 68,
      statusY: -42,
      roleY: -62,
      pulseR: 54,
      linkInset: 52,
      /** Borde del disco del hub donde enchufan los cables (coincide con .hub-plate). */
      hubPortRadius: 55,
      primaryInset: 46,
    };
  }

  get orbitRadius(): number {
    return outerOrbitRadius(this.starSlots, this.hub.x, this.hub.y);
  }

  ghostSlotDelay(index: number): string {
    return `${(index % 8) * 0.22}s`;
  }

  linkPacketDuration(activeCount: number): string {
    const base = 2.4 - Math.min(activeCount, 10) * 0.12;
    return `${Math.max(1.4, base).toFixed(1)}s`;
  }

  private buildSlotGuides(): void {
    if (this.phase !== 'LOBBY' || !this.state) {
      this.slotGuides = [];
      return;
    }

    const guides: BootSpoke[] = [];
    const hubDelayBySlot = new Map<number, number>();
    const branchCountByArm = [0, 0, 0, 0];
    let hubSeq = 0;

    for (const slot of this.starSlots) {
      if (slot.parentIndex == null) {
        const delay = 0.65 + hubSeq * 0.18;
        hubDelayBySlot.set(slot.index, delay);
        const ep = linkEndpoints(
          this.hub.x,
          this.hub.y,
          slot.x,
          slot.y,
          this.nodeMetrics.hubPortRadius,
          this.nodeMetrics.linkInset,
        );
        guides.push({
          id: `hub-${slot.index}`,
          slotIndex: slot.index,
          branch: false,
          delay,
          ...ep,
        });
        hubSeq++;
      }
    }

    for (const slot of this.starSlots) {
      if (slot.parentIndex == null) continue;
      const parent = this.starSlots[slot.parentIndex];
      if (!parent) continue;
      const arm = slot.parentIndex;
      const parentDelay = hubDelayBySlot.get(arm) ?? 0.65;
      const branchN = branchCountByArm[arm]++;
      const delay = parentDelay + 0.78 + branchN * 0.14;
      const ep = linkEndpoints(
        parent.x,
        parent.y,
        slot.x,
        slot.y,
        this.nodeMetrics.primaryInset,
        this.nodeMetrics.linkInset,
      );
      guides.push({
        id: `branch-${slot.index}`,
        slotIndex: slot.index,
        branch: true,
        delay,
        ...ep,
      });
    }

    this.slotGuides = guides;
  }

  slotWirePath(slot: SlotPosition, radius: number): string {
    const stub: NodePosition = {
      id: `ghost-${slot.index}`,
      x: slot.x,
      y: slot.y,
      player: { id: '', name: '', isAlive: true, isConnected: false },
      angle: slot.angle,
      tier: slot.tier,
      slotIndex: slot.index,
      parentSlotIndex: slot.parentIndex,
    };
    return this.hexBuildPath(stub, radius);
  }

  private buildSpokeGuides(_maxSlots: number): void {
    this.spokeGuides = [];
  }

  private getOccupantAtSlot(slotIndex: number): NodePosition | null {
    return (
      this.nodes.find((n) => (n.effectiveSlotIndex ?? n.slotIndex) === slotIndex) ?? null
    );
  }

  /** Jugador presente, conectado y con handshake de llegada completado. */
  private isSlotDataReady(slotIndex: number): boolean {
    const node = this.getOccupantAtSlot(slotIndex);
    if (!node) return false;
    if (this.leavingNodes.some((n) => n.slotIndex === slotIndex)) return false;
    if (this.isPendingConnection(node.id)) return false;
    return node.player.isAlive && node.player.isConnected;
  }

  private isSlotEntryAnimating(slotIndex: number): boolean {
    const node = this.getOccupantAtSlot(slotIndex);
    if (!node) return false;
    return this.isPendingConnection(node.id);
  }

  /**
   * Líneas de datos solo entre nodos exteriores **adyacentes en el perímetro**:
   * - Estrella extendida: anillo angular entre hojas tier-1 (sin diagonales ni diamante central).
   * - Estrella clásica (≤6): anillo entre nodos del único anillo.
   */
  private collectMeshSegments(): MeshSegment[] {
    const segments: MeshSegment[] = [];
    const inset = this.nodeMetrics.linkInset;
    const hasLeaves = this.starSlots.some((s) => s.tier === 1);

    const ring = hasLeaves
      ? this.starSlots.filter((s) => s.tier === 1)
      : this.starSlots.filter((s) => s.tier === 0);

    if (ring.length < 2) return segments;

    const sorted = [...ring].sort((a, b) => {
      const angA = Math.atan2(a.y - this.hub.y, a.x - this.hub.x);
      const angB = Math.atan2(b.y - this.hub.y, b.x - this.hub.x);
      return angA - angB;
    });

    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const b = sorted[(i + 1) % sorted.length];
      const ep = linkEndpoints(a.x, a.y, b.x, b.y, inset, inset);
      segments.push({
        id: `mesh-perim-${a.index}-${b.index}`,
        slotA: a.index,
        slotB: b.index,
        ...ep,
      });
    }

    return segments;
  }

  private buildMeshHubLink(seg: MeshSegment): HubLink {
    const readyA = this.isSlotDataReady(seg.slotA);
    const readyB = this.isSlotDataReady(seg.slotB);
    const bothReady = readyA && readyB;
    const pulsing = this.linkPulseIds.has(seg.id);

    return {
      id: seg.id,
      x1: seg.x1,
      y1: seg.y1,
      x2: seg.x2,
      y2: seg.y2,
      visible: bothReady || pulsing,
      active: bothReady && !pulsing && !this.networkBooting,
      pulsing,
      isBranch: true,
      handshakeSec: this.linkHandshakeSec(seg.id),
    };
  }

  private scheduleMeshLinkArrival(seg: MeshSegment): void {
    this.cableExtendingIds.add(seg.id);
    this.linkPulseIds.add(seg.id);
    this.pulseStartedAt.set(seg.id, performance.now());

    const dist = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
    const ms = Math.round(Math.min(950, Math.max(520, dist * 4.5)));
    this.linkHandshakeMsById.set(seg.id, ms);
    this.rebuildMeshLinks();
    this.cdr.markForCheck();

    const tDone = setTimeout(() => {
      this.cableExtendingIds.delete(seg.id);
      this.linkPulseIds.delete(seg.id);
      this.linkHandshakeMsById.delete(seg.id);
      this.pulseStartedAt.delete(seg.id);
      this.prevMeshLinkActive.add(seg.id);
      if (!this.flowPhaseByLink.has(seg.id)) {
        this.flowPhaseByLink.set(seg.id, { out: Math.random(), in: Math.random() * 0.5 });
      }
      this.rebuildMeshLinks();
      this.cdr.markForCheck();
    }, ms);
    this.spawnTimers.push(tDone);
  }

  /** Líneas de datos entre nodos adyacentes (solo si ambos están conectados). */
  private rebuildMeshLinks(): void {
    if (!this.starSlots.length) {
      this.ringMeshLinks = [];
      return;
    }

    const segments = this.collectMeshSegments();
    const prev = this.prevMeshLinkActive;
    const nextActive = new Set<string>();

    this.ringMeshLinks = segments.map((seg) => {
      const link = this.buildMeshHubLink(seg);
      if (link.active) nextActive.add(seg.id);
      return link;
    });

    if (!this.meshLinksInitialized) {
      this.prevMeshLinkActive = nextActive;
      this.meshLinksInitialized = true;
      return;
    }

    if (!this.networkBooting && this.layoutReady) {
      for (const seg of segments) {
        const ready = this.isSlotDataReady(seg.slotA) && this.isSlotDataReady(seg.slotB);
        if (!ready || prev.has(seg.id) || this.linkPulseIds.has(seg.id)) continue;
        if (this.isSlotEntryAnimating(seg.slotA) || this.isSlotEntryAnimating(seg.slotB)) continue;
        this.scheduleMeshLinkArrival(seg);
      }
    }

    for (const id of [...this.prevMeshLinkActive]) {
      if (!nextActive.has(id) && !this.linkPulseIds.has(id)) {
        this.prevMeshLinkActive.delete(id);
        this.flowPhaseByLink.delete(id);
      }
    }
  }

  private resolveLinkOrigin(node: NodePosition): { x: number; y: number; inset: number; isBranch: boolean } {
    if (node.parentSlotIndex != null) {
      const parent = this.starSlots[node.parentSlotIndex];
      if (parent) {
        const parentNode = this.getOccupantAtSlot(node.parentSlotIndex);
        const px = parentNode ? this.nodeX(parentNode) : parent.x;
        const py = parentNode ? this.nodeY(parentNode) : parent.y;
        return { x: px, y: py, inset: this.nodeMetrics.primaryInset, isBranch: true };
      }
    }
    return { x: this.hub.x, y: this.hub.y, inset: this.nodeMetrics.hubPortRadius, isBranch: false };
  }

  hexPoints(radius: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      pts.push(`${radius * Math.cos(angle)},${radius * Math.sin(angle)}`);
    }
    return pts.join(' ');
  }

  private triggerParticleBurst(kind: 'join' | 'leave', x: number, y: number): void {
    const count = kind === 'join' ? 16 : 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = kind === 'join' ? 0.6 + Math.random() * 1.4 : 1 + Math.random() * 1.6;
      const dir = kind === 'join' ? 1 : -1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed * dir,
        vy: Math.sin(angle) * speed * dir,
        size: 1.5 + Math.random() * 2,
        alpha: kind === 'join' ? 0.9 : 0.65,
      });
    }
    if (this.particles.length > 140) {
      this.particles.splice(0, this.particles.length - 140);
    }
  }

  private particleColor(): string {
    switch (this.particlePhase) {
      case 'NOCHE':
      case 'VERIFICACION':
        return '170, 80, 255';
      case 'DIA':
      case 'VOTACION':
        return '255, 200, 80';
      case 'FIN':
        return '0, 255, 160';
      default:
        return '0, 240, 255';
    }
  }

  private updateGhostSlots(): void {
    if (this.phase !== 'LOBBY' || !this.state) {
      this.ghostSlots = [];
      return;
    }
    const max = Math.max(this.state.maxPlayers ?? 5, this.state.players.length);
    const usedSlots = new Set(this.playerSlotIndex.values());
    this.ghostSlots = this.starSlots.filter((s) => !usedSlots.has(s.index));
  }

  private refreshHubLinks(includeMesh = true): void {
    this.hubLinks = [
      ...this.nodes.map((node) => this.buildHubLink(node)),
      ...this.leavingNodes.map((node) => this.buildHubLink(node)),
    ];
    if (includeMesh) {
      this.rebuildMeshLinks();
    }
    this.updateHubPorts();
  }

  private updateHubPorts(): void {
    const r = this.nodeMetrics.hubPortRadius;
    this.hubPorts = this.hubLinks
      .filter((l) => !l.isBranch && (l.visible || l.pulsing))
      .map((l) => {
        const node =
          this.nodes.find((n) => n.id === l.id) ?? this.leavingNodes.find((n) => n.id === l.id);
        const tx = node?.x ?? l.x2;
        const ty = node?.y ?? l.y2;
        const dx = tx - this.hub.x;
        const dy = ty - this.hub.y;
        const len = Math.hypot(dx, dy) || 1;
        return {
          id: l.id,
          px: (dx / len) * r,
          py: (dy / len) * r,
          active: l.active,
          pulsing: l.pulsing,
        };
      });
  }

  private buildHubLink(node: NodePosition): HubLink {
    const origin = this.resolveLinkOrigin(node);
    const nx = this.nodeX(node);
    const ny = this.nodeY(node);
    const endpoints = linkEndpoints(
      origin.x,
      origin.y,
      nx,
      ny,
      origin.inset,
      this.nodeMetrics.linkInset,
    );
    const connected = node.player.isConnected;
    const pending = this.isPendingConnection(node.id);
    const leaving = this.leavingNodes.some((n) => n.id === node.id);
    const banning = this.banAnimationIds.has(node.id);
    const healthy = node.player.isAlive && !this.banAnimationIds.has(node.id) && !banning;
    return {
      id: node.id,
      ...endpoints,
      visible: connected || pending || leaving || banning,
      active: connected && healthy && !pending && !leaving,
      pulsing: this.linkPulseIds.has(node.id),
      isBranch: origin.isBranch,
      handshakeSec: this.linkHandshakeSec(node.id, node),
    };
  }

  private updateLayout(initial: boolean): void {
    const el = this.svgContainer?.nativeElement;
    if (!el) return;

    this.width = el.clientWidth || 800;
    this.height = el.clientHeight || 600;
    const players = this.state?.players ?? [];
    const maxSlots = Math.max(this.state?.maxPlayers ?? 5, players.length);

    this.hub = hubPoint(this.width, this.height);
    this.starSlots = computeExtendedStarSlotLayout(maxSlots, this.width, this.height);
    this.buildSpokeGuides(maxSlots);

    const assignments = players.map((player) => ({
      player,
      slotIndex: this.assignPlayerSlot(player.id, maxSlots),
    }));

    this.nodes = applyArmFailover(
      computeExtendedStarLayoutFromSlots(assignments, this.starSlots),
      this.starSlots,
      this.hub.x,
      this.hub.y,
    );

    if (!this.layoutReady) {
      for (let arm = 0; arm < 4; arm++) {
        this.prevArmAnchor.set(arm, this.getArmAnchorPlayerId(arm));
      }
    }

    this.leavingNodes = this.leavingNodes.map((ln) => {
      const slot = this.starSlots[ln.slotIndex];
      return slot ? { ...ln, x: slot.x, y: slot.y } : ln;
    });

    this.refreshHubLinks(false);
    this.updateGhostSlots();
    this.buildSlotGuides();
    this.resizeParticlesCanvas();
    this.resizeLinkPacketsCanvas();
    if (initial) this.initParticles();
    this.cdr.detectChanges();
  }

  private resizeLinkPacketsCanvas(): void {
    const canvas = this.linkPacketsCanvas?.nativeElement;
    if (!canvas) return;
    canvas.width = this.width;
    canvas.height = this.height;
  }
}
