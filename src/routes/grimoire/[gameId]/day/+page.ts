import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { DAY_HASH } from '#lib/features/day/day-hash.ts';

// The day is a sheet over the board now (Trevor, 2026-10-16); old links open it there.
export const load = ({ params }: { params: { gameId: string } }) => {
	redirect(307, resolve('/grimoire/[gameId]', { gameId: params.gameId }) + DAY_HASH);
};
