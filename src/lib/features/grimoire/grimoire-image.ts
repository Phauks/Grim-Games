/**
 * The grimoire as a picture, for a finished game's recap (Trevor, 2026-10-19: "a screenshot
 * of the final part of the grim"). Drawn on a canvas from the game itself rather than
 * captured from the screen, so it looks the same on every device: the seats where this
 * device lays them out (`seatPoints`), each character's icon in its player's alignment, the
 * dead shrouded, names under the tokens and reminders in front, as on the board.
 * Colours are the app's theme tokens, read when it is drawn.
 */
import type { Alignment } from '#lib/core/data/index.ts';
import {
	alignmentOf,
	trueCharacter,
	type CharacterLookup,
	type Game
} from '#lib/core/model/index.ts';
import { fallbackIconUrl, iconUrl } from '#lib/features/characters/icon-url.ts';
import { seatPoints, towardsMiddle, type SeatLayout } from '#lib/ui/seating/seat-layout.ts';

/** The picture's side, in canvas pixels: sharp enough to print. */
const SIZE = 1600; /* px-ok: canvas pixels, not CSS */
/** Keeps a shared recap's picture to a few hundred KB. */
const JPEG_QUALITY = 0.85;

function token(name: string, fallback: string): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}

/** An image, or undefined if it can't be loaded or would taint the canvas. */
function loadImage(src: string | undefined): Promise<HTMLImageElement | undefined> {
	if (!src) return Promise.resolve(undefined);
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.referrerPolicy = 'no-referrer';
		img.onload = () => resolve(img);
		img.onerror = () => resolve(undefined);
		img.src = src;
	});
}

