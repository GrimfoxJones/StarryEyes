import { Container } from 'pixi.js';
import type { SystemSnapshot } from '../../simulation/types.ts';
import type { Camera } from '../camera.ts';
import type { ObjectType } from '../hud/store.ts';
import { MIN_BODY_PIXEL_RADIUS } from '../../simulation/constants.ts';
import { Reticle } from './Reticle.ts';
import { ConnectorLine } from './ConnectorLine.ts';
import { InfoBox } from './InfoBox.ts';
import { getInfoContent } from './infoContent.ts';
import { computePlacement, lerpPlacement, type PlacementResult } from './positioning.ts';
import { clamp01, easeOutBack, easeOutQuad, phaseProgress, lerp } from './easing.ts';

// ── Animation timing (ms) ──────────────────────────────────────────
const RETICLE_SNAP_START = 0;
const RETICLE_SNAP_END = 100;
const BLIP1_TIME = 80;
const BLIP2_TIME = 130;
const BLIP_DURATION = 30;
const LINE_START = 100;
const LINE_END = 300;
const BOX_START = 250;
const BOX_END = 450;
const SETTLE_TIME = 450;

// Dismiss timing
const DISMISS_BOX_MS = 100;
const DISMISS_LINE_MS = 150;
const DISMISS_RETICLE_MS = 150;
const DISMISS_TOTAL_MS = DISMISS_BOX_MS + Math.max(DISMISS_LINE_MS, DISMISS_RETICLE_MS);

// Settled pulse
const PULSE_PERIOD_MS = 2000;
const PULSE_MIN_ALPHA = 0.7;

// Content refresh
const CONTENT_REFRESH_MS = 1000;

// Quadrant transition
const QUADRANT_TRANSITION_MS = 300;

type Phase = 'idle' | 'acquiring' | 'settled' | 'dismissing';

export class TargetDisplay {
  readonly container = new Container();

  private reticle = new Reticle();
  private line = new ConnectorLine();
  private infoBox = new InfoBox();

  private camera: Camera;

  // State
  private phase: Phase = 'idle';
  private elapsedMs = 0;

  // Target
  private targetId: string | null = null;
  private targetType: ObjectType | null = null;

  // Placement
  private currentPlacement: PlacementResult | null = null;
  private prevPlacement: PlacementResult | null = null;
  private quadrantTransitionMs = 0;

  // Content refresh
  private lastContentRefreshMs = 0;

  // Pending acquire (for target switching: dismiss old, then acquire new)
  private pendingAcquire: { objectId: string; objectType: ObjectType } | null = null;

  constructor(camera: Camera) {
    this.camera = camera;

    this.container.addChild(this.reticle.container);
    this.container.addChild(this.line.container);
    this.container.addChild(this.infoBox.container);
  }

  /** Begin targeting a new object */
  acquire(objectId: string, objectType: ObjectType): void {
    if (this.phase === 'acquiring' || this.phase === 'settled') {
      // Currently showing a target — dismiss first, then acquire new
      if (this.targetId === objectId) return; // already targeting this
      this.pendingAcquire = { objectId, objectType };
      this.startDismiss();
      return;
    }

    this.targetId = objectId;
    this.targetType = objectType;
    this.phase = 'acquiring';
    this.elapsedMs = 0;
    this.lastContentRefreshMs = 0;
    this.currentPlacement = null;
    this.prevPlacement = null;
    this.quadrantTransitionMs = 0;
  }

  /** Dismiss current target */
  dismiss(): void {
    if (this.phase === 'idle' || this.phase === 'dismissing') return;
    this.pendingAcquire = null;
    this.startDismiss();
  }

