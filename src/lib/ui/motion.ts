import { quartOut } from 'svelte/easing';
import { fly, type TransitionConfig } from 'svelte/transition';

/** The motion tokens in `tokens/base.css`; `none` means no motion. */
export type Speed = 'fast' | 'normal' | 'slow' | 'none';

/** A CSS time (`240ms`, `0.3s`) in milliseconds; anything unreadable is 0. */
export function parseDuration(value: string): number {
	const text = value.trim();
	const amount = parseFloat(text);
	if (!Number.isFinite(amount) || amount < 0) return 0;
	return text.endsWith('ms') ? amount : text.endsWith('s') ? amount * 1000 : 0;
}

/**
 * A motion token's length in milliseconds, read from the stylesheet so script-driven motion
 * matches the CSS and is 0 when the device asks for reduced motion (base.css sets the tokens
 * to 0ms then).
 */
export function duration(speed: Speed = 'normal'): number {
	if (speed === 'none' || typeof document === 'undefined') return 0;
	const style = getComputedStyle(document.documentElement);
	return parseDuration(style.getPropertyValue(`--duration-${speed}`));
}

export interface RiseParams {
	/** Where it comes from, as a CSS length (`1rem`) or px number; negative is above or left. */
	x?: number | string;
	y?: number | string;
	speed?: Speed;
	delay?: number;
}

/**
 * The app's one entrance and exit: a short move plus a fade. It only changes transform and
 * opacity, so nothing around it moves (Trevor's no-reflow rule); reserve the element's space
 * in the layout and let `rise` animate what fills it.
 */
export function rise(
	node: Element,
	{ x = 0, y = '1rem', speed = 'normal', delay = 0 }: RiseParams = {}
): TransitionConfig {
	return fly(node, { x, y, delay, duration: duration(speed), easing: quartOut, opacity: 0 });
}
