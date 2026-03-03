import type { Vec2 } from '../simulation/types.ts';
import { TRAIL_MAX_POINTS, TRAIL_SAMPLE_INTERVAL } from '../simulation/constants.ts';

export class TrailRecorder {
  private points: Vec2[] = [];
  private lastSampleTime = -Infinity;

  record(position: Vec2, gameTime: number): void {
    if (gameTime - this.lastSampleTime >= TRAIL_SAMPLE_INTERVAL) {
      this.points.push({ x: position.x, y: position.y });
      this.lastSampleTime = gameTime;

      // Ring buffer: drop oldest points
      if (this.points.length > TRAIL_MAX_POINTS) {
        this.points.shift();
      }
    }
  }

  getPoints(): Vec2[] {
    return this.points;
  }

  clear(): void {
    this.points = [];
    this.lastSampleTime = -Infinity;
  }
}
