import type { RawData, WebSocket } from "ws";
import { joinBoard, joinOrg, leaveBoard, leaveOrg } from "./rooms/roomManager";

export function router(ws: WebSocket, userId: number, data: RawData) {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch {
    ws.send(
      JSON.stringify({
        error: "invalid JSON",
      }),
    );
    return;
  }

  switch (message.type) {
    case "join:Org":
      if (!message.orgId) {
        return ws.send("invalid inputs");
      }
      joinOrg(message.orgId, ws, userId);
      break;

    case "leave:Org":
      if (!message.orgId) {
        return ws.send("invalid inputs");
      }
      leaveOrg(ws);
      break;

    case "join:Board":
      if (!message.boardId) {
        return ws.send("invalid inputs");
      }
      joinBoard(message.boardId, ws);
      break;

    case "leave:Board":
      if (!message.boardId) {
        return ws.send("invalid inputs");
      }
      leaveBoard(ws);
      break;

    default:
      ws.send(
        JSON.stringify({
          error: "unknown msg type",
        }),
      );
  }
}
