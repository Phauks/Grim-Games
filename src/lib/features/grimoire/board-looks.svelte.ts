import {
	DEFAULT_REMINDER_LINES,
	parseReminderLines,
	type ReminderLines
} from './reminder-lines.ts';

/**
 * How the board looks on this device, for every game (Trevor, 2026-10-17), shown beside the
 * background where it takes effect and in Settings:
 * - the vignette, which darkens a background image towards the board's edges (Trevor,
 *   2026-10-18: the old oval behind the script's name was too faint to notice once the name
 *   moved to the corner), and how dark it is;
 * - the script's logo faint in the middle of the board, and how faint (Trevor, 2026-10-18);
 * - how big each seat's player name badge is, and how far below the token it sits;
 * - whether reminders are held by their seat or stay where they are dropped;
 * - how a dead player's used ghost vote looks on their badge;
 * - the frame round seat tokens whose player has not picked their own (L4);
 * - which reminders light up while a seat's token is held;
 * - when a reminder shows its line back to its seat (reminder-lines.ts);
 * - how a seat shows an ability it holds without its token (the Boffin's good character).
 */
export interface BoardLooks {
	vignette: boolean;
	/** How dark the vignette's edges are, 0 to 1. */
	vignetteStrength: number;
	/** The script's logo in the middle of the board, behind the seats. */
	logo: boolean;
	/** How visible that logo is, 0.05 to 1. */
	logoOpacity: number;
	/** The player name badge's size, as a multiple of its usual size. */
	nameSize: number;
	/**
	 * How far the player name badge moves down from the token's rim, as a share of the
	 * token's size (Trevor, 2026-10-18: clear of the character name on the token).
	 */
	nameOffset: number;
	/**
	 * 'seat': reminders sit around their seat, laid out so none overlap. 'free' (Trevor,
	 * 2026-10-17, "nonsticky"): a reminder stays where it is dropped; it still belongs to a seat.
	 */
	reminders: 'seat' | 'free';
	/**
	 * A used ghost vote: a grey outline ghost ('hollow'), or the ghost struck through in red
	 * ('struck') (Trevor, 2026-10-19: both looks, picked in Settings).
	 */
	usedGhostVote: 'hollow' | 'struck';
	/** When a reminder shows its line back to its seat (Trevor, 2026-10-29). */
	reminderLines: ReminderLines;
	/**
	 * An ability a seat holds without its token (Trevor, 2026-10-30: "Vanilla, or Grimbound
	 * style"): 'grimbinder' puts a small token in the pill over the seat's bottom-right rim;
	 * 'vanilla' puts the character's token beside the seat, among its reminders, as the wiki
	 * runs it.
	 */
	abilityLook: 'grimbinder' | 'vanilla';
}

/** The player name badge's size range (Trevor, 2026-10-17: "should be an option"). */
export const NAME_SIZE = { min: 0.6, max: 1.6, step: 0.1 } as const;
/** How far the badge can move down, from on the rim to clear of the token's name. */
export const NAME_OFFSET = { min: 0, max: 0.3, step: 0.02 } as const;

/** The script logo's opacity range: never fully invisible while it is switched on. */
export const LOGO_OPACITY = { min: 0.05, max: 1, step: 0.05 } as const;

export const DEFAULT_BOARD_LOOKS: BoardLooks = {
	vignette: true,
	vignetteStrength: 0.55,
	logo: true,
	logoOpacity: 0.3,
	nameSize: 1,
	nameOffset: 0,
	reminders: 'seat',
	usedGhostVote: 'hollow',
	reminderLines: DEFAULT_REMINDER_LINES,
	abilityLook: 'grimbinder'
};
const KEY = 'grim.boardLooks';

/** Reads saved looks, keeping only valid values. */
export function parseBoardLooks(raw: unknown): BoardLooks {
	const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const strength = Number(value.vignetteStrength);
	const nameSize = Number(value.nameSize);
	const nameOffset = Number(value.nameOffset);
	const logoOpacity = Number(value.logoOpacity);
	return {
		vignette: value.vignette !== false,
		vignetteStrength: Number.isFinite(strength)
			? Math.min(1, Math.max(0, strength))
			: DEFAULT_BOARD_LOOKS.vignetteStrength,
		logo: value.logo !== false,
		logoOpacity: Number.isFinite(logoOpacity)
			? Math.min(LOGO_OPACITY.max, Math.max(LOGO_OPACITY.min, logoOpacity))
			: DEFAULT_BOARD_LOOKS.logoOpacity,
		nameSize: Number.isFinite(nameSize)
			? Math.min(NAME_SIZE.max, Math.max(NAME_SIZE.min, nameSize))
			: DEFAULT_BOARD_LOOKS.nameSize,
		nameOffset: Number.isFinite(nameOffset)
			? Math.min(NAME_OFFSET.max, Math.max(NAME_OFFSET.min, nameOffset))
			: DEFAULT_BOARD_LOOKS.nameOffset,
		reminders: value.reminders === 'free' ? 'free' : 'seat',
		usedGhostVote: value.usedGhostVote === 'struck' ? 'struck' : 'hollow',
		reminderLines: parseReminderLines(value.reminderLines),
		abilityLook: value.abilityLook === 'vanilla' ? 'vanilla' : 'grimbinder'
		// Earlier builds' `reminderStacks` switch is dropped: every reminder is always on the
		// board (Trevor, 2026-10-23). So is `dragSource`: a dragged reminder no longer names
		// where it came from (Trevor, 2026-10-24). `holdLights` and `holdMoves` too: holding a
		// seat's token only moves it now (Trevor, 2026-10-26). `defaultFrame` too: frames are
		// laurel forms each player picks, with no board default (Trevor, 2026-10-27). `rulesAt` too:
		// the Fabled and Loric always sit in the corner, never the middle (Trevor, 2026-10-30).
		// `rulesGrouped` too: the Fabled and the Loric are always two stacks (Trevor, 2026-10-31).
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
