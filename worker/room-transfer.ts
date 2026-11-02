/**
 * A room's transfer to another Storyteller's device (core/sync/room-transfer.ts): the device
 * taking over says hello as `claim` with its new host key, checks the code, then asks to take
 * the room, and the Storyteller's device allows it or turns it down. Or the Storyteller hands
 * it to a friend in the room (plan F14), whose signed-in device takes it with no code.
 * Kept apart from room.ts so each stays a readable size.
 */
import { sha256Hex as sha256 } from '../src/lib/core/codes/hash.ts';
import {
	askTransfer,
	checkTransfer,
	closeTransfer,
	completeTransfer,
	dropAsk,
	liveTransfer,
	offeredTransfer,
	offerTransfer,
	openTransfer,
	transferDetails,
	TRANSFER_CODE_LENGTH,
	type ClientMessage,
	type GrimoireView,
	type RoomState
} from '../src/lib/core/sync/room.ts';
import { friendBook, type FriendsEnv } from './friends/routes.ts';
import { accountPhones, socketAccount } from './room-accounts.ts';
import { closeSocket, send, type Attachment } from './room-sockets.ts';

/** The game on the table, sent while a transfer brings it (kept apart from Grim view's copy). */
const TRANSFER_GAME = 'transfer-grimoire';

const CODE = new RegExp(`^[0-9]{${TRANSFER_CODE_LENGTH}}$`);

/** What the room lends a transfer: its state (storage, sockets), friend books and how it saves. */
export interface TransferRoom {
	ctx: DurableObjectState;
	env: Pick<FriendsEnv, 'FRIEND_BOOKS' | 'DATA'>;
	save(room: RoomState): Promise<void>;
}

type HostTransferMessage = Extract<
	ClientMessage,
	{ type: 'open-transfer' | 'close-transfer' | 'answer-transfer' | 'offer-transfer' }
>;

/** A transfer message from the Storyteller's device (`ws`): open, close, answer or hand over. */
export async function hostTransfer(
	host: TransferRoom,
	ws: WebSocket,
	room: RoomState,
	message: HostTransferMessage
): Promise<void> {
	if (message.type === 'answer-transfer') return answerTransfer(host, room, message.allow);
	if (message.type === 'offer-transfer') return offerToFriend(host, ws, room, message.to);
	const next =
		message.type === 'open-transfer'
			? openTransfer(room, message.codeHash, message.bringGame, Date.now())
			: closeTransfer(room);
	await closeTransferGame(next, host.ctx.storage);
	await host.save(next);
}

/** Whether the two accounts are friends, each in the other's book. */
async function mutualFriends(host: TransferRoom, a: string, b: string): Promise<boolean> {
	try {
		const [one, two] = await Promise.all([
			friendBook(host.env, a).relationTo(b),
			friendBook(host.env, b).relationTo(a)
		]);
		return one.friend && two.friend;
	} catch {
		return false;
	}
}

/**
 * The Storyteller hands the open transfer to a friend in the room (plan F14): only when the
 * Storyteller's device is signed in, the friend is a friend both ways, and has a phone here
 * now. Their phones are told; anything else, the Storyteller's device hears it was refused.
 */
async function offerToFriend(
	host: TransferRoom,
	ws: WebSocket,
	room: RoomState,
	to: unknown
): Promise<void> {
	const mine = socketAccount(host.ctx, ws);
	const now = Date.now();
	const phones = mine && typeof to === 'string' && to !== mine ? accountPhones(host.ctx, to) : [];
	const ok =
		phones.length > 0 &&
		!!liveTransfer(room, now) &&
		(await mutualFriends(host, mine!, to as string));
	if (!ok) {
		send(ws, { type: 'transfer-offer-refused' });
		return;
	}
	await host.save(offerTransfer(room, to, now));
	for (const phone of phones) send(phone, { type: 'transfer-offer' });
}

/**
 * A device the room was handed to (plan F14), with no code: only one signed in as that
 * account. The Storyteller already chose them, so `take-room` hands it over at once, through
 * the same steps as an allowed ask; the old device is let go as it is then.
 */
