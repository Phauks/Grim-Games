import { prefersReducedMotion } from 'svelte/motion';
import { preferences } from './preferences.svelte.ts';

/**
 * Whether the app animates on this device (Trevor, 2026-11-16): the one Animations setting,
 * the same for players, Storytellers and spectators. Match device follows the device's
 * Reduce motion; On and Off decide it whatever the device says.
 */
export function animationsOn(): boolean {
	const choice = preferences.current.animations;
	return choice === 'device' ? !prefersReducedMotion.current : choice === 'on';
}

/**
 * Marks `<html>` with `data-motion-off` while animations are off. Every style that moves
 * checks this one mark (`:root[data-motion-off]`), never the device's media query, so the
 * setting stops them all; script-driven motion reads `animationsOn()`.
 */
export function markMotion(root: HTMLElement = document.documentElement): void {
	root.toggleAttribute('data-motion-off', !animationsOn());
}
