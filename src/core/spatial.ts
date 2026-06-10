// Spatial hash grid for fast nearest-enemy and radius queries.
// Rebuilt every frame from the enemy list (cheap: one pass).

export interface HasPosition {
  x: number;
  y: number;
}

export class SpatialHash<T extends HasPosition> {
  private cells = new Map<number, T[]>();
  constructor(private cellSize = 80) {}

  private key(cx: number, cy: number): number {
    return cx * 73856093 ^ cy * 19349663;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    const k = this.key(cx, cy);
    let cell = this.cells.get(k);
    if (!cell) { cell = []; this.cells.set(k, cell); }
    cell.push(item);
  }

  /** Visit all items within `radius` of (x, y). */
  forEachInRadius(x: number, y: number, radius: number, fn: (item: T) => void): void {
    const r2 = radius * radius;
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const item of cell) {
          const dx = item.x - x, dy = item.y - y;
          if (dx * dx + dy * dy <= r2) fn(item);
        }
      }
    }
  }

  /** Nearest item to (x, y) within maxRadius, with optional filter. */
  nearest(x: number, y: number, maxRadius: number, filter?: (item: T) => boolean): T | null {
    let best: T | null = null;
    let bestD2 = maxRadius * maxRadius;
    // Search expanding rings of cells so we can usually stop early.
    const maxRing = Math.ceil(maxRadius / this.cellSize);
    const ccx = Math.floor(x / this.cellSize);
    const ccy = Math.floor(y / this.cellSize);
    for (let ring = 0; ring <= maxRing; ring++) {
      // Once we have a hit closer than the inner edge of this ring, stop.
      if (best && (ring - 1) * this.cellSize > Math.sqrt(bestD2)) break;
      for (let cx = ccx - ring; cx <= ccx + ring; cx++) {
        for (let cy = ccy - ring; cy <= ccy + ring; cy++) {
          if (Math.max(Math.abs(cx - ccx), Math.abs(cy - ccy)) !== ring) continue;
          const cell = this.cells.get(this.key(cx, cy));
          if (!cell) continue;
          for (const item of cell) {
            if (filter && !filter(item)) continue;
            const dx = item.x - x, dy = item.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; best = item; }
          }
        }
      }
    }
    return best;
  }
}
