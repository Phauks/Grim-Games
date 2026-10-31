/**
 * Share links for mode files (Trevor, 2026-10-31: "just as users can share scripts, characters,
 * and character selections, now they can share mode files as well"). A game mode or special
 * rule travels whole in the URL hash, deflated the way a script's `#s=` link is (share.ts), so
 * it works offline and nothing lands in a query string or a Worker log (CLAUDE.md). The link
 * opens New game with Add mode holding the file, to be checked and confirmed like a pasted one.
 */
import type { GameMode, SpecialRule } from '#lib/core/modes/index.ts';
import { decodeSharedScript, encodeSharedScript } from '#lib/features/scripts/share.ts';

/** Where a mode link opens: New game, which has Add mode. */
export const MODE_SHARE_PATH = '/new';
const KEY = 'm';

/** A mode file as it is downloaded and shared: tab-indented JSON. */
export function modeFileText(mode: GameMode | SpecialRule): string {
	return JSON.stringify(mode, null, '\t');
}

/** The link that carries a whole mode file. */
export async function modeShareLink(origin: string, mode: GameMode | SpecialRule): Promise<string> {
	return `${origin}${MODE_SHARE_PATH}#${KEY}=${await encodeSharedScript(mode)}`;
}

/** The payload a location hash carries for a mode file, if it carries one. */
export function modePayloadOf(hash: string): string | undefined {
	return new URLSearchParams(hash.replace(/^#/, '')).get(KEY) ?? undefined;
}

/**
 * The mode file a link's hash carries, as text for Add mode; undefined when the hash holds
 * none. Throws a SharedLinkError when the link is damaged or from a newer version.
 */
export async function modeFileFromHash(hash: string): Promise<string | undefined> {
	const payload = modePayloadOf(hash);
	if (!payload) return undefined;
	return JSON.stringify(await decodeSharedScript(payload), null, '\t');
}