  /** Whether a target is currently shown (for Escape chain) */
  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** Called every frame from game loop */
  update(snapshot: SystemSnapshot, deltaMs: number): void {
    if (this.phase === 'idle') return;

    this.elapsedMs += deltaMs;

    if (this.phase === 'dismissing') {
      this.updateDismiss(snapshot);
      return;
    }

    // Transition to settled
    if (this.phase === 'acquiring' && this.elapsedMs >= SETTLE_TIME) {
      this.phase = 'settled';
    }

    // Find target body
    const body = this.targetId
      ? snapshot.bodies.find((b) => b.id === this.targetId)
      : null;

    if (!body) {
      this.hideAll();
      this.phase = 'idle';
      return;
    }

    // Screen position
    const screenPos = this.camera.simToScreen(body.position.x, body.position.y);
    const simRadius = body.radius * this.camera.scale;
    const bodyPixelRadius = Math.max(simRadius, MIN_BODY_PIXEL_RADIUS);

    // Placement (quadrant-adaptive)
    const newPlacement = computePlacement(
      screenPos.x,
      screenPos.y,
      this.camera.viewportWidth,
      this.camera.viewportHeight,
    );

    if (this.currentPlacement) {
      const dirChanged =
        newPlacement.dirX !== this.currentPlacement.dirX ||
        newPlacement.dirY !== this.currentPlacement.dirY;

      if (dirChanged) {
        this.prevPlacement = { ...this.currentPlacement };
        this.quadrantTransitionMs = 0;
      }
    }

    // Smooth quadrant transition
    if (this.prevPlacement && this.quadrantTransitionMs < QUADRANT_TRANSITION_MS) {
      this.quadrantTransitionMs += deltaMs;
      const t = clamp01(this.quadrantTransitionMs / QUADRANT_TRANSITION_MS);
      this.currentPlacement = lerpPlacement(this.prevPlacement, newPlacement, t);
      if (t >= 1) this.prevPlacement = null;
    } else {
      this.currentPlacement = newPlacement;
    }

    const placement = this.currentPlacement;

    // ── Reticle ──
    if (this.phase === 'acquiring') {
      const snapProgress = clamp01(phaseProgress(this.elapsedMs, RETICLE_SNAP_START, RETICLE_SNAP_END));
      const easedSnap = easeOutBack(snapProgress);
      const reticleScale = lerp(2.0, 1.0, easedSnap);

      // Blip pulses
      let blipAlpha = 1.0;
      const blip1P = phaseProgress(this.elapsedMs, BLIP1_TIME, BLIP1_TIME + BLIP_DURATION);
      const blip2P = phaseProgress(this.elapsedMs, BLIP2_TIME, BLIP2_TIME + BLIP_DURATION);
      if (blip1P > 0 && blip1P < 1) blipAlpha = 0.5 + 0.5 * Math.sin(blip1P * Math.PI);
      if (blip2P > 0 && blip2P < 1) blipAlpha = 0.5 + 0.5 * Math.sin(blip2P * Math.PI);

      this.reticle.draw(bodyPixelRadius, reticleScale, blipAlpha);
    } else {
      // Settled: gentle pulse
      const pulseT = (this.elapsedMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
      const pulseAlpha = lerp(PULSE_MIN_ALPHA, 1.0, 0.5 + 0.5 * Math.sin(pulseT * Math.PI * 2));
      this.reticle.draw(bodyPixelRadius, 1.0, pulseAlpha);
    }

    this.reticle.container.x = screenPos.x;
    this.reticle.container.y = screenPos.y;

    // ── Connector Line ──
    const lineProgress = clamp01(phaseProgress(this.elapsedMs, LINE_START, LINE_END));
    const lineDraw = easeOutQuad(lineProgress);
    this.line.draw(
      screenPos.x, screenPos.y,
      placement.elbowX, placement.elbowY,
      placement.endX, placement.endY,
      lineDraw, 1.0,
    );

    // ── Info Box ──
    const boxProgress = clamp01(phaseProgress(this.elapsedMs, BOX_START, BOX_END));
    const boxAlpha = easeOutQuad(boxProgress);
    const boxScale = lerp(0.9, 1.0, boxProgress);

    if (boxProgress > 0 && this.targetId && this.targetType) {
      // Refresh content periodically
      const shouldRefresh =
        this.elapsedMs - this.lastContentRefreshMs >= CONTENT_REFRESH_MS ||
        this.lastContentRefreshMs === 0;

      if (shouldRefresh) {
        this.lastContentRefreshMs = this.elapsedMs;
      }

      const playerShip = snapshot.ships[0];
      const content = getInfoContent(
        this.targetId,
        this.targetType,
        snapshot,
        playerShip ? { x: playerShip.position.x, y: playerShip.position.y } : undefined,
      );

      this.infoBox.draw(
        placement.endX,
        placement.endY,
        placement.dirX,
        placement.dirY,
        content,
        this.targetId,
        this.targetType,
        boxAlpha,
        boxScale,
      );
    }
  }

  // ── Dismiss animation ──────────────────────────────────────────────

  private dismissElapsed = 0;

  private startDismiss(): void {
    this.phase = 'dismissing';
    this.dismissElapsed = 0;
  }

  private updateDismiss(snapshot: SystemSnapshot): void {
    this.dismissElapsed += 0; // deltaMs already added to elapsedMs
    // Use a separate counter based on phase start
    // Re-purpose elapsedMs: track time since dismiss started
    // Actually, let's use dismissElapsed properly
    // The issue is deltaMs was already consumed. Let's track independently.

    // We'll track dismiss timing through the main elapsedMs by recording start
    if (this.dismissElapsed === 0) {
      this.dismissElapsed = 0.001; // Mark as started
    }

    // For dismiss, we need the deltaMs. Since update() already called,
    // we'll compute from how elapsedMs grew. But simpler: just use a separate counter.
    // Let's fix: store dismissStartMs
    this.updateDismissImpl(snapshot);
  }

  private dismissStartMs = 0;

  private updateDismissImpl(snapshot: SystemSnapshot): void {
    if (this.dismissStartMs === 0) {
      this.dismissStartMs = this.elapsedMs;
    }

    const dt = this.elapsedMs - this.dismissStartMs;

    // Find target for positioning
    const body = this.targetId
      ? snapshot.bodies.find((b) => b.id === this.targetId)
      : null;

    if (!body) {
      this.finishDismiss();
      return;
    }

    const screenPos = this.camera.simToScreen(body.position.x, body.position.y);
    const simRadius = body.radius * this.camera.scale;
    const bodyPixelRadius = Math.max(simRadius, MIN_BODY_PIXEL_RADIUS);

    // Phase 1: Box fade (0 → DISMISS_BOX_MS)
    const boxFade = 1 - clamp01(dt / DISMISS_BOX_MS);
    if (boxFade > 0 && this.targetId && this.targetType && this.currentPlacement) {
      const playerShip = snapshot.ships[0];
      const content = getInfoContent(
        this.targetId,
        this.targetType,
        snapshot,
        playerShip ? { x: playerShip.position.x, y: playerShip.position.y } : undefined,
      );
      this.infoBox.draw(
        this.currentPlacement.endX,
        this.currentPlacement.endY,
        this.currentPlacement.dirX,
        this.currentPlacement.dirY,
        content,
        this.targetId,
        this.targetType,
        boxFade,
        1.0,
      );
    } else {
      this.infoBox.hide();
    }

    // Phase 2: Line retract (DISMISS_BOX_MS → DISMISS_BOX_MS + DISMISS_LINE_MS)
    const lineT = clamp01((dt - DISMISS_BOX_MS) / DISMISS_LINE_MS);
    const lineProgress = 1 - lineT;
    if (lineProgress > 0 && this.currentPlacement) {
      this.line.draw(
        screenPos.x, screenPos.y,
        this.currentPlacement.elbowX, this.currentPlacement.elbowY,
        this.currentPlacement.endX, this.currentPlacement.endY,
        lineProgress, 1.0,
      );
    } else {
      this.line.hide();
    }

    // Phase 3: Reticle expand+fade (DISMISS_BOX_MS → DISMISS_BOX_MS + DISMISS_RETICLE_MS)
    const reticleT = clamp01((dt - DISMISS_BOX_MS) / DISMISS_RETICLE_MS);
    const reticleScale = lerp(1.0, 1.5, reticleT);
    const reticleAlpha = 1 - reticleT;
    if (reticleAlpha > 0) {
      this.reticle.draw(bodyPixelRadius, reticleScale, reticleAlpha);
      this.reticle.container.x = screenPos.x;
      this.reticle.container.y = screenPos.y;
    } else {
      this.reticle.hide();
    }

    // Done?
    if (dt >= DISMISS_TOTAL_MS) {
      this.finishDismiss();
    }
  }

  private finishDismiss(): void {
    this.hideAll();
    this.phase = 'idle';
    this.targetId = null;
    this.targetType = null;
    this.dismissStartMs = 0;
    this.dismissElapsed = 0;

    // If there's a pending acquire, start it now
    if (this.pendingAcquire) {
      const { objectId, objectType } = this.pendingAcquire;
      this.pendingAcquire = null;
      this.acquire(objectId, objectType);
    }
  }

  private hideAll(): void {
    this.reticle.hide();
    this.line.hide();
    this.infoBox.hide();
  }
}
