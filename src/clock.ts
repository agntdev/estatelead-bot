let clock: () => Date = () => new Date();

export function now(): Date {
  return clock();
}

export function setClockForTests(value: () => Date): void {
  clock = value;
}
