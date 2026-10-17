/**
 * How the board looks on this device, for every game (Trevor, 2026-10-17), shown beside the
 * background where it takes effect and in Settings:
 * - the vignette, the soft dark oval behind the script's name over a background, which keeps
 *   the words readable, and how dark it is;
 * - where the Fabled and Loric sit: large in the middle, or small along the board's edge;
 * - how big each seat's player name badge is;
 * - whether reminders are held by their seat or stay where they are dropped.
 */
export interface BoardLooks {
	vignette: boolean;
	/** How dark the vignette's middle is, 0 to 1. */
	vignetteStrength: number;
	rulesAt: 'middle' | 'edge';
	/** The player name badge's size, as a multiple of its usual size. */
	nameSize: number;
	/**
	 * 'seat': reminders sit around their seat, laid out so none overlap. 'free' (Trevor,
	 * 2026-10-17, "nonsticky"): a reminder stays where it is dropped; it still belongs to a seat.
	 */
	reminders: 'seat' | 'free';
}

/** The player name badge's size range (Trevor, 2026-10-17: "should be an option"). */
export const NAME_SIZE = { min: 0.6, max: 1.6, step: 0.1 } as const;

export const DEFAULT_BOARD_LOOKS: BoardLooks = {
	vignette: true,
	vignetteStrength: 0.55,
	rulesAt: 'middle',
	nameSize: 1,
	reminders: 'seat'
};
const KEY = 'grim.boardLooks';

/** Reads saved looks, keeping only valid values. */
export function parseBoardLooks(raw: unknown): BoardLooks {
	const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const strength = Number(value.vignetteStrength);
	const nameSize = Number(value.nameSize);
	return {
		vignette: value.vignette !== false,
		vignetteStrength: Number.isFinite(strength)
			? Math.min(1, Math.max(0, strength))
			: DEFAULT_BOARD_LOOKS.vignetteStrength,
		rulesAt: value.rulesAt === 'edge' ? 'edge' : 'middle',
		nameSize: Number.isFinite(nameSize)
			? Math.min(NAME_SIZE.max, Math.max(NAME_SIZE.min, nameSize))
			: DEFAULT_BOARD_LOOKS.nameSize,
		reminders: value.reminders === 'free' ? 'free' : 'seat'
	};
}

function read(): BoardLooks {
	try {
		return parseBoardLooks(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null'));
	} catch {
		return { ...DEFAULT_BOARD_LOOKS };
	}
}

class BoardLooksStore {
	current = $state<BoardLooks>(read());

	update(change: Partial<BoardLooks>): void {
		this.current = parseBoardLooks({ ...this.current, ...change });
		try {
			globalThis.localStorage?.setItem(KEY, JSON.stringify(this.current));
		} catch {
			// Storage blocked: the choice still applies for this visit.
		}
	}
}

export const boardLooks = new BoardLooksStore();
