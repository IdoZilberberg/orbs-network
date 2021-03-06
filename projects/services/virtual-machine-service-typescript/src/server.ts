
import { grpcServer, topologyPeers, logger, VirtualMachine } from "orbs-core-library";
import VirtualMachineService from "./service";


function parseContractList(smartContractsToLoad: string) {
    try {
      return JSON.parse(smartContractsToLoad);
    } catch (err) {
      logger.error(`Bad contract list from env: ${smartContractsToLoad} of type ${typeof smartContractsToLoad}. Defaulting to empty list of contracts.`);
      return [];
    }
  }

export default function(nodeTopology: any, env: any) {
    const { NODE_NAME, SMART_CONTRACTS_TO_LOAD } = env;

    if (!NODE_NAME) {
        throw new Error("NODE_NAME can't be empty!");
    }

    const peers = topologyPeers(nodeTopology.peers);
    const nodeConfig = { nodeName: NODE_NAME};

    const contractRegistryConfig = {
        contracts: parseContractList(SMART_CONTRACTS_TO_LOAD)
    };

    const virtualMachine = new VirtualMachine(contractRegistryConfig, peers.stateStorage);
    return grpcServer.builder()
                     .withService("VirtualMachine", new VirtualMachineService(virtualMachine, nodeConfig));
}
