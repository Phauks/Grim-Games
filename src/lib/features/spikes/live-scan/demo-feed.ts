/**
 * A pretend camera for the live scan spike: a printed script sheet on a table, moved about
 * the way a hand holds a phone (a second or two of moving, then a few seconds held still),
 * with a small constant shake and a patch of glare that shifts as it moves, like a laminated sheet under a lamp
 * (Trevor, 2026-11-10). It lets the spike be tried on a computer with no camera, with a drawn
 * sheet or any picture of one (Trevor, 2026-11-10: "Test with this").
 */

/** A character row on the drawn sheet. */
export interface SheetRow {
	name: string;
	ability: string;
}

/** Where the sheet sits in the picture: offset from the middle, turn in degrees, and size. */
interface Pose {
	x: number;
	y: number;
	turn: number;
	scale: number;
}

const POSES: Pose[] = [
	{ x: 0, y: 0, turn: -2, scale: 0.86 },
	{ x: 24, y: -20, turn: 3, scale: 0.84 },
	{ x: -22, y: 16, turn: -4, scale: 0.88 },
	{ x: 16, y: 22, turn: 1, scale: 0.82 },
	{ x: -14, y: -22, turn: 4, scale: 0.86 }
];
/** Each pose: moving for MOVE_MS, then held still until the next. */
const MOVE_MS = 1600;
const POSE_MS = 5600;

/** The sheet's colours: a drawn photo of paper on a wooden table, not theme colours. */
const PAPER = 'rgb(239, 230, 207)'; // colour-ok: a drawn photo of a printed sheet
const INK = 'rgb(38, 32, 26)'; // colour-ok: a drawn photo of a printed sheet
const TABLE = 'rgb(74, 58, 43)'; // colour-ok: a drawn photo of a wooden table

/** Draws the sheet once, at print size: the title, then each character's name and ability. */
export function drawSheet(title: string, rows: readonly SheetRow[]): HTMLCanvasElement {
	const width = 960;
	const sheet = document.createElement('canvas');
	const measure = sheet.getContext('2d')!;
	measure.font = '18px Georgia, serif';
	const wrap = (text: string, room: number) => {
		const lines: string[] = [];
		let line = '';
		for (const word of text.split(' ')) {
			const next = line ? `${line} ${word}` : word;
			if (measure.measureText(next).width > room && line) {
				lines.push(line);
				line = word;
			} else line = next;
		}
		return line ? [...lines, line] : lines;
	};
	const laid = rows.map((r) => ({ ...r, lines: wrap(r.ability, width - 280) }));
	const height = 120 + laid.reduce((sum, r) => sum + Math.max(1, r.lines.length) * 23 + 14, 0) + 30;
	sheet.width = width;
	sheet.height = height;
	const ctx = sheet.getContext('2d')!;
	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = INK;
	ctx.textBaseline = 'top';
	ctx.textAlign = 'center';
	ctx.font = 'bold 50px Georgia, serif';
	ctx.fillText(title, width / 2, 36);
	ctx.textAlign = 'left';
	let y = 120;
	for (const r of laid) {
		ctx.font = 'bold 22px Georgia, serif';
		ctx.fillText(r.name, 40, y - 2);
		ctx.font = '18px Georgia, serif';
		r.lines.forEach((line, i) => ctx.fillText(line, 240, y + i * 23));
		y += Math.max(1, r.lines.length) * 23 + 14;
	}
	return sheet;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** A picture of a sheet (a photo or a scan) as a sheet to move about. */
export async function pictureSheet(file: Blob): Promise<HTMLCanvasElement> {
	const bitmap = await createImageBitmap(file);
	const sheet = document.createElement('canvas');
	sheet.width = bitmap.width;
	sheet.height = bitmap.height;
	sheet.getContext('2d')!.drawImage(bitmap, 0, 0);
	bitmap.close();
	return sheet;
}

/** The pretend camera: `draw(now)` paints the frame for that moment on `canvas`. */
export function demoFeed(sheet: HTMLCanvasElement) {
	const canvas = document.createElement('canvas');
	canvas.width = 900;
	canvas.height = 1200;
	const ctx = canvas.getContext('2d')!;
	const started = performance.now();
	return {
		canvas,
		draw(now: number) {
			// A frame's time can be a little before this feed was made.
			const elapsed = Math.max(0, now - started);
			const step = Math.floor(elapsed / POSE_MS);
			const into = Math.min(1, (elapsed % POSE_MS) / MOVE_MS);
			const from = POSES[step % POSES.length];
			const to = POSES[(step + 1) % POSES.length];
			const k = ease(into);
			const pose: Pose = {
				x: from.x + (to.x - from.x) * k,
				y: from.y + (to.y - from.y) * k,
				turn: from.turn + (to.turn - from.turn) * k,
				scale: from.scale + (to.scale - from.scale) * k
			};
			// A hand never holds quite still (Trevor, 2026-11-10): a small, constant shake.
			pose.x += 3 * Math.sin(elapsed / 83);
			pose.y += 3 * Math.cos(elapsed / 97);
			pose.turn += 0.2 * Math.sin(elapsed / 131);
			ctx.fillStyle = TABLE;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.save();
			ctx.translate(canvas.width / 2 + pose.x, canvas.height / 2 + pose.y);
			ctx.rotate((pose.turn * Math.PI) / 180);
			// As big as fits with the table showing round it, so its corners can be found.
			const size = Math.min(pose.scale, 1120 / sheet.height, 840 / sheet.width);
			ctx.scale(size, size);
			ctx.drawImage(sheet, -sheet.width / 2, -sheet.height / 2);
			ctx.restore();
			// The lamp's reflection: it stays put in the room, so it slides over the sheet.
			const gx = canvas.width / 2 - pose.x * 4 + 60;
			const gy = canvas.height * 0.42 - pose.y * 4;
			const glare = ctx.createRadialGradient(gx, gy, 0, gx, gy, 110);
			glare.addColorStop(0, 'rgba(255,255,255,1)'); // colour-ok: drawn lamp glare
			glare.addColorStop(0.55, 'rgba(255,255,255,0.95)'); // colour-ok: drawn lamp glare
			glare.addColorStop(1, 'rgba(255,255,255,0)'); // colour-ok: drawn lamp glare
			ctx.fillStyle = glare;
			ctx.fillRect(gx - 115, gy - 115, 230, 230);
		}
	};
}
