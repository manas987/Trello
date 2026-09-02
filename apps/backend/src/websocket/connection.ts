import { WebSocketServer, WebSocket } from "ws";
import { type Server } from "http";
import { authWs } from "../middleware/auth";
import { addUserSocket, removeSocket } from "./rooms/roomManager";
import { router } from "./router";

export function websocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws, request) => {
    const userid = await authWs(ws, request);
    addUserSocket(userid, ws);
    ws.send("connected");
    ws.on("message", (data) => {
      router(ws, userid, data);
    });
    ws.on("close", () => {
      removeSocket(ws);
      ws.send("connection closed");
    });
    ws.on("error", (error) => {
      console.log(error);
    });
  });
}
