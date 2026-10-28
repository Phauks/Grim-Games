/** Lower case with accents removed, so "fée" finds "Fee" and "LIL" finds "Lil' Monsta". */
export function foldForSearch(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
