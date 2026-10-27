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

describe("Storyteller's player view parity", () => {
	it('renders the same row over the tabs and the same tabs as /play', () => {
		for (const piece of ['<PlayerStatusRow', '<PlayerScriptTabs', '<PlayerGrim', '<PlayerNotes']) {
			expect(boardView).toContain(piece);
		}
		expect(joinPanel).toContain('<PlayerStatusRow');
		expect(playerView).toContain('<PlayerScriptTabs');
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
});
