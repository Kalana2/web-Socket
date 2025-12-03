/**
 * Raw WebSocket Server Implementation
 *
 * This is a from-scratch implementation of the WebSocket protocol (RFC 6455)
 * without using any WebSocket libraries. It demonstrates the low-level details
 * of the WebSocket handshake and frame parsing.
 *
 * @author Kalana Jinendra
 * @version 1.0.0
 */

// filepath: /home/snake/Projects/web Socket/webSocketVer 1/nodejs-raw-websocket/server.mjs
import { createServer } from "http";
import crypto from "crypto";

// Configuration constants
const PORT = 1338;

/**
 * Magic string defined in RFC 6455 for WebSocket handshake
 * This GUID is concatenated with the client's key and hashed
 */
const WEB_SOCKET_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/**
 * Payload length indicators according to WebSocket protocol:
 * - 0-125: Actual payload length
 * - 126: Next 2 bytes contain the length (16-bit)
 * - 127: Next 8 bytes contain the length (64-bit)
 */
const SEVEN_BIT_INTIGER_MARKER = 125;
const SIXTEEN_BIT_INTIGER_MARKER = 126;
const SIXTYFOUR_BIT_INTIGER_MARKER = 127;

/**
 * First bit mask (10000000 in binary = 128 in decimal)
 * Used to check if the MASK bit is set in client-to-server messages
 * parseInt('10000000', 2) = 128
 */
const FIRST_BIT = 128;

/**
 * WebSocket opcodes (4 bits)
 * - 0x0: Continuation frame
 * - 0x1: Text frame
 * - 0x2: Binary frame
 * - 0x8: Connection close
 * - 0x9: Ping
 * - 0xA: Pong
 */
const OPCODES = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
};

/**
 * Create HTTP server
 * The server handles regular HTTP requests and can be upgraded to WebSocket
 */
const server = createServer((request, response) => {
  response.writeHead(200);
  response.end(
    "Hello, World! This is a WebSocket server. Connect via ws://localhost:" +
      PORT
  );
}).listen(PORT, () => {
  console.log(`🚀 WebSocket Server is listening on port ${PORT}`);
  console.log(`📡 Connect via: ws://localhost:${PORT}`);
});

/**
 * Listen for upgrade events to switch from HTTP to WebSocket protocol
 * This event is triggered when a client sends an Upgrade: websocket header
 */
server.on("upgrade", onSocketUpgrade);

/**
 * Handle WebSocket upgrade handshake
 *
 * This function is called when a client requests to upgrade the connection
 * from HTTP to WebSocket. It performs the handshake by:
 * 1. Extracting the Sec-WebSocket-Key from request headers
 * 2. Computing the accept key using SHA-1 hash
 * 3. Sending the handshake response headers
 * 4. Setting up listeners for incoming data
 *
 * @param {http.IncomingMessage} request - The HTTP request object
 * @param {net.Socket} socket - The network socket
 * @param {Buffer} head - The first packet of the upgraded stream
 */
function onSocketUpgrade(request, socket, head) {
  const { "sec-websocket-key": webSocketKey } = request.headers;
  console.log(`\n🔄 Upgrading to WebSocket connection`);
  console.log(`🔑 Client Key: ${webSocketKey}`);

  const header = prepareHandshakeHeader(webSocketKey);
  socket.write(header);
  console.log(`✅ Handshake complete, WebSocket connection established\n`);

  // Listen for incoming messages from the client
  socket.on("readable", () => onSocketreadable(socket));

  // Handle connection close
  socket.on("end", () => {
    console.log("👋 Client disconnected");
  });

  // Handle errors
  socket.on("error", (err) => {
    console.error("❌ Socket error:", err.message);
  });
}

