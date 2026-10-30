import { DurableObject } from 'cloudflare:workers';
import { sha256Hex as sha256 } from '../src/lib/core/codes/hash.ts';
import { makeRoomCode, normaliseRoomCode } from '../src/lib/core/sync/room-code.ts';
import {
	canCallTown,
	canReveal,
	castScriptBallot,
	castVote,
	closeScriptVote,
	closeTransfer,
	openTransfer,
	endScriptVote,
	closeVote,
	gameOver,
	hostView,
	isRemoved,
	isScript,
	isSharedGrimoire,
	letBackIn,
	removeMember,
	join,
	markHere,
	judgePicture,
	reportPicture,
	readMessages,
	sendMessage,
	setInbox,
	MAX_GRIMOIRE_BYTES,
	MAX_SCRIPT_BYTES,
	openScriptVote,
	showScriptVoteTally,
	openVote,
	parseClientMessage,
	setLook,
	playerView,
	publish,
	receiveFeedback,
	reopenGame,
	roleSeen,
	setRoles,
	roomPreview,
	seat,
	setName,
	setChoosing,
	setViewers,
	setStorytellerBuild,
	supportsProtocol,
	townView,
	parseTownSound,
	unseat,
	viewerFailed,
	viewersLocked,
	type ViewerFails,
	type GrimoireView,
	type RevealView,
	type RoomState,
	type ScriptView,
	type ServerMessage
} from '../src/lib/core/sync/room.ts';
import { liveGame, type LiveGame } from '../src/lib/core/sync/live-games.ts';
import { loadRoomState, newStoredRoom } from '../src/lib/core/sync/room-state.ts';
import {
	addRoomImage,
	isRoomImageType,
	MAX_ROOM_IMAGE_BYTES,
	parseRoomImagePath,
	splitUpload,
	type StoredImage
} from '../src/lib/core/sync/room-images.ts';
import { MAX_AVATAR_PICTURE_BYTES } from '../src/lib/core/sync/room-pictures.ts';
import { liveGameIndex, type LiveGameIndex } from './live-games.ts';
import { pushCallTown, setRoomPushAddress, type PushEnv } from './push.ts';
import { closeSocket, refuseRemoved, send, sendText, type Attachment } from './room-sockets.ts';
import {
	accountTags,
	linkAccount,
	requestAccount,
	seatAccount,
	withAccount
} from './room-accounts.ts';
import type { AccountEnv } from './account/objects.ts';
import {
	answerTransfer,
	claimGone,
	claimMessage,
	closeTransferGame,
	keepsTransferGame,
	type TransferRoom
} from './room-transfer.ts';

export interface RoomEnv extends PushEnv {
	ROOMS: DurableObjectNamespace<Room>;
	ROOM_JOINS: RateLimit;
	ROOM_CREATES: RateLimit;
	/** The open rooms' codes, for the admins' Live games (plan J31). */
	LIVE_GAMES: DurableObjectNamespace<LiveGameIndex>;
}

/**
 * A room is deleted after this long with no connections or messages. Durable Object storage
 * otherwise persists until deleted; the object itself hibernates after ~10 s idle and costs
 * nothing then (developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).
 */
const ROOM_IDLE_MS = 24 * 60 * 60 * 1000;
/**
 * Public state is small (names and flags for at most a few dozen seats). Only the
 * Storyteller's device may send more, for a script with its own characters or the whole
 * grimoire for the view-only link.
 */
const MAX_MESSAGE_BYTES = 64 * 1024;
const KEY_PATTERN = /^[0-9a-f]{32,128}$/;

/** A room's picture as stored: its bytes and type (core/sync/room-images.ts). */
interface ImageView {
	type: string;
	bytes: ArrayBuffer;
}

/**
 * One live room (07-accounts-and-multi-device.md §4.2). The rules live in
 * `core/sync/room.ts`; this object stores the state, checks who is talking, and sends
 * each device its own view: the Storyteller sees members and requests, a player sees the
 * public table and their own place in it.
 */
