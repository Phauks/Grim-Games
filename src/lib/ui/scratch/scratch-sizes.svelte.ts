/**
 * The pen and eraser sizes last chosen, remembered on this device only. Storage can be
 * missing or throw; then the sizes last until reload.
 */
import { parseSizes, type ScratchTool } from '#lib/core/scratch/scratch.ts';

const KEY = 'grim-games:scratch-sizes';

function read(): Record<ScratchTool, number> {
	try {
		const raw = globalThis.localStorage?.getItem(KEY);
		return parseSizes(raw ? JSON.parse(raw) : undefined);
	} catch {
		return parseSizes(undefined);
	}
}

/** Slider steps per tool (1 to SIZE_STEPS), shared by every scratch pad. */
export const scratchSizes = $state(read());

export function setScratchSize(tool: ScratchTool, step: number) {
	scratchSizes[tool] = step;
	try {
		globalThis.localStorage?.setItem(KEY, JSON.stringify(scratchSizes));
	} catch {
		/* kept until reload */
	}
}
