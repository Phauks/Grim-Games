/**
 * Community script collections kept in a shared Google Doc, read by our Worker when the
 * Scripts page searches them, never bundled (Trevor, 2026-10-16). The first is The Carousel
 * Script Collection: each script has a "Script JSON" link to a Google Drive file. The Worker
 * reads the doc for those links and returns the scripts; the doc stays the credited source.
 * Shared by the app and the Worker (`worker/collections.ts`).
 */

import { relaxJson } from './relaxed-json.ts';

export const COLLECTIONS_API = '/api/collections';

export interface ScriptCollectionInfo {
	id: string;
	/** The Google Doc's id (from its address). */
	docId: string;
}

export const CAROUSEL_COLLECTION: ScriptCollectionInfo = {
	id: 'carousel',
	docId: '1U_OQJQXyp5p0yuRaqqd44zWwQYRjvrql9D-4xIogQK4'
};

export const COLLECTIONS: readonly ScriptCollectionInfo[] = [CAROUSEL_COLLECTION];

/** The doc as people open it, to credit it. */
export function collectionDocUrl(collection: ScriptCollectionInfo): string {
	return `https://docs.google.com/document/d/${collection.docId}/edit`;
}

/** The doc as plain HTML, which keeps its links. */
export function collectionExportUrl(collection: ScriptCollectionInfo): string {
	return `https://docs.google.com/document/d/${collection.docId}/export?format=html`;
}

/**
 * The doc's plain mobile view, read when the export has no script links (seen 2026-10-17:
 * the export answered with only an image while this view still listed every "Script JSON").
 */
export function collectionMobileUrl(collection: ScriptCollectionInfo): string {
	return `https://docs.google.com/document/d/${collection.docId}/mobilebasic`;
}

export function driveViewUrl(fileId: string): string {
	return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Where a Drive file's bytes are served. Drive's old `uc?export=download` address now
 * redirects here; `confirm=t` skips the "can't scan for viruses" page.
 */
export function driveDownloadUrls(fileId: string): string[] {
	const id = encodeURIComponent(fileId);
	return [
		`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
		`https://drive.google.com/uc?export=download&id=${id}`
	];
}

/**
 * A downloaded Drive file as a script, or undefined when it isn't one (an HTML sign-in or
 * warning page, or not a list). Tolerates a byte-order mark and hand-edited JSON.
 */
export function readScriptFile(text: string): unknown[] | undefined {
	const body = text.replace(/^\uFEFF/, '').trim();
	if (!body.startsWith('[') && !body.startsWith('{')) return undefined;
	try {
		const json: unknown = JSON.parse(relaxJson(body));
		return Array.isArray(json) ? json : undefined;
	} catch {
		return undefined;
	}
}

const DRIVE_ID = /^[\w-]{10,}$/;

/** A Drive file id from a link, unwrapping Google Docs' `google.com/url?q=` redirect. */
export function driveFileId(href: string): string | undefined {
	let url: URL;
	try {
		url = new URL(href.replaceAll('&amp;', '&'));
	} catch {
		return undefined;
	}
	if (url.hostname.endsWith('google.com') && url.pathname === '/url') {
		const target = url.searchParams.get('q');
		return target ? driveFileId(target) : undefined;
	}
	if (url.hostname !== 'drive.google.com') return undefined;
	const id = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get('id');
	return id && DRIVE_ID.test(id) ? id : undefined;
}

/** At most this many scripts from one doc; a collection far bigger isn't this kind of doc. */
export const MAX_COLLECTION_SCRIPTS = 60;

/** The doc opened at one heading (`h.…` ids, as Google Docs writes them). */
export function collectionHeadingUrl(collection: ScriptCollectionInfo, heading?: string): string {
	return heading
		? `${collectionDocUrl(collection)}#heading=${heading}`
		: collectionDocUrl(collection);
}

export interface CollectionDocLink {
	fileId: string;
	/** The id of the heading the link sits under, so the script can link to its own section. */
	heading?: string;
}

const HEADING_ID = /^h\.[\w-]+$/;

/**
 * The Drive files a doc links as a script's JSON ("Script JSON"), in the doc's order, each
 * with the heading it sits under (Trevor, 2026-10-16: every script links to its source page).
 */
export function readCollectionDoc(html: string): CollectionDocLink[] {
	const links: CollectionDocLink[] = [];
	let heading: string | undefined;
	const parts =
		/<h[1-6]\b[^>]*\bid="([^"]+)"[^>]*>|<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
	for (const match of html.matchAll(parts)) {
		if (match[1] !== undefined) {
			heading = HEADING_ID.test(match[1]) ? match[1] : undefined;
			continue;
		}
		const text = match[3].replace(/<[^>]+>/g, '').trim();
		if (!/\bjson\b/i.test(text)) continue;
		const fileId = driveFileId(match[2]);
		if (!fileId || links.some((l) => l.fileId === fileId)) continue;
		links.push(heading ? { fileId, heading } : { fileId });
		if (links.length >= MAX_COLLECTION_SCRIPTS) break;
	}
	return links;
}

export interface CollectionScript {
	/** The Drive file it came from, as people open it. */
	link: string;
	/** The collection doc at the script's own heading: its source page. */
	page: string;
	/** The script in TPI's format. */
	json: unknown[];
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The Worker's answer, checked; undefined when it isn't one. */
export function readCollectionList(body: unknown): CollectionScript[] | undefined {
	if (!isObject(body) || !Array.isArray(body.scripts)) return undefined;
	return body.scripts.flatMap((raw: unknown) =>
		isObject(raw) && typeof raw.link === 'string' && Array.isArray(raw.json)
			? [
					{
						link: raw.link,
						// A list cached before pages were sent links to the doc itself.
						page: typeof raw.page === 'string' ? raw.page : collectionDocUrl(CAROUSEL_COLLECTION),
						json: raw.json
					}
				]
			: []
	);
}