export class Room extends DurableObject<RoomEnv> {
	/** When the last Back to town call went out; forgotten if the room sleeps, which is fine. */
	private lastCallTown: number | undefined;

	private async load(): Promise<RoomState | undefined> {
		const room = await this.ctx.storage.get<RoomState>('room');
		return loadRoomState(room);
	}

	/** Pushes the expiry back; called on every connection and message. */
	private async touch(): Promise<void> {
		await this.ctx.storage.setAlarm(Date.now() + ROOM_IDLE_MS);
	}

	async alarm(): Promise<void> {
		this.broadcastClosed('Room expired');
		await this.forget();
	}

	/** Deletes the room and takes it off the admins' list. */
	private async forget(): Promise<void> {
		const code = await this.ctx.storage.get<string>('code');
		await this.ctx.storage.deleteAll();
		if (code) await liveGameIndex(this.env).remove(code);
	}

	/**
	 * Claims a fresh room for a Storyteller; false if the code is already in use. The room keeps
	 * its own code for the admins' list (rooms opened before it was kept are not listed).
	 */
	async open(hostKeyHash: string, code?: string): Promise<boolean> {
		if (await this.load()) return false;
		await this.ctx.storage.put('room', newStoredRoom(hostKeyHash));
		if (code) {
			await this.ctx.storage.put('code', code);
			await liveGameIndex(this.env).add(code);
		}
		await this.touch();
		return true;
	}

	/** What the admins' list shows of this room (plan J31); undefined once it is gone. */
	async liveGame(code: string): Promise<LiveGame | undefined> {
		const room = await this.load();
		if (!room) return undefined;
		const script = await this.ctx.storage.get<ScriptView>('script');
		const expires = await this.ctx.storage.getAlarm();
		const active = expires === null ? Date.now() : expires - ROOM_IDLE_MS;
		return liveGame(code, room, script?.script, this.present().size, active);
	}

	/** The account in `seatId`, for `requester` to friend (worker/room-accounts.ts). */
	async friendSeat(requester: string, seatId: string): Promise<string | 'self' | undefined> {
		return seatAccount(this.ctx, await this.load(), requester, seatId);
	}

	async fetch(request: Request): Promise<Response> {
		const room = await this.load();
		const image = parseRoomImagePath(new URL(request.url).pathname);
		if (image) return this.image(request, room, image.hash);
		if (request.headers.get('Upgrade') !== 'websocket') {
			const script = room && (await this.ctx.storage.get<ScriptView>('script'));
			return Response.json(roomPreview(room, script?.script));
		}
		// Only the admins' route (worker/live-games.ts) reaches a room on this path, after
		// checking the account. An admin's watching doesn't keep the room alive.
		const admin = new URL(request.url).pathname.startsWith('/api/admin/');
		if (room && !admin) await this.touch();
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		this.ctx.acceptWebSocket(server, admin ? [] : accountTags(requestAccount(request)));
		if (admin) server.serializeAttachment({ role: 'admin' } satisfies Attachment);
		return new Response(null, { status: 101, webSocket: client });
	}

