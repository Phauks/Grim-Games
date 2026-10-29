/**
 * A room's transfer to another Storyteller's device (core/sync/room-transfer.ts): the device
 * taking over says hello as `claim` with its new host key, checks the code, then asks to take
 * the room, and the Storyteller's device allows it or turns it down.
 * Kept apart from room.ts so each stays a readable size.
 */
import { sha256Hex as sha256 } from '../src/lib/core/codes/hash.ts';
import {
	askTransfer,
	checkTransfer,
	completeTransfer,
	dropAsk,
	liveTransfer,
	transferDetails,
	TRANSFER_CODE_LENGTH,
	type ClientMessage,
	type GrimoireView,
	type RoomState
} from '../src/lib/core/sync/room.ts';
import { closeSocket, send, type Attachment } from './room-sockets.ts';

/** The game on the table, sent while a transfer brings it (kept apart from Grim view's copy). */
const TRANSFER_GAME = 'transfer-grimoire';

const CODE = new RegExp(`^[0-9]{${TRANSFER_CODE_LENGTH}}$`);

/** What the room lends a transfer: its storage, its sockets and how it saves. */
export interface TransferRoom {
	storage: DurableObjectStorage;
	sockets(): WebSocket[];
	save(room: RoomState): Promise<void>;
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
	if (typeof message.code !== 'string' || !CODE.test(message.code)) return;
	const check = checkTransfer(room, await sha256(message.code), Date.now());
	if (!check.ok) {
		if (check.room !== room) {
			await host.save(check.room);
			await closeTransferGame(check.room, host.storage);
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
	return host.sockets().find((socket) => {
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
		? await host.storage.get<GrimoireView>(TRANSFER_GAME)
		: undefined;
	for (const socket of host.sockets()) {
		const who = socket.deserializeAttachment() as Attachment | null;
		if (who?.role === 'host') {
			send(socket, { type: 'handed-over' });
			closeSocket(socket, 4409, 'Room transferred');
		} else if (who?.role === 'viewer') {
			send(socket, { type: 'refused', reason: 'not-viewer' });
			closeSocket(socket, 4403, 'Link turned off');
		}
	}
	await host.storage.delete([TRANSFER_GAME, 'grimoire']);
	await host.save(completeTransfer(room, asking.keyHash));
	send(ws, { type: 'transferred', ...(game ? { grimoire: game.grimoire } : {}) });
	closeSocket(ws, 1000, 'Room transferred');
}

/** The asking device went before the Storyteller answered: the question goes too. */
export async function claimGone(host: TransferRoom, room: RoomState, keyHash: string) {
	if (room.transfer?.asking?.keyHash === keyHash) await host.save(dropAsk(room));
}
