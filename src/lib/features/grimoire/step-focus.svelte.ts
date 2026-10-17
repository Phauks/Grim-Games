/**
 * How the reminder bank points out the reminders of the night step being walked through
 * (Trevor, 2026-10-17), set from the walk-through strip and kept on this device:
 * - off: the bank as usual;
 * - 'highlight': every reminder in its usual place, the step's ringed and the rest dimmed;
 * - 'only': the step's reminders alone;
 * - 'front': the step's reminders first, ringed (how the bank worked before).
 */
export interface StepFocus {
	on: boolean;
	mode: 'highlight' | 'only' | 'front';
}

export const DEFAULT_STEP_FOCUS: StepFocus = { on: true, mode: 'front' };
const KEY = 'grim.stepFocus';

/** Reads a saved choice, keeping only valid values. */
export function parseStepFocus(raw: unknown): StepFocus {
	const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	return {
		on: value.on !== false,
		mode: value.mode === 'highlight' || value.mode === 'only' ? value.mode : 'front'
	};
}

function read(): StepFocus {
	try {
		return parseStepFocus(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null'));
	} catch {
		return { ...DEFAULT_STEP_FOCUS };
	}
}

class StepFocusStore {
	current = $state<StepFocus>(read());

	update(change: Partial<StepFocus>): void {
		this.current = parseStepFocus({ ...this.current, ...change });
		try {
			globalThis.localStorage?.setItem(KEY, JSON.stringify(this.current));
		} catch {
			// Storage blocked: the choice still applies for this visit.
		}
	}
}

export const stepFocus = new StepFocusStore();