	/**
	 * A picture for the table: the Storyteller's device uploads it (PUT, its room key ahead of
	 * the bytes) and every device loads it (GET). Its name is the hash of its bytes, so a
	 * stored picture never changes and can be cached for as long as the room lasts.
	 */
	private async image(request: Request, room: RoomState | undefined, hash: string) {
		if (!room) return new Response('No such room', { status: 404 });
		const key = `image:${hash}`;
		if (request.method === 'GET') {
			const view = await this.ctx.storage.get<ImageView>(key);
			if (!view) return new Response('No such picture', { status: 404 });
			return new Response(view.bytes, {
				headers: {
					'Content-Type': view.type,
					'Cache-Control': 'private, max-age=86400, immutable',
					'X-Content-Type-Options': 'nosniff'
				}
			});
		}
		if (request.method !== 'PUT') return new Response('Method not allowed', { status: 405 });
		const type = request.headers.get('Content-Type');
		if (!isRoomImageType(type)) return new Response('Not a picture', { status: 415 });
		const body = new Uint8Array(await request.arrayBuffer());
		if (body.length > MAX_ROOM_IMAGE_BYTES + 130) return new Response('Too large', { status: 413 });
		const upload = splitUpload(body);
		if (!upload) return new Response('Bad request', { status: 400 });
		const keyHash = await sha256(upload.key);
		// The Storyteller's device, or a phone in the room with its own avatar picture.
		const memberId = keyHash === room.hostKeyHash ? undefined : keyHash.slice(0, 24);
		if (memberId && !room.members.some((m) => m.memberId === memberId))
			return new Response('Not the Storyteller', { status: 403 });
		if ((await sha256(upload.image)) !== hash) return new Response('Wrong hash', { status: 400 });
		if (memberId) {
			// A player's own avatar picture (room-pictures.ts): one per phone in the room.
			if (upload.image.length > MAX_AVATAR_PICTURE_BYTES)
				return new Response('Too large', { status: 413 });
			const avatars = (await this.ctx.storage.get<Record<string, string>>('avatars')) ?? {};
			const old = avatars[memberId];
			const bytes = upload.image.slice().buffer;
			await this.ctx.storage.put({
				[key]: { type, bytes } satisfies ImageView,
				avatars: { ...avatars, [memberId]: hash }
			});
			if (old && old !== hash) await this.dropAvatarPicture(old, memberId);
			await this.touch();
			return new Response(null, { status: 204 });
		}
		const stored = (await this.ctx.storage.get<StoredImage[]>('images')) ?? [];
		const { kept, dropped } = addRoomImage(stored, hash, Date.now());
		const bytes = upload.image.slice().buffer;
		await this.ctx.storage.put({ [key]: { type, bytes } satisfies ImageView, images: kept });
		if (dropped.length) await this.ctx.storage.delete(dropped.map((h) => `image:${h}`));
		await this.touch();
		return new Response(null, { status: 204 });
	}