async function offeredClaim(
	host: TransferRoom,
	ws: WebSocket,
	keyHash: string,
	message: Extract<ClientMessage, { type: 'check-transfer' | 'take-room' }>,
	room: RoomState
): Promise<void> {
	if (!offeredTransfer(room, socketAccount(host.ctx, ws), Date.now())) {
		send(ws, { type: 'transfer-refused', triesLeft: 0 });
		return;
	}
	if (message.type === 'check-transfer') {
		send(ws, { type: 'transfer', details: transferDetails(room) });
		return;
	}
	const name = 'name' in message ? message.name : undefined;
	await answerTransfer(host, askTransfer(room, keyHash, name), true);
}

/** Keeps the Storyteller's latest grimoire while an open transfer brings the game. */
export async function keepsTransferGame(
	room: RoomState,
	storage: DurableObjectStorage,
	view: GrimoireView
): Promise<void> {
	if (room.transfer?.bringGame) await storage.put(TRANSFER_GAME, view);
}

/** The transfer ended or stopped bringing the game: its grimoire goes. */
export async function closeTransferGame(
	room: RoomState,
	storage: DurableObjectStorage
): Promise<void> {
	if (!room.transfer?.bringGame) await storage.delete(TRANSFER_GAME);
}

/**
 * A message from a device taking over. `check-transfer` says whether the code is right (and
 * what comes with the room); `take-room` checks it again and asks the Storyteller's device,
 * which answers with `answer-transfer` (answerTransfer).
 */
export async function claimMessage(
	host: TransferRoom,
	ws: WebSocket,
	keyHash: string,
	message: ClientMessage,
	room: RoomState
): Promise<void> {
	if (message.type !== 'check-transfer' && message.type !== 'take-room') return;
	if (message.offer === true) return offeredClaim(host, ws, keyHash, message, room);
	if (typeof message.code !== 'string' || !CODE.test(message.code)) return;
	const check = checkTransfer(room, await sha256(message.code), Date.now());
	if (!check.ok) {
		if (check.room !== room) {
			await host.save(check.room);
			await closeTransferGame(check.room, host.ctx.storage);
		}
		send(ws, { type: 'transfer-refused', triesLeft: check.triesLeft });
		return;
	}
	if (message.type === 'check-transfer') {
		send(ws, { type: 'transfer', details: transferDetails(room) });
		return;
	}
	await host.save(askTransfer(room, keyHash, message.name));
}

/** The asking device's socket, while it is still connected. */
function askingSocket(host: TransferRoom, keyHash: string): WebSocket | undefined {
	return host.ctx.getWebSockets().find((socket) => {
		const who = socket.deserializeAttachment() as Attachment | null;
		return who?.role === 'claim' && who.keyHash === keyHash;
	});
}

/**
 * The Storyteller's answer. Allowed, and the transfer still live, the host key changes hands:
 * the old Storyteller's device is told and let go, Grim view's viewers too, and the new one
 * gets the game when it comes along, then reconnects as the host. Turned down, the asking
 * device is told and the transfer stays open.
 */
export async function answerTransfer(
	host: TransferRoom,
	room: RoomState,
	allow: unknown
): Promise<void> {
	const asking = room.transfer?.asking;
	if (!asking) return;
	const ws = askingSocket(host, asking.keyHash);
	if (allow !== true || !ws || !liveTransfer(room, Date.now())) {
		if (ws) send(ws, { type: 'transfer-denied' });
		await host.save(dropAsk(room));
		return;
	}
	const game = room.transfer?.bringGame
		? await host.ctx.storage.get<GrimoireView>(TRANSFER_GAME)
		: undefined;
	for (const socket of host.ctx.getWebSockets()) {
		const who = socket.deserializeAttachment() as Attachment | null;
		if (who?.role === 'host') {
			send(socket, { type: 'handed-over' });
			closeSocket(socket, 4409, 'Room transferred');
		} else if (who?.role === 'viewer') {
			send(socket, { type: 'refused', reason: 'not-viewer' });
			closeSocket(socket, 4403, 'Link turned off');
		}
	}
	await host.ctx.storage.delete([TRANSFER_GAME, 'grimoire']);
	await host.save(completeTransfer(room, asking.keyHash));
	send(ws, { type: 'transferred', ...(game ? { grimoire: game.grimoire } : {}) });
	closeSocket(ws, 1000, 'Room transferred');
}

/** The asking device went before the Storyteller answered: the question goes too. */
export async function claimGone(host: TransferRoom, room: RoomState, keyHash: string) {
	if (room.transfer?.asking?.keyHash === keyHash) await host.save(dropAsk(room));
}
