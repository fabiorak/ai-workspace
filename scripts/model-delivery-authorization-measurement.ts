import { measureModelDeliveryAuthorizationCorpus } from "../packages/privacy-gateway/test/model-delivery-authorization-evidence.ts";

const first = await measureModelDeliveryAuthorizationCorpus();
const second = await measureModelDeliveryAuthorizationCorpus();
if (JSON.stringify(first) !== JSON.stringify(second))
  throw new Error(
    "Model-delivery authorization measurement is not deterministic.",
  );
process.stdout.write(`${JSON.stringify(first, null, 2)}\n`);
