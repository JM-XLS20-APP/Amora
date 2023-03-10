import { createHmac } from "crypto";
import { XummSdk } from "xumm-sdk";
import cors from "cors";
import * as dotenv from 'dotenv'
dotenv.config()

import * as xrpl from "xrpl";


import { getContractAddressesFromGate } from "./api/gates.js";

export function configurePublicApi(app) {
  // this should be limited to app domains that have your app installed
  const corsOptions = {
    origin: "*",
  };
  const xummSdk = new XummSdk(
    process.env.XUMM_KEY,
    process.env.XUMM_SECRET
  );

  // Configure CORS to allow requests to /public from any origin
  // enables pre-flight requests
  app.options("/public/*", cors(corsOptions));

  app.get("/public/signin", cors(corsOptions), async (_req, res) => {
    const requestPayload = {
      txjson: {
        TransactionType: "SignIn",
      },
    };

    try {
      const payload = await xummSdk.payload.createAndSubscribe(
        requestPayload,
        async (event) => {
          if (Object.keys(event.data).indexOf("signed") > -1) {
            return event.data;
          }
        }
      );

      if (payload.created.pushed == false) {
        res.status(200).send({
          qrCode: payload.created.refs.qr_png,
          webSocket: payload.websocket._url,
        });
      }

    } catch (e) {
      console.log(e);
    }
  });

  app.post("/public/gateEvaluation", cors(corsOptions), async (req, res) => {
    // evaluate the gate, message, and signature
    const { shopDomain, productGid, address, gateConfigurationGid } = req.body;

    if (!address) {
      res.status(403).send("No wallet found");
      return;
    }

    // not shown: verify the content of the message

    // retrieve relevant contract addresses from gates
    const requiredContractAddresses = await getContractAddressesFromGate({
      shopDomain,
      productGid,
    });

    try {
      const payloadGenerated = await xummSdk.payload.get(address);
      const walletAddress = payloadGenerated.response.account;

      try {
        const unlockingTokens = await retrieveUnlockingTokens(
          walletAddress,
          requiredContractAddresses
        );

        if (unlockingTokens.length === 0) {
          res.status(403).send({ message: "No unlocking tokens" });
          return;
        }

        const payload = {
          id: gateConfigurationGid,
        };

        const response = { gateContext: [getHmac(payload)], unlockingTokens };
        res.status(200).send(response);
      } catch (e) {
        res.status(403).send("Error to retrieve tokens");
      }
    } catch (e) {
      res.status(403).send("Error to connect wallet");
    }
  });
}

function getHmac(payload) {
  const hmacMessage = payload.id;
  const hmac = createHmac("sha256", "amora-secret-key");
  hmac.update(hmacMessage);
  const hmacDigest = hmac.digest("hex");
  return {
    id: payload.id,
    hmac: hmacDigest,
  };
}

async function retrieveUnlockingTokens(address, contractAddresses) {
  // this could be some lookup against some node or a 3rd party service like Alchemy

  const client = new xrpl.Client("wss://xrplcluster.com/");

  try {
    await client.connect();
    const nfts = await client.request({
      method: "account_nfts",
      account: address,
    });

    const NFTArray = nfts.result.account_nfts;
    
    const filteredArray = NFTArray.filter(
      (x) => [...contractAddresses[0].split(',')].indexOf(x.NFTokenID) > -1
    );

    return filteredArray;
  } catch (e) {
    throw new Error(e);
  }
}
