/**
 * Community script collections kept in a shared Google Doc, read by our Worker when the
 * Scripts page searches them, never bundled (Trevor, 2026-10-16). The first is The Carousel
 * Script Collection: each script has a "Script JSON" link to a Google Drive file. The Worker
 * reads the doc for those links and returns the scripts; the doc stays the credited source.
 * Shared by the app and the Worker (`worker/collections.ts`).
 */

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

export function driveViewUrl(fileId: string): string {
	return `https://drive.google.com/file/d/${fileId}/view`;
}

export function driveDownloadUrl(fileId: string): string {
	return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
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

/** The Drive files a doc links as a script's JSON ("Script JSON"), in the doc's order. */
export function readCollectionDoc(html: string): string[] {
	const ids: string[] = [];
	for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
		const text = match[2].replace(/<[^>]+>/g, '').trim();
		if (!/\bjson\b/i.test(text)) continue;
		const id = driveFileId(match[1]);
		if (id && !ids.includes(id)) ids.push(id);
		if (ids.length >= MAX_COLLECTION_SCRIPTS) break;
	}
	return ids;
}

export interface CollectionScript {
	/** The Drive file it came from, as people open it. */
	link: string;
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
			? [{ link: raw.link, json: raw.json }]
			: []
	);
}
