import { handleAccount, type Env as AccountRoutesEnv } from './account/routes.ts';
import { bloodstarSource, handleBloodstarScript } from './bloodstar.ts';
import { handleBotcScripts } from './botcscripts.ts';
import { collectionSource } from './collections.ts';
import { curatedSource } from './curated.ts';
import { handleHomebrewScripts } from './homebrew-scripts.ts';
import { handleHomebrewWiki } from './homebrew-wiki.ts';
import { handleRoom, Room, type RoomEnv } from './room.ts';
import { handleLiveGames, LiveGameIndex, type LiveGamesEnv } from './live-games.ts';
import { handleReports, ReportBox, type ReportsEnv } from './reports.ts';
import { handleRecap, SharedRecap, type RecapEnv } from './recap.ts';
import { handleShare, SharedScript, type ShareEnv } from './share.ts';
import {
	mirrorStatus,
	refreshAll,
	ScriptMirror,
	serveMirrored,
	type MirrorEnv,
	type MirroredSource
} from './mirror.ts';
import { isWorldCupYear, worldCupSource } from './world-cups.ts';
import { COLLECTIONS } from '../src/lib/features/scripts/collection-api.ts';

export { LiveGameIndex, ReportBox, Room, ScriptMirror, SharedRecap, SharedScript };
export { AccountEmail, AccountName, AccountUser } from './account/objects.ts';

export interface Env
	extends ShareEnv, RecapEnv, AccountRoutesEnv, RoomEnv, LiveGamesEnv, ReportsEnv, MirrorEnv {
	ASSETS: Fetcher;
	/** "off" only in the local e2e server, like SHARE_LIMITS: no route here asks another site. */
	OTHER_SITES?: string;
}

/** The routes that answer from another site (or our copy of one), for OTHER_SITES. */
const OTHER_SITE_ROUTES =
	/^\/api\/(botcscripts|homebrew-wiki|homebrew-scripts|bloodstar|curated|collections|world-cups)(\/|$)/;

/** The sources we keep our own copy of (`mirror.ts`), refreshed nightly. */
const MIRRORED_SOURCES: readonly MirroredSource[] = [
	curatedSource,
	...COLLECTIONS.map(collectionSource),
	worldCupSource('2023'),
	worldCupSource('2025'),
	bloodstarSource
];

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/api/health') {
			return Response.json({ ok: true });
		}
		const room = await handleRoom(request, env, url);
		if (room) return room;
		const liveGames = await handleLiveGames(request, env, url);
		if (liveGames) return liveGames;
		// Tests fake these answers; the sites themselves refuse CI machines (BotC Scripts: 403).
		if (env.OTHER_SITES === 'off' && OTHER_SITE_ROUTES.test(url.pathname)) {
			return new Response('Other sites are off', { status: 503 });
		}
		if (url.pathname.startsWith('/api/botcscripts/')) {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return handleBotcScripts(url);
		}
		if (url.pathname.startsWith('/api/homebrew-wiki/')) {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return handleHomebrewWiki(url);
		}
		if (
			url.pathname === '/api/homebrew-scripts' ||
			url.pathname.startsWith('/api/homebrew-scripts/')
		) {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return handleHomebrewScripts(url);
		}
		if (url.pathname === '/api/bloodstar') {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return serveMirrored(env, ctx, bloodstarSource);
		}
		if (url.pathname.startsWith('/api/bloodstar/')) {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return handleBloodstarScript(url);
		}
		if (url.pathname === '/api/curated') {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return serveMirrored(env, ctx, curatedSource);
		}
		const collectionId = url.pathname.match(/^\/api\/collections\/([a-z0-9-]+)$/)?.[1];
		if (collectionId) {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			const collection = COLLECTIONS.find((c) => c.id === collectionId);
			if (!collection) return new Response('Not found', { status: 404 });
			return serveMirrored(env, ctx, collectionSource(collection));
		}
		const year = url.pathname.match(/^\/api\/world-cups\/(\d{4})$/)?.[1];
		if (year && isWorldCupYear(year)) {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return serveMirrored(env, ctx, worldCupSource(year));
		}
		if (url.pathname === '/api/mirror') {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return mirrorStatus(env);
		}
		if (url.pathname === '/api/share' || url.pathname.startsWith('/api/share/')) {
			return handleShare(request, env);
		}
		if (url.pathname === '/api/recap' || url.pathname.startsWith('/api/recap/')) {
			return handleRecap(request, env);
		}
		const reports = await handleReports(request, env, url);
		if (reports) return reports;
		const account = await handleAccount(request, env, url);
		if (account) return account;
		if (url.pathname.startsWith('/api/')) {
			return new Response('Not found', { status: 404 });
		}
		return env.ASSETS.fetch(request);
	},

	/** Each night (`triggers` in wrangler.jsonc): every stored script copy is refreshed. */
	async scheduled(_controller, env, ctx): Promise<void> {
		ctx.waitUntil(refreshAll(env, MIRRORED_SOURCES));
	}
} satisfies ExportedHandler<Env>;