/**
 * Parse and handle incoming WebSocket frames
 *
 * WebSocket Frame Structure (Client to Server):
 *
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-------+-+-------------+-------------------------------+
 * |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
 * |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
 * |N|V|V|V|       |S|             |   (if payload len==126/127)   |
 * | |1|2|3|       |K|             |                               |
 * +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
 * |     Extended payload length continued, if payload len == 127  |
 * + - - - - - - - - - - - - - - - +-------------------------------+
 * |                               | Masking-key, if MASK set to 1 |
 * +-------------------------------+-------------------------------+
 * | Masking-key (continued)       |          Payload Data         |
 * +-------------------------------- - - - - - - - - - - - - - - - +
 * :                     Payload Data continued ...                :
 * + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
 * |                     Payload Data continued ...                |
 * +---------------------------------------------------------------+
 *
 * @param {net.Socket} socket - The network socket
 */
function onSocketreadable(socket) {
  // Read first byte: FIN (1 bit) + RSV (3 bits) + Opcode (4 bits)
  const firstByteBuffer = socket.read(1);
  if (!firstByteBuffer) return; // No data available

  const [firstByte] = firstByteBuffer;
  const isFinalFrame = Boolean(firstByte & 0x80); // Check FIN bit
  const opcode = firstByte & 0x0f; // Extract opcode (last 4 bits)

  // Read second byte: MASK (1 bit) + Payload length (7 bits)
  const [secondByte] = socket.read(1);
  const isMasked = Boolean(secondByte & 0x80); // Check MASK bit
  const lengthIndicatorInBits = secondByte - FIRST_BIT; // Remove MASK bit

  // Determine actual message length based on payload length indicator
  let messageLength = 0;

  if (lengthIndicatorInBits <= SEVEN_BIT_INTIGER_MARKER) {
    // Payload length is in the 7 bits (0-125 bytes)
    messageLength = lengthIndicatorInBits;
  } else if (lengthIndicatorInBits === SIXTEEN_BIT_INTIGER_MARKER) {
    // Next 2 bytes contain the length (126-65535 bytes)
    messageLength = socket.read(2).readUInt16BE(0);
  } else if (lengthIndicatorInBits === SIXTYFOUR_BIT_INTIGER_MARKER) {
    // Next 8 bytes contain the length (>65535 bytes)
    const upperBits = socket.read(4).readUInt32BE(0);
    const lowerBits = socket.read(4).readUInt32BE(0);
    messageLength = (upperBits << 32) + lowerBits;
  }

  // Read the masking key (4 bytes) - Always present in client-to-server messages
  const maskKey = socket.read(4);

  // Read the masked payload data
  const encoded = socket.read(messageLength);

  if (!encoded) {
    console.error("❌ Failed to read message payload");
    return;
  }

  // Unmask the data using XOR with the masking key
  // Formula: decoded[i] = encoded[i] XOR maskKey[i MOD 4]
  const decoded = Buffer.alloc(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    decoded[i] = encoded[i] ^ maskKey[i % 4];
  }

  const receivedMessage = decoded.toString("utf8");
  console.log(
    `📩 Received: "${receivedMessage}" (${messageLength} bytes, opcode: ${opcode})`
  );

  // Handle different opcodes
  if (opcode === OPCODES.TEXT) {
    // Echo the message back to the client
    const responseMessage = `Echo: ${receivedMessage}`;
    sendMessage(responseMessage, socket);
  } else if (opcode === OPCODES.CLOSE) {
    console.log("🔌 Close frame received");
    socket.end();
  } else if (opcode === OPCODES.PING) {
    console.log("🏓 Ping received, sending Pong");
    sendPong(decoded, socket);
  }
}

/**
 * Send a text message to the client
 *
 * WebSocket Frame Structure (Server to Client):
 * Server-to-client messages are NOT masked (MASK bit = 0)
 *
 * @param {string} message - The text message to send
 * @param {net.Socket} socket - The network socket
 * @param {number} opcode - The frame opcode (default: TEXT)
 */
