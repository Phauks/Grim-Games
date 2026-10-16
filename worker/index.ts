import { handleAccount, type Env as AccountRoutesEnv } from './account/routes.ts';
import { handleBotcScripts } from './botcscripts.ts';
import { handleCurated } from './curated.ts';
import { handleRoom, Room, type RoomEnv } from './room.ts';
import { handleShare, SharedScript, type ShareEnv } from './share.ts';

export { Room, SharedScript };
export { AccountEmail, AccountUser } from './account/objects.ts';

export interface Env extends ShareEnv, AccountRoutesEnv, RoomEnv {
	ASSETS: Fetcher;
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/api/health') {
			return Response.json({ ok: true });
		}
		const room = await handleRoom(request, env, url);
		if (room) return room;
		if (url.pathname.startsWith('/api/botcscripts/')) {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return handleBotcScripts(url);
		}
		if (url.pathname === '/api/curated') {
			if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
			return handleCurated();
		}
		if (url.pathname === '/api/share' || url.pathname.startsWith('/api/share/')) {
			return handleShare(request, env);
		}
		const account = await handleAccount(request, env, url);
		if (account) return account;
		if (url.pathname.startsWith('/api/')) {
			return new Response('Not found', { status: 404 });
		}
		return env.ASSETS.fetch(request);
	}
} satisfies ExportedHandler<Env>;
