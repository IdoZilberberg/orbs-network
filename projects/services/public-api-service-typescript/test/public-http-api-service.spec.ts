import { types, ErrorHandler, Service } from "orbs-core-library";
import * as chai from "chai";
import PublicApiHTTPService from "../src/http-service";
import FakePublicApiHTTPService from "../src/fake-service";
import { stubInterface } from "ts-sinon";
import * as sinonChai from "sinon-chai";
import * as getPort from "get-port";
import * as request from "supertest";

chai.use(sinonChai);

const { expect } = chai;

const senderAddress: types.UniversalAddress = {
  id: new Buffer("sender"),
  scheme: 0,
  checksum: 0,
  networkId: 0
};

const contractAddress: types.ContractAddress = {
  address: "contractAddress"
};

const transaction: types.Transaction = {
  header: {
    version: 0,
    sender: senderAddress,
    timestamp: Date.now().toString()
  },
  body: {
    contractAddress,
    payload: Math.random().toString(),
  }
};

const transactionSubscriptionAppendix: types.TransactionSubscriptionAppendix = {
  subscriptionKey: "foobar"
};

const contractInput: types.CallContractInput = {
  contractAddress,
  payload: "some-payload",
  sender: senderAddress
};

describe("Public API Service - Component Test", async function () {
  let virtualMachine: types.VirtualMachineClient;
  let transactionPool: types.TransactionPoolClient;
  let subscriptionManager: types.SubscriptionManagerClient;

  let httpService: Service;
  let httpEndpoint: any;

  const runTests = () => {
    it("sent transaction through http propagates properly to the transaction pool", (done) => {
      request(httpEndpoint)
        .post("/public/sendTransaction")
        .send({ transaction, transactionSubscriptionAppendix })
        .expect(200, () => {
          expect(transactionPool.addNewPendingTransaction).to.have.been.calledWith({
            transaction
          });
          done();
        });
    });

    it("called contract through http propagates properly to the virtual machine", (done) => {
      request(httpEndpoint)
        .post("/public/callContract")
        .send(contractInput)
        .expect(200, () => {
          expect(virtualMachine.callContract).to.have.been.calledWith(contractInput);
          done();
        });
    });

  };

  beforeEach(() => {
    virtualMachine = stubInterface<types.VirtualMachineClient>();
    transactionPool = stubInterface<types.TransactionPoolClient>();
    subscriptionManager = stubInterface<types.SubscriptionManagerClient>();
    (<sinon.SinonStub>subscriptionManager.getSubscriptionStatus).returns({active: true, expiryTimestamp: Date.now() + 10000000});
    (<sinon.SinonStub>virtualMachine.callContract).returns({resultJson: "some-answer"});
  });

  describe("real http api", () => {
    beforeEach(async () => {
      const httpPort = await getPort();
      httpEndpoint = `http://127.0.0.1:${httpPort}`;

      const httpServiceConfig = {
        nodeName: "tester",
        httpPort
      };
      httpService = new PublicApiHTTPService(virtualMachine, transactionPool, subscriptionManager, httpServiceConfig);
      httpService.start();
    });

    runTests();

    afterEach(async () => {
      httpService.shutdown();
    });
  });

  describe("fake http api", () => {
    beforeEach(async () => {
      const httpServiceConfig = {
        nodeName: "tester",
      };

      httpService = new FakePublicApiHTTPService(virtualMachine, transactionPool, subscriptionManager, { nodeName: "fake-http" });
      httpService.start();

      httpEndpoint = (<FakePublicApiHTTPService>httpService).app;
    });

    runTests();
  });
});
