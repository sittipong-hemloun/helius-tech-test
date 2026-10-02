/** Injectable time source so date rules (Bangkok business day) can be tested with a fake clock. */
export abstract class Clock {
  abstract now(): Date;
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

export class FakeClock extends Clock {
  constructor(private current: Date = new Date()) {
    super();
  }
  now(): Date {
    return new Date(this.current.getTime());
  }
  set(date: Date | string): void {
    this.current = new Date(date);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
