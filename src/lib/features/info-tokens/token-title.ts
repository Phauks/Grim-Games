import { plainText } from '#lib/core/text/rich.ts';

/**
 * A token's one name: its tile, the dialog or sheet it opens, and the card shown all use
 * it, so they can't drift apart (Trevor, 2026-10-18: "Your number is" titled "Number").
 */
export function tokenTitle(token: { readonly text: string }): string {
	return plainText(token.text);
}
