import { useMemo, useState, useCallback } from "react";
import { getGateContextClient } from "@shopify/gate-context-client";

// Set this to the ngrok url that is generated when you run the server
export const host =
  "https://e62e-2804-548-c00d-ac00-4c03-9bcd-3d19-ffb0.sa.ngrok.io";
if (host == "YOUR_NGROK_URL") {
  console.error(`
    ************************************************************
    You must set the host to your ngrok url in useEvaluateGate.js.
    Run \`npm run dev\` and replace the YOUR_NGROK_URL with the url found in the terminal
    ************************************************************
  `);
}
const gateContextClient = getGateContextClient({
  backingStore: "ajaxApi",
  shopifyGateContextGenerator: async (data) => {
    try {
      const existing = await gateContextClient.read();
      return mergeGateContext(existing, data);
    } catch (e) {
      return data;
    }

    // merges existing gate context entries
    function mergeGateContext(existing, add) {
      const entriesById = existing.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});
      add.forEach((item) => (entriesById[item.id] = item));
      return Object.keys(entriesById).map((id) => entriesById[id]);
    }
  },
});

export const useEvaluateGate = () => {
  const gate = getGate();
  const [gateEvaluation, setGateEvaluation] = useState();
  const productId = getProductId();
  const evaluateGate = useCallback(
    async (address) => {
      if (address) {
        const response = await fetch(`${host}/public/gateEvaluation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            productId,
            productGid: `gid://shopify/Product/${productId}`,
            gateConfigurationGid: `gid://shopify/GateConfiguration/${gate.id}`,
            shopDomain: getShopDomain(),
            address,
          }),
        });
        const json = await response.json();
        setGateEvaluation(json);
        if (json.message == "No unlocking tokens") {
          gateContextClient
            .write({})
            .catch((_e) => console.error("failed to write to gate context"));
        } else {
          gateContextClient
            .write(json.gateContext)
            .catch((_e) => console.error("failed to write to gate context"));
        }
      } else {
        setGateEvaluation({});
        gateContextClient
          .write({})
          .catch((_e) => console.error("failed to write to gate context"));
      }
    },
    [setGateEvaluation, gate]
  );

  const { unlockingTokens, isLocked } = useMemo(() => {
    const { unlockingTokens } = gateEvaluation || {};
    const isLocked = !Boolean(unlockingTokens?.length);

    return {
      unlockingTokens,
      isLocked,
    };
  }, [gateEvaluation]);

  return {
    evaluateGate,
    gateEvaluation,
    unlockingTokens,
    isLocked,
  };
};

// This function also present in App.jsx
const getGate = () => window.myAppGates?.[0] || {};

function getShopDomain() {
  return window.Shopify.shop;
}

function getProductId() {
  return document.getElementById("amora").dataset.product_id;
}