/** A character's icon, or its fallback when a homebrew image won't load. */
async function loadIcon(
	src: string | undefined,
	fallback: string | undefined
): Promise<HTMLImageElement | undefined> {
	return (await loadImage(src)) ?? loadImage(fallback);
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** Text that fits `width`, shortened with an ellipsis. */
function fitText(ctx: CanvasRenderingContext2D, text: string, width: number): string {
	if (ctx.measureText(text).width <= width) return text;
	let out = text;
	while (out.length > 1 && ctx.measureText(`${out}…`).width > width) out = out.slice(0, -1);
	return `${out}…`;
}

/**
 * Draws the grimoire and returns it as a PNG, or a JPEG (`type`) where size matters, as in
 * a recap shared over our server. `caption` goes lower left, where the board shows the
 * script's name.
 */
export async function grimoireImage(
	game: Game,
	characters: CharacterLookup,
	layout: SeatLayout,
	caption: string,
	type: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('no 2D canvas');
	const board = { width: SIZE, height: SIZE };
	// The ring inside a margin, leaving the bottom edge for the caption.
	const points = seatPoints(game.seating, layout, board).map((p) => ({
		x: 6 + p.x * 0.88,
		y: 4 + p.y * 0.86
	}));
	const size = Math.min(
		SIZE * 0.14,
		((Math.PI * SIZE * 0.8) / Math.max(game.seating.length, 1)) * 0.6
	);
	const r = size / 2;

	const colours = {
		surface: token('--surface', 'black'),
		ink: token('--on-surface', 'white'),
		muted: token('--on-surface-muted', 'gray'),
		face: token('--token-face', 'white'),
		rim: token('--token-rim', 'gray'),
		good: token('--good', 'blue'),
		evil: token('--evil', 'red'),
		onToken: token('--on-token', 'black'),
		reminder: token('--reminder-face', 'white'),
		onReminder: token('--on-reminder', 'black')
	};
	const fonts = {
		character: token('--font-character', 'serif'),
		reminder: token('--font-reminder', 'serif'),
		player: token('--font-player', 'sans-serif'),
		caption: token('--font-heading', 'serif')
	};

	ctx.fillStyle = colours.surface;
	ctx.fillRect(0, 0, SIZE, SIZE);

	const seats = game.seating.map((seatId) => {
		const characterId = trueCharacter(game, seatId, characters);
		const character = characterId ? characters.get(characterId) : undefined;
		const alignment: Alignment | undefined = alignmentOf(game, seatId);
		return { seatId, seat: game.seats[seatId], character, alignment };
	});
	const icons = await Promise.all(
		seats.map((s) =>
			s.character
				? loadIcon(iconUrl(s.character, s.alignment), fallbackIconUrl(s.character, s.alignment))
				: Promise.resolve(undefined)
		)
	);
	const reminderIcons = await Promise.all(
		seats.map((s) =>
			Promise.all(
				s.seat.reminders.map((rem) => {
					const c = characters.get(rem.characterId);
					return c ? loadIcon(iconUrl(c), fallbackIconUrl(c)) : Promise.resolve(undefined);
				})
			)
		)
	);

	seats.forEach((s, i) => {
		const x = (points[i].x / 100) * SIZE;
		const y = (points[i].y / 100) * SIZE;

		// Reminders in front of the seat, towards the middle.
		const rr = r * 0.42;
		const spots = towardsMiddle(
			points[i],
			board,
			s.seat.reminders.map((_, k) => r + rr * 1.2 + k * rr * 2.1)
		);
		s.seat.reminders.forEach((rem, k) => {
			const px = (spots[k].x / 100) * SIZE;
			const py = (spots[k].y / 100) * SIZE;
			circle(ctx, px, py, rr);
			ctx.fillStyle = colours.reminder;
			ctx.fill();
			const icon = reminderIcons[i][k];
			if (icon) ctx.drawImage(icon, px - rr * 0.7, py - rr * 0.95, rr * 1.4, rr * 1.4);
			ctx.fillStyle = colours.onReminder;
			ctx.font = `${Math.round(rr * 0.42)}px ${fonts.reminder}`;
			ctx.textAlign = 'center';
			ctx.fillText(fitText(ctx, rem.label, rr * 1.8), px, py + rr * 0.7);
		});

		// The token.
		circle(ctx, x, y, r);
		ctx.fillStyle = colours.face;
		ctx.fill();
		ctx.lineWidth = r * 0.08;
		ctx.strokeStyle =
			s.alignment === 'good' ? colours.good : s.alignment === 'evil' ? colours.evil : colours.rim;
		ctx.stroke();
		const icon = icons[i];
		if (icon) ctx.drawImage(icon, x - r * 0.8, y - r * 0.9, r * 1.6, r * 1.6);
		if (s.character) {
			ctx.fillStyle = colours.onToken;
			ctx.font = `bold ${Math.round(r * 0.24)}px ${fonts.character}`;
			ctx.textAlign = 'center';
			ctx.fillText(fitText(ctx, s.character.name, r * 1.6), x, y + r * 0.72);
		}
		// The dead: a dark shroud over the token, as on the board.
		if (s.seat.dead) {
			circle(ctx, x, y, r);
			ctx.globalAlpha = 0.55;
			ctx.fillStyle = colours.surface;
			ctx.fill();
			ctx.globalAlpha = 1;
		}

		// The player's name under the token.
		const name = s.seat.playerName ?? `Seat ${i + 1}`;
		ctx.fillStyle = s.seat.dead ? colours.muted : colours.ink;
		ctx.font = `${Math.round(r * 0.42)}px ${fonts.player}`;
		ctx.textAlign = 'center';
		ctx.fillText(fitText(ctx, name, size * 1.4), x, y + r + r * 0.42);
	});

	ctx.fillStyle = colours.ink;
	ctx.font = `${Math.round(SIZE * 0.028)}px ${fonts.caption}`;
	ctx.textAlign = 'left';
	ctx.fillText(fitText(ctx, caption, SIZE * 0.9), SIZE * 0.03, SIZE * 0.97);

	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('no image'))),
			type,
			JPEG_QUALITY
		)
	);
}

/** A blob as a data URL, to embed in the recap file. */
export function dataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('could not read the image'));
		reader.readAsDataURL(blob);
	});
}
