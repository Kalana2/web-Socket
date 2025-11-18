import { createServer } from "http";
import crypto from "crypto";

const PORT = 1338;
const WEB_SOCKET_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const SEVEN_BIT_INTIGER_MARKER = 125;
const SIXTEEN_BIT_INTIGER_MARKER = 126;
const SIXTYFOUR_BIT_INTIGER_MARKER = 127;

// parseINT ('10000000', 2)
const FIRST_BIT = 128;

const server = createServer((request, response) => {
  response.writeHead(200);
  //   throw new Error("Simulated server error");
  response.end("Hello, World!");
}).listen(PORT, () => console.log(`Server is listening on port ${PORT}`));

server.on("upgrade", onSocketUpgrade);

function onSocketUpgrade(request, socket, head) {
  const { "sec-websocket-key": WebSocketKey } = request.headers;
  console.log(`Upgrading to WebSocket connection, key: ${WebSocketKey}`);
  const header = prepareHandshakeHeader(WebSocketKey);
  console.log(header);
  socket.write(header);
  console.log("WebSocket connection established");
}

function onSocketreadable(socket) {
  // consume optcode (first byte)
  socket.read(1); // 1 byte
  const [markerAndPayloadLenght] = socket.read(1);
  const lengthIndicatorInBits = markerAndPayloadLenght - FIRST_BIT; // first bit is always 1 for client-server messages

  let messagesLength = 0;
}

function prepareHandshakeHeader(id) {
  const acceptKey = createSocketAccept(id);
  const header = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "\r\n",
  ].join("\r\n");
  return header;
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
