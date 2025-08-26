export class GarbageCollector {
  private readonly routines: (() => void)[] = [];

  defer(fn: () => void): void {
    this.routines.push(fn);
  }

  release(): void {
    while (this.routines.length > 0) this.routines.pop()?.();
  }
}