function sendMessage(message, socket, opcode = OPCODES.TEXT) {
  const dataBuffer = Buffer.from(message);
  const dataLength = dataBuffer.length;

  let payloadLength;
  let extendedPayloadLength = Buffer.alloc(0);

  // Determine payload length encoding based on message size
  if (dataLength <= SEVEN_BIT_INTIGER_MARKER) {
    // Small message: length fits in 7 bits
    payloadLength = dataLength;
  } else if (dataLength <= 0xffff) {
    // Medium message: use 16-bit extended length
    payloadLength = SIXTEEN_BIT_INTIGER_MARKER;
    extendedPayloadLength = Buffer.alloc(2);
    extendedPayloadLength.writeUInt16BE(dataLength, 0);
  } else {
    // Large message: use 64-bit extended length
    payloadLength = SIXTYFOUR_BIT_INTIGER_MARKER;
    extendedPayloadLength = Buffer.alloc(8);
    extendedPayloadLength.writeUInt32BE(0, 0); // upper 32 bits (0 for messages < 4GB)
    extendedPayloadLength.writeUInt32BE(dataLength, 4); // lower 32 bits
  }

  /**
   * First byte structure:
   * - FIN (1 bit): 1 = final fragment
   * - RSV1-3 (3 bits): 0 = no extensions
   * - Opcode (4 bits): 1 = text frame, 2 = binary frame
   *
   * 0b10000001 = FIN set, text frame
   * 0b10000010 = FIN set, binary frame
   */
  const firstByte = 0x80 | opcode; // FIN bit set + opcode

  /**
   * Second byte structure:
   * - MASK (1 bit): 0 = not masked (server-to-client)
   * - Payload length (7 bits): actual length or indicator
   */
  const secondByte = payloadLength; // MASK = 0 for server messages

  // Construct the frame header
  const header = Buffer.concat([
    Buffer.from([firstByte, secondByte]),
    extendedPayloadLength,
  ]);

  // Send header followed by payload
  socket.write(header);
  socket.write(dataBuffer);

  console.log(`📤 Sent: "${message}" (${dataLength} bytes)`);
}

/**
 * Send a Pong frame in response to a Ping
 *
 * @param {Buffer} data - The payload from the Ping frame
 * @param {net.Socket} socket - The network socket
 */
function sendPong(data, socket) {
  const firstByte = 0x80 | OPCODES.PONG; // FIN + Pong opcode
  const secondByte = data.length; // Payload length (usually small)

  const header = Buffer.from([firstByte, secondByte]);
  socket.write(header);
  socket.write(data);
}

/**
 * Prepare the WebSocket handshake response headers
 *
 * The handshake response must include:
 * - Status: 101 Switching Protocols
 * - Upgrade: websocket
 * - Connection: Upgrade
 * - Sec-WebSocket-Accept: computed hash value
 *
 * @param {string} clientKey - The Sec-WebSocket-Key from client request
 * @returns {string} The complete HTTP response header
 */
function prepareHandshakeHeader(clientKey) {
  const acceptKey = createSocketAccept(clientKey);
  const header = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "\r\n", // Empty line to end headers
  ].join("\r\n");
  return header;
}

/**
 * Create the Sec-WebSocket-Accept value for handshake
 *
 * Algorithm (RFC 6455):
 * 1. Concatenate client key with magic GUID
 * 2. Compute SHA-1 hash of the result
 * 3. Encode the hash in Base64
 *
 * This proves to the client that the server understands WebSocket protocol
 *
 * @param {string} clientKey - The Sec-WebSocket-Key from client
 * @returns {string} Base64-encoded SHA-1 hash
 */
function createSocketAccept(clientKey) {
  const hash = crypto.createHash("sha1");
  hash.update(clientKey + WEB_SOCKET_MAGIC_STRING);
  return hash.digest("base64");
}

/**
 * Global error handlers
 *
 * Catch unhandled exceptions and promise rejections to prevent
 * the server from crashing unexpectedly
 */
["uncaughtException", "unhandledRejection"].forEach((event) => {
  process.on(event, (err) => {
    console.error(`\n❌ ${event}:`, err.stack || err);
  });
});

/**
 * Graceful shutdown handler
 * Clean up resources when the server is terminated
 */
process.on("SIGINT", () => {
  console.log("\n\n👋 Server shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
