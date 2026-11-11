/**
 * The Storyteller's changes to a game's generated day reminders and night steps, stored with
 * the game. They sit in the model, below the rules that apply them (`rules/day-reminders.ts`,
 * `rules/night-order.ts`), so the model never imports the rules.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { DayGroup } from '#lib/core/data/day-reminder-rules.ts';
import type { InfoTokenCharacterRules } from '#lib/core/data/parts/info-token-characters.ts';
import type { SeatId } from '#lib/core/model/types.ts';

/** Which night: the first night or any other. */
export type Night = 'first' | 'other';

/**
 * A Storyteller override, stored with the game:
 * - `hide`: drop a generated reminder (by its `key`);
 * - `edit`: keep the reminder's character badge but replace the rest with `text`;
 * - `add`: a reminder of the Storyteller's own, optionally about a character or seat.
 */
export type DayReminderOverride =
	| { kind: 'hide'; key: string }
	| { kind: 'edit'; key: string; text: string }
	| {
			kind: 'add';
			/** The Storyteller's own key, unique among overrides ("custom-1"). */
			key: string;
			group: DayGroup;
			text: string;
			characterId?: CharacterId;
			seatId?: SeatId;
	  };

/**
 * A Storyteller override of the night order, stored with the game. `night` limits it to
 * the first night or to other nights; without it, it applies to both. `after` is the id of
 * the step to follow (`null`: first, before everything else).
 * - `hide`: leave a step out (it is listed in `omitted`);
 * - `edit`: replace a step's text;
 * - `move`: put a step after another;
 * - `add`: a step of the Storyteller's own, with their own unique `id`.
 */
export type NightStepOverride =
	| { kind: 'hide'; id: string; night?: Night }
	| { kind: 'edit'; id: string; text: string; night?: Night }
	| { kind: 'move'; id: string; after: string | null; night?: Night }
	| {
			kind: 'add';
			id: string;
			text: string;
			/** Short heading for a step with no character. */
			title?: string;
			characterId?: CharacterId;
			/** The step's own info token fills (`NightStep.infoTokenCharacters`). */
			infoTokenCharacters?: InfoTokenCharacterRules;
			after: string | null;
			night?: Night;
	  };
