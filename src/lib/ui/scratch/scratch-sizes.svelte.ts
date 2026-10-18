/**
 * The pen and eraser sizes last chosen, remembered on this device only. Storage can be
 * missing or throw; then the sizes last until reload.
 */
import { parseSizes, type ScratchTool } from '#lib/core/scratch/scratch.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

const KEY = 'grim-games:scratch-sizes';

function read(): Record<ScratchTool, number> {
	return parseSizes(readStored(KEY));
}

/** Slider steps per tool (1 to SIZE_STEPS), shared by every scratch pad. */
export const scratchSizes = $state(read());

export function setScratchSize(tool: ScratchTool, step: number) {
	scratchSizes[tool] = step;
	// If storage is blocked, kept until reload.
	writeStored(KEY, scratchSizes);
}
