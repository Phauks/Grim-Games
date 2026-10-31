/** What the join screen sees of a room before joining it (worker/room.ts, plain HTTP). */
import { normaliseRoomCode } from '../src/lib/core/sync/room-code.ts';
import {
	isRemovedProbe,
	REMOVED_PROBE_HEADER,
	roomPreview,
	type RoomState,
	type ScriptView
} from '../src/lib/core/sync/room.ts';

export async function previewResponse(
	storage: DurableObjectStorage,
	request: Request,
	room: RoomState | undefined
): Promise<Response> {
	const script = room && (await storage.get<ScriptView>('script'));
	// A removed phone is told so as it types the code (plan J37, Trevor 2026-10-31).
	const code = normaliseRoomCode(new URL(request.url).pathname.split('/').pop() ?? '') ?? '';
	const probe = request.headers.get(REMOVED_PROBE_HEADER);
	const removed = !!room && (await isRemovedProbe(room, code, probe));
	return Response.json(roomPreview(room, script?.script, removed));
}
