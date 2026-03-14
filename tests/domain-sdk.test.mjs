import test from "node:test";
import assert from "node:assert/strict";

import {
  DEV_ENDPOINT_PUBLIC_KEY_DER_BASE64,
  buildHostedControlEvent,
  canonicalizeInboundEvent,
  signInboundEvent,
  verifyDetachedSignature
} from "../packages/domain-sdk/dist/index.js";

test("signInboundEvent signs the canonical payload", async () => {
  const signed = await signInboundEvent(buildHostedControlEvent("session_demo", 4.99));
  const valid = await verifyDetachedSignature(
    canonicalizeInboundEvent(signed),
    signed.signature,
    DEV_ENDPOINT_PUBLIC_KEY_DER_BASE64
  );
  assert.equal(valid, true);
});

