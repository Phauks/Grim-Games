import type { ScriptVoteKind, ScriptVoteTally } from '#lib/core/sync/script-vote.ts';
import { t } from '#lib/i18n/locale.svelte.ts';

/**
 * One option's line in the script vote's count, the same on the Storyteller's sheet and on a
 * phone the Storyteller lets see it (Trevor, 2026-10-26): its votes, or for a ranked vote's
 * instant runoff the round it went out in, or that it won.
 */
export function scriptVoteCountLabel(
	kind: ScriptVoteKind,
	tally: Pick<ScriptVoteTally, 'points' | 'out' | 'winner'>,
	id: string
): string {
	const count = tally.points[id] ?? 0;
	if (kind !== 'ranked') return t('room.scriptVote.votes', { count });
	if (tally.winner === id) return t('room.scriptVote.winner', { count });
	const round = tally.out?.[id];
	return round ? t('room.scriptVote.out', { round }) : t('room.scriptVote.votes', { count });
}
