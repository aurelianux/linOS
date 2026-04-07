export function isVacuumActiveState(state: string | undefined): boolean {
  return state === "cleaning" || state === "paused" || state === "returning";
}
