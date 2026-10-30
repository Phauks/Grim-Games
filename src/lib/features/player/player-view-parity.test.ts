import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The Storyteller's player view (the board's Script, the grim cover's Player view) is /play's
// own pieces fed the state a phone gets, so a new piece on /play shows there too (Trevor,
// 2026-10-27: "Design it so that these additions move in automatically (Ie, stage tracker and
// timer)"). These guard the seams where the two sides could drift apart again.
const source = (path: string) => readFileSync(`src/lib/features/${path}`, 'utf8');
const joinPanel = source('room/JoinPanel.svelte');
const playerView = source('player/PlayerView.svelte');
const boardView = source('grimoire/BoardPlayerView.svelte');
const screen = source('player/PlayerScreen.svelte');
const grim = source('player/PlayerGrim.svelte');

describe("Storyteller's player view parity", () => {
	it('renders the same row over the tabs and the same tabs as /play', () => {
		expect(boardView).toContain('<PlayerStatusRow');
		expect(joinPanel).toContain('<PlayerStatusRow');
	});

	it('draws the tabs through PlayerScreen on both sides, never set up by either host', () => {
		// Trevor, 2026-10-28: full screen on the Grim tab was /play's own option, so the
		// Storyteller's view never had it. How a tab looks is PlayerScreen's choice alone.
		for (const host of [playerView, boardView]) {
			expect(host).toContain('<PlayerScreen');
			expect(host).not.toMatch(/<Player(ScriptTabs|Grim|Notes)\b/);
		}
		expect(screen).toMatch(/<PlayerGrim\b[^>]*\bfullScreen\b/);
	});

	it('draws the table from the state the room sends, never a projection of its own', () => {
		expect(boardView).toContain('tableState(roomHost(),');
		expect(boardView).not.toMatch(/\bpublicProjection\b/);
	});

	it("keeps the phone's public status pieces inside the shared row", () => {
		// Anything /play draws from the table's state belongs in PlayerStatusRow, which the
		// Storyteller's view renders too: not straight in the phone's own room row.
		expect(joinPanel).not.toMatch(/from '#lib\/features\/day\//);
		expect(joinPanel).not.toMatch(/public\?\.(now|timer)\b/);
	});

	it('shows the shared final grimoire and the end of the game as phones do', () => {
		// Trevor, 2026-10-30: Share grim's final grimoire never reached the Storyteller's player
		// view, which read only a phone's room. The board hands it the one the room sent.
		expect(boardView).toMatch(/roomHost\(\)\.revealed|host\.revealed/);
		expect(boardView).toMatch(/\bfinal\b[\s\S]*}}/);
		expect(grim).toContain('finalGrimoireOf(town, player');
		// "Game over" over the tabs comes from the same words on both sides.
		for (const host of [joinPanel, boardView]) expect(host).toContain('gameOverText(');
	});
});