	/** Deletes an avatar picture no other phone or background uses (one replaced or taken away). */
	private async dropAvatarPicture(hash: string, memberId: string): Promise<void> {
		const avatars = (await this.ctx.storage.get<Record<string, string>>('avatars')) ?? {};
		const backgrounds = (await this.ctx.storage.get<StoredImage[]>('images')) ?? [];
		const { [memberId]: mine, ...others } = avatars;
		const kept = mine === hash ? others : avatars;
		if (mine === hash) await this.ctx.storage.put('avatars', kept);
		const used =
			Object.values(kept).includes(hash) || backgrounds.some((image) => image.hash === hash);
		if (!used) await this.ctx.storage.delete(`image:${hash}`);
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
		const who = ws.deserializeAttachment() as Attachment | null;
		const limit = who?.role === 'host' ? MAX_GRIMOIRE_BYTES : MAX_MESSAGE_BYTES;
		if (typeof raw !== 'string' || raw.length > limit) return;
		const message = parseClientMessage(raw);
		if (!message) return;
		// Only a grimoire may be that large; a script keeps its own limit.
		if (raw.length > MAX_SCRIPT_BYTES && message.type !== 'grimoire' && message.type !== 'reveal')
			return;
		let room = await this.load();
		if (!room) {
			send(ws, { type: 'refused', reason: 'no-room' });
			closeSocket(ws, 4404, 'No such room');
			return;
		}
		if (who?.role === 'admin') {
			if (message.type !== 'hello') return;
			if (!supportsProtocol(message.protocol)) {
				send(ws, { type: 'refused', reason: 'too-old' });
				closeSocket(ws, 4426, 'Update the app');
				return;
			}
			// What the room holds now; later changes follow as they come (save, script, grimoire).
			const script = await this.ctx.storage.get<ScriptView>('script');
			if (script) send(ws, script);
			send(ws, townView(room));
			const grimoire = await this.ctx.storage.get<GrimoireView>('grimoire');
			if (grimoire) send(ws, grimoire);
			// The Storyteller's device sends the grimoire from now on, if it isn't already.
			this.tellGrimoireWanted();
			return;
		}
		await this.touch();

		if (message.type === 'hello') {
			if (typeof message.key !== 'string' || !KEY_PATTERN.test(message.key)) return;
			if (!supportsProtocol(message.protocol)) {
				send(ws, { type: 'refused', reason: 'too-old' });
				closeSocket(ws, 4426, 'Update the app');
				return;
			}
			const hash = await sha256(message.key);
			if (message.role === 'host') {
				if (hash !== room.hostKeyHash) {
					send(ws, { type: 'refused', reason: 'not-host' });
					closeSocket(ws, 4403, 'Not the Storyteller');
					return;
				}
				ws.serializeAttachment({ role: 'host' } satisfies Attachment);
				await linkAccount(this.ctx, ws, { host: true });
				// Phones built before the Storyteller's app hear of it, and look for the update.
				// Its app says whether it shows players' messages; phones offer to send one only then.
				const built = setInbox(setStorytellerBuild(room, message.builtAt), message.inbox);
				if (built !== room) await this.save((room = built));
				send(ws, hostView(room, this.present()));
				send(ws, { type: 'watchers', count: this.watchers() });
				if (this.admins() > 0) send(ws, { type: 'grimoire-wanted', on: true });
				return;
			}
			if (message.role === 'viewer') {
				// A Grim view password can be short: wrong keys are counted, and too many in a
				// while stop every viewer from joining until it passes.
				const fails = await this.ctx.storage.get<ViewerFails>('viewer-fails');
				if (viewersLocked(fails, Date.now())) {
					send(ws, { type: 'refused', reason: 'too-many-tries' });
					closeSocket(ws, 4429, 'Too many tries');
					return;
				}
				if (hash !== room.viewerKeyHash) {
					await this.ctx.storage.put('viewer-fails', viewerFailed(fails, Date.now()));
					send(ws, { type: 'refused', reason: 'not-viewer' });
					closeSocket(ws, 4403, 'Link turned off');
					return;
				}
				ws.serializeAttachment({ role: 'viewer' } satisfies Attachment);
				const grimoire = await this.ctx.storage.get<GrimoireView>('grimoire');
				if (grimoire) send(ws, grimoire);
				this.tellWatchers();
				return;
			}
			if (message.role === 'claim') {
				// A device taking the room over (room-transfer.ts): nothing until its code is right.
				ws.serializeAttachment({ role: 'claim', keyHash: hash } satisfies Attachment);
				return;
			}
			if (message.role === 'town') {
				// A Public Town display: the public table and the script, as every phone has
				// them, and no member, so it is in no list or count.
				ws.serializeAttachment({ role: 'town' } satisfies Attachment);
				const script = await this.ctx.storage.get<ScriptView>('script');
				if (script) send(ws, script);
				send(ws, townView(room));
				// The finished grimoire, as phones get it: the town is the players' grim.
				const reveal = await this.ctx.storage.get<RevealView>('reveal');
				if (reveal && canReveal(room, reveal.gameId)) send(ws, reveal);
				return;
			}
			const memberId = hash.slice(0, 24);
			// Removed by the Storyteller for this game (plan J37): turned away until let back in.
			if (isRemoved(room, memberId)) return refuseRemoved(ws);
			const joined = join(room, memberId, this.present());
			if (!joined) {
				send(ws, { type: 'refused', reason: 'room-full' });
				closeSocket(ws, 4429, 'Room full');
				return;
			}
			ws.serializeAttachment({ role: 'player', memberId } satisfies Attachment);
			await linkAccount(this.ctx, ws, { memberId });
			// Saved even when nothing changed, so the Storyteller sees this phone is here now.
			await this.save(markHere(joined, memberId));
			const script = await this.ctx.storage.get<ScriptView>('script');
			if (script) send(ws, script);
			// A phone joining after the Storyteller shared the finished grimoire gets it too.
			const reveal = await this.ctx.storage.get<RevealView>('reveal');
			if (reveal && canReveal(room, reveal.gameId)) send(ws, reveal);
			return;
		}
		if (who?.role === 'claim') {
			await claimMessage(this.transferRoom(), ws, who.keyHash, message, room);
			return;
		}
		if (!who || who.role === 'viewer' || who.role === 'town') return;

		if (who.role === 'player') {
			const id = who.memberId;
			if (message.type === 'request') {
				room = setName(room, id, message);
			} else if (message.type === 'leave-seat') {
				room = unseat(room, id);
			} else if (message.type === 'look') {
				const avatars = await this.ctx.storage.get<Record<string, string>>('avatars');
				const next = setLook(room, id, message, avatars?.[id]);
				if (next === room) return;
				room = next;
			} else if (message.type === 'report-picture') {
				const next = reportPicture(room, id, message.seatId, Date.now());
				if (next === room) return;
				room = next;
			} else if (message.type === 'message') {
				const next = sendMessage(
					room,
					id,
					message.text,
					Date.now(),
					crypto.randomUUID(),
					message.consult
				);
				// The phone hears only whether it arrived, never what it said (Trevor, 2026-10-28:
				// "no message log", but "a confirmation message that a message has been sent").
				if (next === room) return send(ws, { type: 'message-delivered', delivered: false });
				await this.save(next);
				send(ws, { type: 'message-delivered', delivered: true });
				return;
			} else if (message.type === 'vote') {
				room = castVote(room, id, message.voteId, message.choice);
			} else if (message.type === 'feedback') {
				room = receiveFeedback(room, id, message.gameId, message.feedback, crypto.randomUUID());
			} else if (message.type === 'script-ballot') {
				room = castScriptBallot(room, id, message.voteId, message.choices, Date.now());
			} else if (message.type === 'role-seen') {
				const next = roleSeen(room, id);
				if (next === room) return;
				room = next;
			} else if (message.type === 'push') {
				return setRoomPushAddress(this.ctx.storage, id, message.address);
			} else if (message.type === 'showing') {
				const showing = message.on === true;
				ws.serializeAttachment({ role: 'player', memberId: id, showing } satisfies Attachment);
				return;
			} else return;
			await this.save(room);
			return;
		}

		switch (message.type) {
			case 'publish':
				if (typeof message.gameId !== 'string' || !Array.isArray(message.state?.seats)) return;
				room = publish(room, message.gameId, message.state, this.present());
				await this.dropReveal(room);
				break;
			case 'reveal': {
				if (!canReveal(room, message.gameId) || !isSharedGrimoire(message.grimoire)) return;
				const view: RevealView = {
					type: 'reveal',
					gameId: message.gameId,
					grimoire: message.grimoire
				};
				await this.ctx.storage.put('reveal', view);
				const text = JSON.stringify(view);
				for (const socket of this.ctx.getWebSockets()) {
					const to = socket.deserializeAttachment() as Attachment | null;
					if (to?.role === 'player' || to?.role === 'town') sendText(socket, text);
				}
				return;
			}
			case 'script': {
				// Kept apart from the room, so the table's frequent changes don't resend it.
				if (!isScript(message.script)) return;
				const view: ScriptView = { type: 'script', script: message.script };
				await this.ctx.storage.put('script', view);
				const text = JSON.stringify(view);
				for (const socket of this.ctx.getWebSockets()) {
					const to = socket.deserializeAttachment() as Attachment | null;
					if (to?.role === 'player' || to?.role === 'town' || to?.role === 'admin')
						sendText(socket, text);
				}
				return;
			}
			case 'viewers': {
				const next = setViewers(room, message.keyHash, message.password);
				if (next.viewerKeyHash === room.viewerKeyHash) {
					if (next.viewerPassword !== room.viewerPassword) await this.save(next);
					return;
				}
				// A link turned off (or replaced) stops working now, and its grimoire is deleted.
				await this.ctx.storage.delete('grimoire');
				for (const socket of this.ctx.getWebSockets()) {
					const to = socket.deserializeAttachment() as Attachment | null;
					if (to?.role !== 'viewer') continue;
					send(socket, { type: 'refused', reason: 'not-viewer' });
					closeSocket(socket, 4403, 'Link turned off');
				}
				this.tellWatchers();
				room = next;
				break;
			}
			case 'grimoire': {
				if (!isSharedGrimoire(message.grimoire)) return;
				const view: GrimoireView = { type: 'grimoire', grimoire: message.grimoire };
				// A transfer that brings the game keeps the latest for the device taking over.
				await keepsTransferGame(room, this.ctx.storage, view);
				if (!room.viewerKeyHash && this.admins() === 0) return;
				// Kept only for the view-only link; an admin's copy is passed on and never stored.
				if (room.viewerKeyHash) await this.ctx.storage.put('grimoire', view);
				const text = JSON.stringify(view);
				for (const socket of this.ctx.getWebSockets()) {
					const to = socket.deserializeAttachment() as Attachment | null;
					if (to?.role === 'viewer' || to?.role === 'admin') sendText(socket, text);
				}
				return;
			}
			case 'open-transfer':
				room = openTransfer(room, message.codeHash, message.bringGame, Date.now());
				await closeTransferGame(room, this.ctx.storage);
				break;
			case 'close-transfer':
				room = closeTransfer(room);
				await closeTransferGame(room, this.ctx.storage);
				break;
			case 'answer-transfer':
				await answerTransfer(this.transferRoom(), room, message.allow);
				return;
			case 'unseat':
				room = unseat(room, message.memberId);
				break;
			case 'remove': {
				room = removeMember(room, message.memberId);
				for (const socket of this.ctx.getWebSockets()) {
					const to = socket.deserializeAttachment() as Attachment | null;
					if (to?.role === 'player' && to.memberId === message.memberId) refuseRemoved(socket);
				}
				break;
			}
			case 'let-back-in':
				room = letBackIn(room, message.memberId);
				break;
			case 'judge-picture': {
				const next = judgePicture(room, message.hash, message.allow);
				if (next === room) return;
				// A picture taken away is deleted, so no grim can load it again.
				const owner = room.members.find((m) => m.picture === message.hash && !message.allow);
				room = next;
				if (owner) await this.dropAvatarPicture(message.hash, owner.memberId);
				break;
			}
			case 'read-messages':
			case 'unread-messages': {
				const next = readMessages(room, message.ids, message.type === 'read-messages');
				if (next === room) return;
				room = next;
				break;
			}
			case 'seat':
				room = seat(room, message.memberId, message.seatId);
				break;
			case 'open-vote':
				room = openVote(room, message.voteId, message.options, message.ability);
				break;
			case 'close-vote':
				room = closeVote(room);
				break;
			case 'game-over':
				room = gameOver(room, message.gameId, message.winner, message.reason);
				break;
			case 'reopen-game':
				room = reopenGame(room, message.gameId);
				await this.dropReveal(room);
				break;
			case 'choosing':
				room = setChoosing(room, message.on);
				break;
			case 'open-script-vote':
				room = openScriptVote(
					room,
					message.voteId,
					message.kind,
					message.options,
					message.minutes,
					Date.now(),
					message.subject,
					message.showTally
				);
				break;
			case 'script-vote-tally':
				room = showScriptVoteTally(room, message.show);
				break;
			case 'end-script-vote':
				room = endScriptVote(room, Date.now());
				break;
			case 'close-script-vote':
				room = closeScriptVote(room);
				break;
			case 'roles':
				room = setRoles(room, message.gameId, message.show, message.roles);
				break;
			case 'call-town': {
				// Not kept: only phones here now hear it (plan U2).
				const now = Date.now();
				if (!canCallTown(this.lastCallTown, now)) return;
				this.lastCallTown = now;
				const text = JSON.stringify({ type: 'call-town' } satisfies ServerMessage);
				const showing = new Set<string>();
				for (const socket of this.ctx.getWebSockets()) {
					const to = socket.deserializeAttachment() as Attachment | null;
					if (to?.role !== 'player') continue;
					sendText(socket, text);
					if (to.showing && socket.readyState === WebSocket.OPEN) showing.add(to.memberId);
				}
				// Phones locked or with the app closed get it as a notification (plan U12).
				this.ctx.waitUntil(pushCallTown(this.env, this.ctx.storage, showing));
				return;
			}
			case 'town-sound': {
				// Not kept: only the Public Town displays here now play it (plan U10).
				const command = parseTownSound(message);
				if (!command) return;
				const text = JSON.stringify({ type: 'town-sound', ...command } satisfies ServerMessage);
				for (const socket of this.ctx.getWebSockets()) {
					const to = socket.deserializeAttachment() as Attachment | null;
					if (to?.role === 'town') sendText(socket, text);
				}
				return;
			}
			case 'close':
				this.broadcastClosed('Room closed');
				await this.forget();
				return;
			default:
				return;
		}
		await this.save(room);
	}

