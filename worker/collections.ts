/**
 * `/api/collections/<id>`: the scripts a community collection's Google Doc links as
 * "Script JSON" files (`collection-api.ts`). The browser can't read Google Docs or Drive
 * itself (no CORS). Only ever fetches that doc and the Drive files it links, cached.
 */
import {
	COLLECTIONS,
	collectionExportUrl,
	collectionHeadingUrl,
	driveDownloadUrl,
	driveViewUrl,
	readCollectionDoc,
	type CollectionDocLink,
	type CollectionScript,
	type ScriptCollectionInfo
} from '../src/lib/features/scripts/collection-api.ts';

const DOC_CACHE_SECONDS = 3600;
const FILE_CACHE_SECONDS = 86400;
const MAX_DOC_BYTES = 3_000_000;
/** Scripts are a few kilobytes; far bigger is not a script. */
const MAX_SCRIPT_BYTES = 1_000_000;

async function readScript(
	collection: ScriptCollectionInfo,
	{ fileId, heading }: CollectionDocLink
): Promise<CollectionScript | undefined> {
	try {
		const response = await fetch(driveDownloadUrl(fileId), {
			redirect: 'follow',
			cf: { cacheTtl: FILE_CACHE_SECONDS, cacheEverything: true }
		});
		if (!response.ok) return undefined;
		const text = await response.text();
		if (text.length > MAX_SCRIPT_BYTES) return undefined;
		const json: unknown = JSON.parse(text);
		return Array.isArray(json)
			? { link: driveViewUrl(fileId), page: collectionHeadingUrl(collection, heading), json }
			: undefined;
	} catch {
		return undefined;
	}
}

export async function handleCollection(id: string): Promise<Response> {
	const collection = COLLECTIONS.find((c) => c.id === id);
	if (!collection) return new Response('Not found', { status: 404 });
	let html: string;
	try {
		const response = await fetch(collectionExportUrl(collection), {
			redirect: 'follow',
			cf: { cacheTtl: DOC_CACHE_SECONDS, cacheEverything: true }
		});
		if (!response.ok) {
			return Response.json(
				{ error: `Google Docs answered with HTTP ${response.status}.` },
				{ status: 502 }
			);
		}
		html = await response.text();
	} catch {
		return Response.json({ error: 'Could not reach Google Docs.' }, { status: 502 });
	}
	if (html.length > MAX_DOC_BYTES) {
		return Response.json({ error: 'The collection is too large.' }, { status: 502 });
	}
	const found = await Promise.all(
		readCollectionDoc(html).map((link) => readScript(collection, link))
	);
	const scripts = found.filter((s) => s !== undefined);
	return Response.json(
		{ scripts },
		{ headers: { 'Cache-Control': `public, max-age=${DOC_CACHE_SECONDS}` } }
	);
}
