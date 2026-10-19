/**
 * A finished game's recap (Trevor, 2026-10-19: "allow exporting a history log of the game,
 * along with a screenshot of the final part of the grim. include any notes taken by the
 * storyteller"), and the self-contained HTML file it saves as: one file that opens in any
 * browser and prints, with the grimoire image embedded.
 *
 * Everything is plain text by the time it gets here: the caller words each line, so this
 * file only lays it out and escapes it. The parts are chosen one by one (`RecapParts`), so
 * the same recap can later be shared with players without the Storyteller's notes.
 *
 * Seats keep their game seat id, and leave room for a linked account (Trevor, 2026-10-19:
 * a player may later add a shared recap to their profile and claim their seat if nobody
 * linked it yet). Nothing fills those fields until profiles exist.
 */
import type { Alignment } from '#lib/core/data/types.ts';
import type { SeatId } from '#lib/core/model/types.ts';
import { PRINT_PALETTE } from '#lib/ui/themes/print.ts';
import { IMAGE_DATA } from './recap-share-api.ts';

export interface RecapCharacter {
	name: string;
	alignment?: Alignment;
}

export interface RecapSeat {
	/** The game's seat id: stable, so a profile can point at this seat later. */
	seatId: SeatId;
	/** 1-based, in seating order. */
	number: number;
	name: string;
	/** At the first Dawn, if different from the end. */
	start?: RecapCharacter;
	end?: RecapCharacter;
	dead: boolean;
	/** How they died, worded ("Executed"). */
	death?: string;
	/** The account the Storyteller linked to this seat (not set yet). */
	accountId?: string;
	/** The account that claimed this seat from a shared recap (not set yet). */
	claimedBy?: string;
}

export interface RecapLine {
	/** When, worded ("8:42 PM"). */
	time: string;
	text: string;
}

export interface RecapNote {
	/** Who or what it is about ("Ana (Gossip)", "Day 2"). */
	about: string;
	text: string;
}

export interface GameRecap {
	title: string;
	author?: string;
	/** When it was played, worded. */
	played: string;
	/** "Good won", "Evil won" or "Winner not recorded". */
	result: string;
	/** How it ended, worded ("Saint"), when recorded. */
	howEnded?: string;
	days: number;
	seats: RecapSeat[];
	/** The history log, oldest first. */
	log: RecapLine[];
	/** The Storyteller's notes: seat notes, then day log notes, in order. */
	notes: RecapNote[];
}

/** Which parts go in. Notes are the Storyteller's private ones. */
export interface RecapParts {
	log: boolean;
	image: boolean;
	notes: boolean;
}

export const ALL_RECAP_PARTS: RecapParts = { log: true, image: true, notes: true };

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

/** Text made safe for HTML content and attribute values. */
export function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function character(c: RecapCharacter | undefined): string {
	if (!c) return '';
	const team = c.alignment ? ` data-team="${c.alignment}"` : '';
	return `<span class="character"${team}>${escapeHtml(c.name)}</span>`;
}

function seatRow(seat: RecapSeat): string {
	const was =
		seat.start && seat.start.name !== seat.end?.name
			? ` <span class="was">(started as ${character(seat.start)})</span>`
			: '';
	const fate = seat.dead ? escapeHtml(seat.death ?? 'Dead') : 'Alive';
	return `<tr${seat.dead ? ' class="dead"' : ''}><td>${seat.number}</td><td>${escapeHtml(seat.name)}</td><td>${character(seat.end)}${was}</td><td>${fate}</td></tr>`;
}

/** Image data URLs only: anything else stays out of the file. */
const isImageData = (url: string | undefined): url is string =>
	url !== undefined && IMAGE_DATA.test(url);

/**
 * The recap as one HTML file. `image` is the grimoire as a data URL, left out unless
 * `parts.image` is on. Colours and fonts are the file's own, so it prints on white.
 */
export function recapHtml(recap: GameRecap, parts: RecapParts, image?: string): string {
	const sections: string[] = [];
	const summary = [recap.result, recap.howEnded ? `How it ended: ${recap.howEnded}` : undefined]
		.filter(Boolean)
		.map((s) => escapeHtml(s!))
		.join(' · ');
	sections.push(
		`<header><h1>${escapeHtml(recap.title)}</h1>` +
			(recap.author ? `<p class="author">by ${escapeHtml(recap.author)}</p>` : '') +
			`<p>${escapeHtml(recap.played)} · ${recap.days} ${recap.days === 1 ? 'day' : 'days'}</p>` +
			`<p class="result">${summary}</p></header>`
	);
	if (parts.image && isImageData(image)) {
		sections.push(
			`<section><h2>Grimoire</h2><img src="${image}" alt="The grimoire at the end of the game"></section>`
		);
	}
	sections.push(
		`<section><h2>Players</h2><table><thead><tr><th>Seat</th><th>Player</th><th>Character</th><th>End</th></tr></thead><tbody>${recap.seats.map(seatRow).join('')}</tbody></table></section>`
	);
	if (parts.log) {
		const lines = recap.log.length
			? recap.log
					.map((l) => `<li><time>${escapeHtml(l.time)}</time> ${escapeHtml(l.text)}</li>`)
					.join('')
			: '<li>None</li>';
		sections.push(`<section><h2>History</h2><ol class="log">${lines}</ol></section>`);
	}
	if (parts.notes) {
		const notes = recap.notes.length
			? recap.notes
					.map((n) => `<li><strong>${escapeHtml(n.about)}</strong> ${escapeHtml(n.text)}</li>`)
					.join('')
			: '<li>None</li>';
		sections.push(`<section><h2>Storyteller notes</h2><ul class="notes">${notes}</ul></section>`);
	}
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(recap.title)}</title>
<style>${RECAP_STYLE}</style>
</head>
<body>
${sections.join('\n')}
</body>
</html>
`;
}

const RECAP_STYLE = `
${Object.entries(PRINT_PALETTE)
	.map(([k, v]) => `:root { --${k}: ${v}; }`)
	.join('\n')}
body { font-family: Georgia, serif; max-width: 48rem; margin: 0 auto; padding: 1rem; color: var(--ink); background: var(--paper); line-height: 1.4; }
h1 { margin: 0; } h2 { margin-top: 1.5rem; border-bottom: 0.0625rem solid var(--rule); }
.author, header p { margin: 0.25rem 0; } .result { font-weight: bold; }
img { width: 100%; height: auto; border-radius: 0.5rem; }
table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 0.25rem 0.5rem; border-bottom: 0.0625rem solid var(--faint); }
tr.dead td, .was, time { color: var(--muted); }
.character { font-weight: bold; } .character[data-team='good'] { color: var(--good); } .character[data-team='evil'] { color: var(--evil); }
.was { font-size: 0.9em; }
ol.log, ul.notes { padding-left: 1.25rem; } time { font-variant-numeric: tabular-nums; }
@media print { img { break-inside: avoid; } }
`;
