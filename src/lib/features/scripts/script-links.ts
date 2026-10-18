/**
 * Turns a link the Storyteller pasted into something we can fetch: the raw file behind a
 * Pastebin, GitHub or Gist page (Pocket Grimoire issue 124 was a Pastebin page link), or a
 * BotC Scripts or Bloodstar Clocktica lookup through our Worker. Design: 08-script-loading.md §5.2.
 */
import { t } from '#lib/i18n/locale.svelte.ts';
import { parseBloodstarLink, type BloodstarScript } from './bloodstar-api.ts';
import { parseBotcScriptsRef, type BotcScriptsRef } from './botcscripts-api.ts';
import { scriptToolPayload } from './script-tool-link.ts';

export type LinkTarget =
	| { kind: 'fetch'; url: string }
	| { kind: 'botcscripts'; ref: BotcScriptsRef }
	/** A Bloodstar Clocktica script, on its old or new address, through our Worker. */
	| { kind: 'bloodstar'; script: BloodstarScript }
	/** A Script Tool link holds the script itself: read without any request. */
	| { kind: 'scripttool'; payload: string; url: string }
	| { kind: 'invalid'; message: string };

export function resolveLink(input: string): LinkTarget {
	const text = input.trim();
	if (text === '') return { kind: 'invalid', message: t('scripts.error.enterLink') };
	const botc = parseBotcScriptsRef(text);
	if (botc) return { kind: 'botcscripts', ref: botc };
	const payload = scriptToolPayload(text);
	if (payload) return { kind: 'scripttool', payload, url: text };

	let url: URL;
	try {
		url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
	} catch {
		return { kind: 'invalid', message: t('scripts.error.notLink') };
	}
	// The app is served over https, so the browser would block an http fetch anyway.
	if (url.protocol === 'http:') url.protocol = 'https:';
	if (url.protocol !== 'https:') return { kind: 'invalid', message: t('scripts.error.https') };
	if (url.username || url.password) {
		return { kind: 'invalid', message: t('scripts.error.credentials') };
	}

	const bloodstar = parseBloodstarLink(url);
	if (bloodstar) return { kind: 'bloodstar', script: bloodstar };

	const host = url.hostname.toLowerCase().replace(/^www\./, '');
	const parts = url.pathname.split('/').filter(Boolean);

	// pastebin.com/<key> → pastebin.com/raw/<key>
	if (host === 'pastebin.com' && parts.length === 1) {
		return { kind: 'fetch', url: `https://pastebin.com/raw/${parts[0]}` };
	}
	// github.com/<owner>/<repo>/blob/<ref>/<path> → raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>
	if (host === 'github.com' && parts[2] === 'blob' && parts.length >= 5) {
		const [owner, repo, , ...rest] = parts;
		return {
			kind: 'fetch',
			url: `https://raw.githubusercontent.com/${owner}/${repo}/${rest.join('/')}`
		};
	}
	// gist.github.com/<user>/<id> → gist.githubusercontent.com/<user>/<id>/raw
	if (host === 'gist.github.com' && parts.length === 2) {
		return { kind: 'fetch', url: `https://gist.githubusercontent.com/${parts[0]}/${parts[1]}/raw` };
	}
	return { kind: 'fetch', url: url.href };
}
