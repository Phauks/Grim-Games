import { getContext, setContext } from 'svelte';

/**
 * The scene's clock, shared by its parts: seconds of motion (they stop while the scene is
 * held still) and how much of the screen's sharpness the smoky layer is drawn at.
 */
export interface SceneClock {
	t: number;
	/** 0.35 to 1: lowered while frames are missed, so the frame rate holds (MovingScene). */
	bgScale: number;
}

const KEY = Symbol('moving-clock');

/**
 * A moment into the scene, so a scene held still shows its sparks and drops spread out
 * rather than all at their start.
 */
const STILL_MOMENT = 12;

export function provideClock(): SceneClock {
	const clock: SceneClock = { t: STILL_MOMENT, bgScale: 1 };
	setContext(KEY, clock);
	return clock;
}

export const useClock = (): SceneClock => getContext<SceneClock>(KEY);
