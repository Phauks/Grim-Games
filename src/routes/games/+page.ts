import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

// Resume game is part of Join game's page now (Trevor, 2026-10-28); old links land there.
export function load() {
	redirect(308, resolve('/join'));
}
