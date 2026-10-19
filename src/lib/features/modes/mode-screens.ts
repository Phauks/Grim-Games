import type { GameId } from '#lib/core/model/index.ts';
import { campaignOf } from './campaigns.ts';
import { townGroupOf } from './town-groups.ts';

/**
 * Whether `url` is one of this game's mode screens: another town of its group, the group's
 * towns page or its campaign page. Moving there from the board isn't leaving the game, so it
 * doesn't ask (Trevor, 2026-10-19: moving between games from the corner menu "should never"
 * ask).
 */
export function withinModeSession(gameId: GameId, url: URL): boolean {
	const path = url.pathname;
	const group = townGroupOf(gameId);
	if (group?.gameIds.some((id) => path.startsWith(`/grimoire/${id}`))) return true;
	if (group && path.startsWith(`/towns/${group.groupId}`)) return true;
	const campaign = campaignOf(gameId);
	return campaign !== undefined && path.startsWith(`/campaigns/${campaign.campaignId}`);
}
