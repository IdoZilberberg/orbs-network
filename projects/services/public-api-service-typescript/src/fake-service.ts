import * as express from "express";
import { Server } from "http";
import * as bodyParser from "body-parser";
import { ConstantTransactionHandlerConfig } from "./service";
import { types, Service, ServiceConfig, JsonBuffer, PublicApi, TransactionHandler } from "orbs-core-library";

export default class FakePublicApiHttpService extends Service {
  private publicApi: PublicApi;
  private transactionHandler: TransactionHandler;
  public app: express.Express;

  public constructor(virtualMachine: types.VirtualMachineClient, transactionPool: types.TransactionPoolClient, subscriptionManager: types.SubscriptionManagerClient, serviceConfig: ServiceConfig) {
    super(serviceConfig);
    this.transactionHandler = new TransactionHandler(transactionPool, subscriptionManager, new ConstantTransactionHandlerConfig(false));
    this.publicApi = new PublicApi(this.transactionHandler, virtualMachine);
  }

  async initialize() {
    this.app = express();
    this.app.use(bodyParser.raw({ type: "*/*" }));

    this.app.use("/public/sendTransaction", async (req: express.Request, res: express.Response, ) => {
      const body = JsonBuffer.parseJsonWithBuffers(req.body);
      res.send(await this.publicApi.sendTransaction(body));
    });

    this.app.use("/public/callContract", async (req: express.Request, res: express.Response) => {
      const body = JsonBuffer.parseJsonWithBuffers(req.body);
      res.send(await this.publicApi.callContract(body));
    });
  }

  async shutdown() {

  }
}
