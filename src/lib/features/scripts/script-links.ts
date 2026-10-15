/**
 * Turns a link the Storyteller pasted into something we can fetch: the raw file behind a
 * Pastebin, GitHub or Gist page (Pocket Grimoire issue 124 was a Pastebin page link), or a
 * BotC Scripts lookup through our Worker. Design: 08-script-loading.md §5.2.
 */
import { parseBotcScriptsRef, type BotcScriptsRef } from './botcscripts-api.ts';

export type LinkTarget =
	| { kind: 'fetch'; url: string }
	| { kind: 'botcscripts'; ref: BotcScriptsRef }
	| { kind: 'invalid'; message: string };

export function resolveLink(input: string): LinkTarget {
	const text = input.trim();
	if (text === '') return { kind: 'invalid', message: 'Enter a link.' };
	const botc = parseBotcScriptsRef(text);
	if (botc) return { kind: 'botcscripts', ref: botc };

	let url: URL;
	try {
		url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
	} catch {
		return { kind: 'invalid', message: 'This is not a link.' };
	}
	// The app is served over https, so the browser would block an http fetch anyway.
	if (url.protocol === 'http:') url.protocol = 'https:';
	if (url.protocol !== 'https:') return { kind: 'invalid', message: 'Use an https:// link.' };
	if (url.username || url.password) {
		return { kind: 'invalid', message: 'Remove the user name or password from the link.' };
	}

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
