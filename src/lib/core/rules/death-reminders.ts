/**
 * Reminders that say a player has died: "Dead" (the Imp's, Gossip's, Tinker's and most
 * Demons') and "Died Today" (the Undertaker's, Godfather's, Zombuul's). Placing one on a
 * living player is the moment to ask whether to mark them dead (Trevor, 2026-10-19). Ones
 * that only threaten a death ("About To Die") or prevent one ("Cannot Die") never ask.
 */
const MARKS_DEATH = new Set(['dead', 'died today']);

export function marksDeath(label: string): boolean {
	return MARKS_DEATH.has(label.trim().toLowerCase());
}