	/** The shared finished grimoire goes once its game runs again or another one starts. */
	private async dropReveal(room: RoomState): Promise<void> {
		const reveal = await this.ctx.storage.get<RevealView>('reveal');
		if (reveal && !canReveal(room, reveal.gameId)) await this.ctx.storage.delete('reveal');
	}

	/**
	 * A viewer leaving changes the Storyteller's count of who is watching; a phone leaving
	 * changes who is here now, which the other phones show as their seats' candles.
	 */
	async webSocketClose(ws: WebSocket): Promise<void> {
		const who = ws.deserializeAttachment() as Attachment | null;
		if (who?.role === 'viewer') this.tellWatchers(ws);
		if (who?.role === 'admin') this.tellGrimoireWanted(ws);
		if (who?.role === 'player' || who?.role === 'claim') {
			const room = await this.load();
			if (room && who.role === 'claim') await claimGone(this.transferRoom(), room, who.keyHash);
			else if (room) {
				this.tellHost(room, ws);
				this.tellPlayers(room, ws);
			}
		}
	}

	/** The members with a phone connected now, leaving out one that is going. */
	private present(going?: WebSocket): Set<string> {
		const ids = new Set<string>();
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (who?.role === 'player' && socket !== going && socket.readyState === WebSocket.OPEN)
				ids.add(who.memberId);
		}
		return ids;
	}

	/** Sends the Storyteller's device its view, without storing anything. */
	private tellHost(room: RoomState, going?: WebSocket): void {
		const text = JSON.stringify(hostView(room, this.present(going)));
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (who?.role === 'host') sendText(socket, text);
		}
	}

	/** Sends each phone its view again, without storing anything: who is here has changed. */
	private tellPlayers(room: RoomState, going: WebSocket): void {
		const present = this.present(going);
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (who?.role === 'player' && socket !== going)
				sendText(socket, JSON.stringify(playerView(room, who.memberId, present)));
		}
	}

	/** Viewers still connected, leaving out one that is going. */
	private watchers(going?: WebSocket): number {
		let count = 0;
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (who?.role === 'viewer' && socket !== going && socket.readyState === WebSocket.OPEN)
				count++;
		}
		return count;
	}

	/** Admins watching from Live games now, leaving out one that is going. */
	private admins(going?: WebSocket): number {
		let count = 0;
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (who?.role === 'admin' && socket !== going && socket.readyState === WebSocket.OPEN)
				count++;
		}
		return count;
	}

	/** Tells the Storyteller's device whether an admin wants the whole grimoire now. */
	private tellGrimoireWanted(going?: WebSocket): void {
		const text = JSON.stringify({ type: 'grimoire-wanted', on: this.admins(going) > 0 });
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (who?.role === 'host') sendText(socket, text);
		}
	}

	/** Sends the Storyteller's device how many are watching. */
	private tellWatchers(going?: WebSocket): void {
		const text = JSON.stringify({ type: 'watchers', count: this.watchers(going) });
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (who?.role === 'host') sendText(socket, text);
		}
	}

	/** What a transfer needs from this room (room-transfer.ts). */
	private transferRoom(): TransferRoom {
		return {
			storage: this.ctx.storage,
			sockets: () => this.ctx.getWebSockets(),
			save: (room) => this.save(room)
		};
	}

	/** Stores the room and sends every device its updated view. */
	private async save(room: RoomState): Promise<void> {
		await this.ctx.storage.put('room', room);
		const present = this.present();
		const host = JSON.stringify(hostView(room, present));
		const town = JSON.stringify(townView(room));
		for (const socket of this.ctx.getWebSockets()) {
			const who = socket.deserializeAttachment() as Attachment | null;
			if (!who || who.role === 'viewer' || who.role === 'claim') continue;
			sendText(
				socket,
				who.role === 'host'
					? host
					: who.role === 'town' || who.role === 'admin'
						? town
						: JSON.stringify(playerView(room, who.memberId, present))
			);
		}
	}

	private broadcastClosed(reason: string): void {
		for (const socket of this.ctx.getWebSockets()) {
			send(socket, { type: 'closed' });
			closeSocket(socket, 1000, reason);
		}
	}
}

