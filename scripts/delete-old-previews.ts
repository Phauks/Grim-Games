/**
 * Deletes every Worker Preview of grim-games except beta's. Each Preview owns its own copy of
 * every Durable Object class in wrangler.jsonc's `previews` block, and the account allows 500
 * Durable Object namespaces, so a Preview left behind by a merged branch keeps ten of them for
 * good (developers.cloudflare.com/workers/previews/: "Cloudflare automatically provisions a new
 * Durable Object namespace ... for each Preview"; nothing deletes a Preview when its branch goes).
 * Deleting a Preview deletes its namespaces and their storage; production, beta and the shared
 * data Worker (grim-games-data) are never touched.
 *
 * `node scripts/delete-old-previews.ts --run [--dry-run]`, with CLOUDFLARE_API_TOKEN (Workers
 * Scripts: Edit) set. The Preview cleanup workflow runs it; without the token it does nothing.
 */

const ACCOUNT = 'b7902f2098c6d8cd1ac5910fc5373fee';
const WORKER = 'grim-games';
/** The one Preview kept: beta's (README, Deploying). */
export const KEEP = 'beta';
// The path Wrangler's own `wrangler preview delete` uses.
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/workers/${WORKER}/previews`;

export type Preview = { id?: string; name: string };

/**
 * The Previews to delete: all but beta's. Nothing when beta's isn't in the list, since then the
 * names aren't what we expect and deleting would be a guess.
 */
export function previewsToDelete(previews: Preview[], keep = KEEP): Preview[] {
	if (!previews.some((p) => p.name === keep)) return [];
	return previews.filter((p) => p.name !== keep);
}

type ApiBody = {
	success?: boolean;
	errors?: { code: number; message: string }[];
	result?: Preview[];
	result_info?: { total_pages?: number };
};

async function call(token: string, url: string, method = 'GET'): Promise<ApiBody> {
	const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });
	const body = (await res.json().catch(() => ({}))) as ApiBody;
	if (!res.ok || body.success === false) {
		const why = body.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || res.statusText;
		throw new Error(`${method} ${res.status} ${why}`);
	}
	return body;
}

async function listAll(token: string): Promise<Preview[]> {
	const all: Preview[] = [];
	for (let page = 1; page <= 20; page++) {
		const body = await call(token, `${API}?per_page=100&page=${page}`);
		const batch = body.result ?? [];
		all.push(...batch);
		const pages = body.result_info?.total_pages;
		if (batch.length < 100 || (pages && page >= pages)) break;
	}
	return all;
}

if (process.argv.includes('--run')) {
	const token = process.env.CLOUDFLARE_API_TOKEN;
	const dryRun = process.argv.includes('--dry-run');
	if (!token) {
		console.log('::notice title=Preview cleanup::No CLOUDFLARE_API_TOKEN secret, so nothing ran.');
	} else {
		const previews = await listAll(token);
		const doomed = previewsToDelete(previews);
		console.log(`${previews.length} Previews; ${doomed.length} to delete, keeping "${KEEP}".`);
		if (previews.length && !previews.some((p) => p.name === KEEP)) {
			console.log(`::warning title=Preview cleanup::No Preview named "${KEEP}"; deleted nothing.`);
		}
		let failed = 0;
		for (const p of doomed) {
			if (dryRun) {
				console.log(`Would delete ${p.name}`);
				continue;
			}
			try {
				await call(token, `${API}/${encodeURIComponent(p.id ?? p.name)}`, 'DELETE');
				console.log(`Deleted ${p.name}`);
			} catch (e) {
				failed++;
				console.log(`::warning title=Preview cleanup::${p.name}: ${(e as Error).message}`);
			}
		}
		if (failed) process.exitCode = 1;
	}
}
