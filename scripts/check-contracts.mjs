import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sdkSource = fs.readFileSync(path.join(repoRoot, "packages", "domain-sdk", "src", "index.ts"), "utf8");
const openapi = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs", "openapi.json"), "utf8"));

function extractInterfaceBlock(name) {
  const match = sdkSource.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match, `missing interface ${name} in SDK source`);
  return match[1];
}

function extractInterfaceProperties(name) {
  const block = extractInterfaceBlock(name);
  return [...block.matchAll(/^\s+([A-Za-z0-9_]+)\??:/gm)].map(([, property]) => property).sort();
}

function extractUnionValues(name, property) {
  const block = extractInterfaceBlock(name);
  const match = block.match(new RegExp(`\\n\\s+${property}: ([^;]+);`));
  assert.ok(match, `missing ${name}.${property} in SDK source`);
  return match[1]
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("\"") && part.endsWith("\""))
    .map((part) => part.slice(1, -1))
    .sort();
}

function schemaProperties(schemaName) {
  const schema = openapi.components.schemas[schemaName];
  assert.ok(schema, `missing schema ${schemaName} in OpenAPI spec`);
  return Object.keys(schema.properties ?? {}).sort();
}

function schemaEnum(schemaName, property) {
  const schema = openapi.components.schemas[schemaName];
  assert.ok(schema?.properties?.[property]?.enum, `missing enum ${schemaName}.${property} in OpenAPI spec`);
  return [...schema.properties[property].enum].sort();
}

const interfaceSchemaParity = [
  ["PairDeviceBridgeRequest", "PairDeviceBridgeRequest"],
  ["PairDeviceBridgeResponse", "PairDeviceBridgeResponse"],
  ["CreateSessionRequest", "CreateSessionRequest"],
  ["ArmSessionRequest", "ArmSessionRequest"],
  ["StopSessionRequest", "StopSessionRequest"],
  ["UpsertRuleSetRequest", "UpsertRuleSetRequest"],
  ["InboundEventRequest", "InboundEventRequest"],
  ["ControlCommand", "ControlCommand"],
  ["TelemetryEvent", "TelemetryEvent"],
  ["IngestTelemetryRequest", "IngestTelemetryRequest"],
  ["Session", "Session"],
  ["DeviceBridge", "DeviceBridge"],
  ["Device", "Device"],
  ["RuleSet", "RuleSet"],
  ["MetricsSnapshot", "MetricsSnapshot"],
  ["WorkspaceOverview", "WorkspaceOverview"]
];

for (const [interfaceName, schemaName] of interfaceSchemaParity) {
  assert.deepEqual(
    extractInterfaceProperties(interfaceName),
    schemaProperties(schemaName),
    `${interfaceName} properties drifted from ${schemaName}`
  );
}

assert.deepEqual(
  extractUnionValues("ControlCommand", "action"),
  schemaEnum("ControlCommand", "action"),
  "ControlCommand.action drifted from the OpenAPI enum"
);
assert.deepEqual(
  extractUnionValues("TelemetryEvent", "status"),
  schemaEnum("TelemetryEvent", "status"),
  "TelemetryEvent.status drifted from the OpenAPI enum"
);
assert.deepEqual(
  extractUnionValues("Session", "status"),
  schemaEnum("Session", "status"),
  "Session.status drifted from the OpenAPI enum"
);
assert.deepEqual(
  extractUnionValues("DeviceBridge", "transport"),
  schemaEnum("DeviceBridge", "transport"),
  "DeviceBridge.transport drifted from the OpenAPI enum"
);
assert.deepEqual(
  extractUnionValues("DeviceBridge", "status"),
  schemaEnum("DeviceBridge", "status"),
  "DeviceBridge.status drifted from the OpenAPI enum"
);

const expectedPaths = [
  ["/v1/device-bridges/pair", "post", "pairDeviceBridge"],
  ["/v1/sessions", "post", "createSession"],
  ["/v1/sessions/{sessionId}/arm", "post", "armSession"],
  ["/v1/sessions/{sessionId}/stop", "post", "stopSession"],
  ["/v1/sessions/{sessionId}/stream", "get", "streamSession"],
  ["/v1/sessions/{sessionId}/telemetry", "post", "publishSessionTelemetry"],
  ["/bridge/v1/sessions/{sessionId}/connect", "get", "buildBridgeSessionConnectUrl"],
  ["/bridge/v1/sessions/{sessionId}/telemetry", "post", "publishBridgeTelemetry"],
  ["/v1/rulesets", "post", "createRuleSet"],
  ["/v1/rulesets/{ruleSetId}", "put", "updateRuleSet"],
  ["/v1/inbound-events", "post", "submitInboundEvent"],
  ["/v1/workspaces/{workspaceId}/overview", "get", "getWorkspaceOverview"],
  ["/v1/workspaces/{workspaceId}/insights/hot-zones", "get", "getHotZones"]
];

for (const [pathName, method, sdkMethod] of expectedPaths) {
  assert.ok(openapi.paths[pathName]?.[method], `missing ${method.toUpperCase()} ${pathName} in OpenAPI spec`);
  assert.match(sdkSource, new RegExp(`\\b${sdkMethod}\\(`), `missing SDK method ${sdkMethod}`);
}

console.log("OpenAPI and SDK contracts are aligned.");
