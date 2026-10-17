import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

// Previous games is now History (Trevor, 2026-10-16); old links and bookmarks land there.
export function load() {
	redirect(308, resolve('/history'));
}
