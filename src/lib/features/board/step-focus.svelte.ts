/**
 * How the reminder bank points out the reminders of the night step being walked through
 * (Trevor, 2026-10-17: always on, "only setting is how"), set from the walk-through strip
 * and in Settings, kept on this device:
 * - 'highlight': every reminder in its usual place, the step's ringed and the rest dimmed;
 * - 'only': the step's reminders alone;
 * - 'front': the step's reminders first, ringed (how the bank worked before).
 */
import { readParsed, writeStored } from '#lib/ui/stored.ts';
export interface StepFocus {
	mode: 'highlight' | 'only' | 'front';
}

export const DEFAULT_STEP_FOCUS: StepFocus = { mode: 'front' };
const KEY = 'grim.stepFocus';

/** Reads a saved choice, keeping only valid values. */
export function parseStepFocus(raw: unknown): StepFocus {
	const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	return { mode: value.mode === 'highlight' || value.mode === 'only' ? value.mode : 'front' };
}

function read(): StepFocus {
	return readParsed(KEY, parseStepFocus);
}

class StepFocusStore {
	current = $state<StepFocus>(read());

	update(change: Partial<StepFocus>): void {
		this.current = parseStepFocus({ ...this.current, ...change });
		// Storage blocked: the choice still applies for this visit.
		writeStored(KEY, this.current);
	}
}

export const stepFocus = new StepFocusStore();
