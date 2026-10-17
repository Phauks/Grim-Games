/**
 * `/api/collections/<id>`: the scripts a community collection's Google Doc links as
 * "Script JSON" files (`collection-api.ts`). The browser can't read Google Docs or Drive
 * itself (no CORS). Only ever fetches that doc and the Drive files it links, cached.
 */
import {
	COLLECTIONS,
	collectionExportUrl,
	collectionHeadingUrl,
	collectionMobileUrl,
	driveDownloadUrls,
	driveViewUrl,
	readCollectionDoc,
	readScriptFile,
	type CollectionDocLink,
	type CollectionScript,
	type ScriptCollectionInfo
} from '../src/lib/features/scripts/collection-api.ts';

const DOC_CACHE_SECONDS = 3600;
const FILE_CACHE_SECONDS = 86400;
const MAX_DOC_BYTES = 3_000_000;
/** Scripts are a few kilobytes; far bigger is not a script. */
const MAX_SCRIPT_BYTES = 1_000_000;

async function fetchText(url: string, cacheTtl: number, maxBytes: number): Promise<string> {
	const response = await fetch(url, {
		redirect: 'follow',
		cf: { cacheTtl, cacheEverything: true }
	});
	if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
	const text = await response.text();
	if (text.length > maxBytes) throw new Error(`too large from ${new URL(url).hostname}`);
	return text;
}

async function readScript(
	collection: ScriptCollectionInfo,
	{ fileId, heading }: CollectionDocLink
): Promise<CollectionScript | string> {
	let why = 'no download address';
	for (const url of driveDownloadUrls(fileId)) {
		try {
			const json = readScriptFile(await fetchText(url, FILE_CACHE_SECONDS, MAX_SCRIPT_BYTES));
			if (json) {
				return {
					link: driveViewUrl(fileId),
					page: collectionHeadingUrl(collection, heading),
					json
				};
			}
			why = `not a script from ${new URL(url).hostname}`;
		} catch (error) {
			why = error instanceof Error ? error.message : String(error);
		}
	}
	return `${fileId}: ${why}`;
}

/** The doc's script links: from its export, else from its mobile view. */
async function readDocLinks(
	collection: ScriptCollectionInfo
): Promise<{ links: CollectionDocLink[]; problems: string[] }> {
	const problems: string[] = [];
	for (const url of [collectionExportUrl(collection), collectionMobileUrl(collection)]) {
		try {
			const links = readCollectionDoc(await fetchText(url, DOC_CACHE_SECONDS, MAX_DOC_BYTES));
			if (links.length) return { links, problems };
			problems.push(`no script links in ${new URL(url).pathname}`);
		} catch (error) {
			problems.push(error instanceof Error ? error.message : String(error));
		}
	}
	return { links: [], problems };
}

export async function handleCollection(id: string): Promise<Response> {
	const collection = COLLECTIONS.find((c) => c.id === id);
	if (!collection) return new Response('Not found', { status: 404 });
	const { links, problems } = await readDocLinks(collection);
	const found = await Promise.all(links.map((link) => readScript(collection, link)));
	const scripts = found.filter((s) => typeof s !== 'string');
	const failed = found.filter((s) => typeof s === 'string');
	if (failed.length || problems.length) {
		// Kept in the Worker's logs so a broken source can be seen without a device.
		console.warn('collection', id, { links: links.length, problems, failed: failed.slice(0, 5) });
	}
	if (!scripts.length) {
		// Never cached: an empty list would hide the collection until the cache expired.
		return Response.json(
			{ error: 'The collection had no scripts we could read.', problems, failed },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } }
		);
	}
	return Response.json(
		{ scripts, failed: failed.length },
		{ headers: { 'Cache-Control': `public, max-age=${DOC_CACHE_SECONDS}` } }
	);
}
