/** Convert hours (from frontend) to seconds for storage. */
export function hoursToSeconds(hours: number): number {
  return Math.round(hours * 3600);
}
