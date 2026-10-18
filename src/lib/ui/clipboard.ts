/**
 * Copies text to the clipboard, with the toasts each place wants (component review,
 * 2026-10-18: five copies of the same try/catch). Resolves true when it was copied.
 */
import { toast } from '#lib/ui/primitives/toaster.ts';

type Message = readonly [title: string, detail?: string];

export async function copyText(
	text: string,
	messages: { copied?: Message; failed?: Message } = {}
): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		if (messages.copied) toast(...messages.copied);
		return true;
	} catch {
		if (messages.failed) toast(...messages.failed);
		return false;
	}
}
