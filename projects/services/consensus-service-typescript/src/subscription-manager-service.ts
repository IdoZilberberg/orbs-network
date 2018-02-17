import * as _ from "lodash";
import bind from "bind-decorator";

import { logger, config, topology, topologyPeers, grpc, types } from "orbs-core-library";

import { Service } from "orbs-core-library";
import { SubscriptionManager } from "orbs-core-library";

const nodeTopology = topology();

export default class SubscriptionManagerService extends Service {
  private subscriptionManager: SubscriptionManager;

  private sidechainConnector = topologyPeers(nodeTopology.peers).sidechainConnector;

  @Service.RPCMethod
  public async getHeartbeat(rpc: types.GetHeartbeatContext) {
    logger.debug(`${nodeTopology.name}: service '${rpc.req.requesterName}(v${rpc.req.requesterVersion})' asked for heartbeat`);

    rpc.res = { responderName: nodeTopology.name, responderVersion: nodeTopology.version };
  }

  @Service.RPCMethod
  async getSubscriptionStatus(rpc: types.GetSubscriptionStatusContext) {
    const { id, tokens } = await this.subscriptionManager.getSubscriptionStatus(rpc.req.subscriptionKey);
    rpc.res = { active: tokens.isGreaterThan(0), expiryTimestamp: Date.now() + 24 * 60 * 1000 };
  }

  async askForHeartbeat(peer: types.HeardbeatClient) {
    const res = await peer.getHeartbeat({ requesterName: nodeTopology.name, requesterVersion: nodeTopology.version });
    logger.debug(`${nodeTopology.name}: received heartbeat from '${res.responderName}(v${res.responderVersion})'`);
  }

  askForHeartbeats() {
  }

  async initSubscriptionManager(): Promise<void> {
    const subscriptionManagerConfiguration = { ethereumContractAddress: config.get("ethereumContractAddress") };

    if (!subscriptionManagerConfiguration.ethereumContractAddress) {
      logger.error("ethereumContractAddress wasn't provided! SubscriptionManager is disabled!");

      return;
    }

    this.subscriptionManager = new SubscriptionManager(this.sidechainConnector, subscriptionManagerConfiguration);
  }

  async main() {
    logger.info(`${nodeTopology.name}: service started`);

    await this.initSubscriptionManager();

    setInterval(() => this.askForHeartbeats(), 5000);
  }

  constructor() {
    super();

    setTimeout(() => this.main(), 0);
  }
}
