import { createServer } from "http";
import crypto from "crypto";

const PORT = 1338;
const WEB_SOCKET_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const server = createServer((request, response) => {
  response.writeHead(200);
  //   throw new Error("Simulated server error");
  response.end("Hello, World!");
}).listen(PORT, () => console.log(`Server is listening on port ${PORT}`));

server.on("upgrade", onSocketUpgrade);

function onSocketUpgrade(request, socket, head) {
  const { "sec-websocket-key": WebSocketKey } = request.headers;
  const header = prepareHandshakeHeader(WebSocketKey);
  console.log(header);
}

function prepareHandshakeHeader(id) {
  const acceptKey = createSocketAccept(id);
  return acceptKey;
}

function createSocketAccept(id) {
  const shaun = crypto.createHash("sha1");
  shaun.update(id + WEB_SOCKET_MAGIC_STRING);
  return shaun.digest("base64");
}
// error handling
["uncaughtException", "unhandledRejection"].forEach((event) => {
  process.on(event, (err) => {
    console.error(`There was an ${event}`, err.stack || err);
  });
});
