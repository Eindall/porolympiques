/** Les dates sont stockées en UTC et affichées (ou saisies) en heure de Paris, quel que soit le fuseau du navigateur. */
const ZONE = 'Europe/Paris';

const DISPLAY = new Intl.DateTimeFormat('fr-FR', { timeZone: ZONE, dateStyle: 'medium', timeStyle: 'short' });
const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** « 2 févr. 2026, 18:00 », en heure de Paris. */
export function formatParis(iso: string | null): string {
  return iso ? DISPLAY.format(new Date(iso)) : '';
}

/** Date ISO → valeur d'un `<input type="datetime-local">` en heure de Paris (« 2026-02-02T18:00 »). */
export function toParisInput(iso: string | null): string {
  if (!iso) return '';
  const parts = Object.fromEntries(PARTS.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts['year']}-${parts['month']}-${parts['day']}T${parts['hour']}:${parts['minute']}`;
}

/** Valeur d'un `<input type="datetime-local">`, lue en heure de Paris → date ISO en UTC. Vide : `null`. */
export function fromParisInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Décalage de Paris à cette date (1 h l'hiver, 2 h l'été), recalculé une fois pour les changements d'heure.
  let utc = wall - offsetAt(wall);
  utc = wall - offsetAt(utc);
  return new Date(utc).toISOString();
}

function offsetAt(utc: number): number {
  const parts = Object.fromEntries(PARTS.formatToParts(new Date(utc)).map((part) => [part.type, Number(part.value)]));
  return Date.UTC(parts['year'], parts['month'] - 1, parts['day'], parts['hour'], parts['minute']) - Math.floor(utc / 60_000) * 60_000;
}

const DAY = new Intl.DateTimeFormat('fr-FR', { timeZone: ZONE, dateStyle: 'medium' });

/** « 2 févr. 2026 », en heure de Paris. */
export function formatParisDate(iso: string | null): string {
  return iso ? DAY.format(new Date(iso)) : '';
}
