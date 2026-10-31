import type { LoadedScript } from '#lib/core/data/index.ts';
import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
import type {
	PublicCorner,
	PublicLook,
	PublicSeatLayout
} from '#lib/core/sync/public-projection.ts';

/**
 * What the Storyteller's player view is drawn from (BoardScriptDialog). The board builds it
 * once and hands the same one to every way in, its Script button and the grim cover's Player
 * view, so the two can never show the players' screen differently (Trevor, 2026-10-31: the
 * cover's looked different; it was given the seats without the board's shape).
 */
export interface BoardPlayerSource {
	game: Game;
	/** The game's script, once the official data has loaded. */
	script: LoadedScript | undefined;
	logo: string | undefined;
	/** The live room's code, for Share. */
	room: string | undefined;
	characters: CharacterLookup;
	layout: PublicSeatLayout;
	corner: PublicCorner;
	look?: PublicLook;
	/** The board's own background picture, or the room it comes from. */
	picture?: Blob;
	pictureRoom?: string;
}
