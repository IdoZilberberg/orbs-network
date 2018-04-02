import * as WebSocket from "ws";

import { logger, types } from "../common-library";
import { Signatures } from "../common-library";
import * as stringify from "json-stable-stringify";
import * as _ from "lodash";

function handleWSError(address: string, url: string) {
  return (err: Error) => {
    if (err) {
      logger.error(`WebSocket error`, { err });
      logger.error(`Error sending unicast message to ${address} (${url})`);
    }
  };
}

export class Gossip {
  localAddress: string;
  server: WebSocket.Server;
  clients: Map<string, WebSocket> = new Map();
  listeners: Map<string, any> = new Map();
  peers: any;
  readonly port: number;
  signatures: Signatures;
  signMessages: boolean;

  constructor(input: { localAddress: string, port: number, peers: types.ClientMap, signatures: Signatures, signMessages: boolean }) {
    this.port = input.port;
    this.server = new WebSocket.Server({ port: input.port });
    this.peers = input.peers;
    this.localAddress = input.localAddress;
    this.signatures = input.signatures;
    this.signMessages = input.signMessages;

    this.server.on("connection", (ws) => {
      this.prepareConnection(ws);
    });
  }

  helloMessage(): Buffer {
    return new Buffer(stringify({ sender: this.localAddress, hello: true }));
  }

  prepareConnection(ws: WebSocket) {
    let remoteAddress: string = undefined;

    ws.on("terminate", () => {
      if (remoteAddress) {
        logger.info("*** remote", remoteAddress, "disconnected.");
        this.clients.delete(remoteAddress);
      }
    });

    ws.on("message", (message: Buffer) => {
      const rawMessage = JSON.parse(message.toString());
      const { sender, hello, recipient, broadcastGroup, objectType, buffer, signature } = rawMessage;

      if (this.localAddress == sender) {
        logger.info("Connected to myself. Disconnecting");
        ws.close();
        return;
      }

      if (hello) {
        // 'hello' message
        remoteAddress = sender;
        this.clients.set(sender, ws);
        logger.info("Registering connection", this.localAddress, "->", sender);
        return;
      }

      if (!_.isEmpty(recipient) && recipient !== this.localAddress) {
        return;
      }

      const payload = Buffer.from(buffer.data);

      if (this.signMessages) {
        if (!this.signatures.verifyMessage(payload, signature.toString("base64"), sender)) {
          throw new Error(`Could not verify message from ${sender}`);
        }
      }

      if (!this.listeners.has(broadcastGroup)) {
        const peer = this.peers[broadcastGroup];
        if (!peer) {
          throw new Error(`Invalid broadcast group: [${broadcastGroup}]`);
        }
        this.listeners.set(broadcastGroup, peer);
      }

      this.listeners.get(broadcastGroup).gossipMessageReceived({
        fromAddress: sender,
        broadcastGroup,
        messageType: objectType,
        buffer: payload
      });
    });

    ws.send(this.helloMessage());
  }

  connect(peers: string[]) {
    for (const peer of peers) {
      const ws: WebSocket = new WebSocket(peer);
      ws.addEventListener("open", () => { this.prepareConnection(ws); });
    }
  }

  broadcastMessage(broadcastGroup: string, objectType: string, object: Buffer, immediate: boolean) {
    const signature = this.signMessages ? this.signatures.signMessage(object) : undefined;

    const message = new Buffer(stringify({
      sender: this.localAddress,
      broadcastGroup,
      objectType,
      buffer: object,
      signature
    }));

    this.clients.forEach((client: WebSocket, address: string) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message, handleWSError(address, client.url));
      }
    });
  }

  unicastMessage(recipientAddress: string, broadcastGroup: string, objectType: string, object: Buffer, immediate: boolean) {
    const remote: WebSocket = this.clients.get(recipientAddress);
    const signature = this.signMessages ? Buffer.from(this.signatures.signMessage(object), "base64") : undefined;

    const message = new Buffer(stringify({
      sender: this.localAddress,
      recipient: recipientAddress,
      broadcastGroup,
      objectType,
      buffer: object,
      signature
    }));

    if (remote) {
      remote.send(message, handleWSError(recipientAddress, remote.url));
    }
    else {
      this.clients.forEach((remote: WebSocket, address) => {
        remote.send(message, handleWSError(recipientAddress, remote.url));
      });
    }
  }

  public activeBroadcastGroups() {
    return Object.keys(this.peers);
  }

  async shutdown(): Promise<void> {
    return new Promise<void>((resolve, reject) => this.server.close((err) => {
      err ? reject(err) : resolve();
    }));
  }

  public activePeers() {
    return this.clients.keys();
  }
}