const clientAddress = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'local';

/**
 * `POST /api/rooms` opens a room (body: the host key's hash) and returns its code;
 * `GET /api/room/<code>` says whether it is open and what game it holds (`RoomPreview`), or
 * upgrades to the room's WebSocket; `/api/room/<code>/image/<hash>` uploads (PUT) or loads
 * (GET) one of its pictures.
 * Returns undefined for other paths.
 */
export async function handleRoom(
	request: Request,
	env: RoomEnv & AccountEnv,
	url: URL
): Promise<Response | undefined> {
	if (url.pathname === '/api/rooms') {
		if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
		const limit = await env.ROOM_CREATES.limit({ key: clientAddress(request) });
		if (!limit.success) return new Response('Too many rooms', { status: 429 });
		const body = (await request.json().catch(() => null)) as { hostKeyHash?: unknown } | null;
		const hash = body?.hostKeyHash;
		if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) {
			return new Response('Bad request', { status: 400 });
		}
		// 10^6 codes and rooms last a day, so a free one is found within a few tries.
		for (let attempt = 0; attempt < 8; attempt++) {
			const code = makeRoomCode(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
			if (await env.ROOMS.get(env.ROOMS.idFromName(code)).open(hash, code)) {
				return Response.json({ code });
			}
		}
		return new Response('No free room code', { status: 503 });
	}
	const image = parseRoomImagePath(url.pathname);
	if (image) {
		const code = normaliseRoomCode(image.code);
		if (!code) return new Response('Invalid room code', { status: 400 });
		// Uploads count as opening rooms; loading needs the picture's hash, which can't be guessed.
		if (request.method === 'PUT') {
			const limit = await env.ROOM_CREATES.limit({ key: clientAddress(request) });
			if (!limit.success) return new Response('Too many pictures', { status: 429 });
		}
		return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
	}
	const match = url.pathname.match(/^\/api\/room\/([^/]+)$/);
	if (!match) return undefined;
	const code = normaliseRoomCode(match[1]);
	if (!code) return new Response('Invalid room code', { status: 400 });
	if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
	// Limits guessing codes: a room shows only names and seats, but strangers shouldn't browse.
	const limit = await env.ROOM_JOINS.limit({ key: clientAddress(request) });
	if (!limit.success) return new Response('Too many tries', { status: 429 });
	return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(await withAccount(request, env));
}
