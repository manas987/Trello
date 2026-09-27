import "dotenv/config";
import express from "express";
import cors from "cors";
import { router } from "./router";
import { websocketServer } from "./websocket/connection";

const app = express();

app.use(cors());
app.use(express.json());
app.use(router);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

websocketServer(server);
