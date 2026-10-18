/**
 * `/api/collections/<id>`: the scripts a community collection's Google Doc links as
 * "Script JSON" files (`collection-api.ts`). The browser can't read Google Docs or Drive
 * itself (no CORS). Served from our own copy (`mirror.ts`), which only ever fetches that doc
 * and the Drive files it links.
 */
import {
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
import { nameFromListing } from '../src/lib/features/scripts/script-names.ts';
import type { MirroredSource } from './mirror.ts';
import { USER_AGENT } from './user-agent.ts';

const DOC_CACHE_SECONDS = 3600;
const FILE_CACHE_SECONDS = 86400;
const MAX_DOC_BYTES = 3_000_000;
/** Scripts are a few kilobytes; far bigger is not a script. */
const MAX_SCRIPT_BYTES = 1_000_000;

async function fetchText(url: string, cacheTtl: number, maxBytes: number): Promise<string> {
	const response = await fetch(url, {
		headers: { 'User-Agent': USER_AGENT },
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
	{ fileId, heading, title }: CollectionDocLink
): Promise<CollectionScript | string> {
	let why = 'no download address';
	for (const url of driveDownloadUrls(fileId)) {
		try {
			const json = readScriptFile(await fetchText(url, FILE_CACHE_SECONDS, MAX_SCRIPT_BYTES));
			if (json) {
				return {
					link: driveViewUrl(fileId),
					page: collectionHeadingUrl(collection, heading),
					// Some files name the script nothing; the doc's heading does (Trevor, 2026-10-18).
					json: nameFromListing(json, title)
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

/** A collection's scripts, for our copy (`mirror.ts`). */
export function collectionSource(collection: ScriptCollectionInfo): MirroredSource {
	return {
		id: `collection:${collection.id}`,
		async build() {
			const { links, problems } = await readDocLinks(collection);
			const found = await Promise.all(links.map((link) => readScript(collection, link)));
			const scripts = found.filter((s) => typeof s !== 'string');
			const failed = found.filter((s) => typeof s === 'string');
			if (failed.length || problems.length) {
				// Kept in the Worker's logs so a broken source can be seen without a device.
				console.warn('collection', collection.id, {
					links: links.length,
					problems,
					failed: failed.slice(0, 5)
				});
			}
			if (!scripts.length) {
				throw new Error(
					[
						`No scripts we could read (${links.length} links).`,
						...problems,
						...failed.slice(0, 3)
					].join(' ')
				);
			}
			return { scripts, failed: failed.length };
		}
	};
}
