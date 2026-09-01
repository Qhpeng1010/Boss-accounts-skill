import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const MCP_RECEIPT_ENV = 'BOSS_LEDGER_MCP_RECEIPT';
export const MCP_ORIGINAL_REQUEST_ENV = 'BOSS_LEDGER_MCP_ORIGINAL_REQUEST';
export const MCP_GENERATION_REQUEST_ENV = 'BOSS_LEDGER_MCP_GENERATION_REQUEST';
export const MCP_CONTEXT_TOOL = 'design_get_context_pack';
export const MCP_VERIFICATION_TOOL = 'knowledge_check_verification';

const ALLOWED_PACKAGES = new Set([
  'boss-ledger-domain-overview',
  'boss-ledger-business-core',
  'boss-ledger-design-visual',
  'boss-ledger-design-page-selection',
  'boss-ledger-interaction-acceptance',
  'boss-ledger-context-core',
  'boss-ledger-context-dashboard',
  'boss-ledger-context-detail',
  'boss-ledger-context-form',
  'boss-ledger-context-list',
  'boss-ledger-context-result',
  'boss-ledger-context-empty-state',
  'shared-requirement-product-core'
]);

const REQUIRED_SHARED_PACKAGES = ['boss-ledger-context-core'];

function familyPackage(family) {
  return family === 'empty-state' ? 'boss-ledger-context-empty-state' : `boss-ledger-context-${family}`;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function issue(condition, message) {
  if (!condition) throw new Error(message);
}

function responseIndicatesSuccess(response) {
  if (!isObject(response) || response.isError === true) return false;
  const queue = [response];
  while (queue.length) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (!isObject(current)) continue;
    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase();
      if (['verified', 'valid', 'success', 'ok'].includes(normalizedKey) && value === true) return true;
      if (['status', 'outcome', 'result'].includes(normalizedKey) && typeof value === 'string'
          && ['verified', 'valid', 'pass', 'passed', 'success', 'succeeded', 'ok'].includes(value.trim().toLowerCase())) return true;
      if (normalizedKey === 'text' && typeof value === 'string'
          && !/\b(?:not|unverified|invalid|failed|error)\b/i.test(value)
          && /\b(?:verified|valid|passed|success)\b/i.test(value)) return true;
      if (value && typeof value === 'object') queue.push(value);
    }
  }
  return false;
}

function packageAppearsInContext(response, packageId) {
  return JSON.stringify(response).includes(packageId);
}

function contextPackageIds(response) {
  const serialized = JSON.stringify(response);
  return [...ALLOWED_PACKAGES].filter((packageId) => serialized.includes(packageId));
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function receiptPathFor(root, request, family) {
  const key = sha256(JSON.stringify({ serviceId: 'boss-ledger', family, request })).slice(0, 20);
  return resolve(root, '.cache/yeepay-skill/mcp-receipts', `${key}.json`);
}

export function validateMcpReceipt(receipt, expected = {}) {
  issue(isObject(receipt), 'Design MCP receipt must be a JSON object.');
  issue(receipt.schemaVersion === 1, 'Design MCP receipt schemaVersion must equal 1.');
  issue(receipt.serviceId === 'boss-ledger', 'Design MCP receipt serviceId must equal boss-ledger.');
  issue(typeof receipt.family === 'string' && receipt.family.length > 0, 'Design MCP receipt family is required.');
  if (expected.serviceId) issue(receipt.serviceId === expected.serviceId, `Design MCP receipt serviceId must equal ${expected.serviceId}.`);
  if (expected.family) issue(receipt.family === expected.family, `Design MCP receipt family must equal ${expected.family}.`);
  if (expected.request !== undefined) issue(receipt.request === expected.request, 'Design MCP receipt request does not match the original request.');
  if (expected.generationRequest !== undefined) {
    issue((receipt.generationRequest || receipt.request) === expected.generationRequest, 'Design MCP receipt does not match the Page Spec generation request.');
  }

  const createdAt = Date.parse(receipt.createdAt);
  issue(Number.isFinite(createdAt), 'Design MCP receipt createdAt must be an ISO timestamp.');
  const ageMs = Date.now() - createdAt;
  issue(ageMs >= -300_000, 'Design MCP receipt createdAt is unexpectedly in the future.');
  if (!expected.allowStale) issue(ageMs <= 86_400_000, 'Design MCP receipt is older than 24 hours; call Design MCP again.');

  issue(receipt.contextCall?.tool === MCP_CONTEXT_TOOL, `Design MCP receipt contextCall.tool must equal ${MCP_CONTEXT_TOOL}.`);
  issue(receipt.contextCall?.arguments?.serviceId === 'boss-ledger', 'Design MCP context call must use serviceId boss-ledger.');
  issue(receipt.contextCall?.arguments?.family === receipt.family, 'Design MCP context call family does not match the receipt.');
  issue(isObject(receipt.contextResponse) && receipt.contextResponse.isError !== true, 'Design MCP context response is missing or reports an error.');

  issue(Array.isArray(receipt.acceptedPackages) && receipt.acceptedPackages.length > 0, 'Design MCP receipt acceptedPackages is required.');
  const packageIds = receipt.acceptedPackages.map((entry) => entry?.packageId);
  issue(new Set(packageIds).size === packageIds.length, 'Design MCP receipt package IDs must be unique.');
  const responsePackageIds = contextPackageIds(receipt.contextResponse);
  issue(responsePackageIds.length > 0, 'Design MCP context response does not expose any supported package IDs.');
  issue(responsePackageIds.length === packageIds.length && responsePackageIds.every((packageId) => packageIds.includes(packageId)),
    'Every supported package returned by Design MCP must have exactly one verification result.');
  const requiredPackages = [...REQUIRED_SHARED_PACKAGES, familyPackage(receipt.family)];
  for (const packageId of requiredPackages) {
    issue(packageIds.includes(packageId), `Design MCP receipt is missing required package ${packageId}.`);
  }

  for (const entry of receipt.acceptedPackages) {
    issue(isObject(entry) && ALLOWED_PACKAGES.has(entry.packageId), `Design MCP receipt contains unsupported package ${entry?.packageId || '<missing>'}.`);
    issue(packageAppearsInContext(receipt.contextResponse, entry.packageId), `Design MCP context response does not include ${entry.packageId}.`);
    const ref = `package:${entry.packageId}`;
    issue(entry.verificationCall?.tool === MCP_VERIFICATION_TOOL, `${entry.packageId} must be checked with ${MCP_VERIFICATION_TOOL}.`);
    issue(entry.verificationCall?.arguments?.ref === ref, `${entry.packageId} verification ref must equal ${ref}.`);
    issue(entry.verified === true, `${entry.packageId} is not marked verified.`);
    issue(responseIndicatesSuccess(entry.verificationResponse), `${entry.packageId} verification response does not prove success.`);
  }

  return receipt;
}

export function loadMcpReceipt(root, receiptArg, expected = {}) {
  const input = String(receiptArg || process.env[MCP_RECEIPT_ENV] || '').trim();
  issue(input, `Design MCP receipt is required. Call ${MCP_CONTEXT_TOOL}, verify every accepted package with ${MCP_VERIFICATION_TOOL}, then pass --mcp-receipt <file>.`);
  const receiptPath = resolve(root, input);
  issue(existsSync(receiptPath), `Design MCP receipt does not exist: ${receiptPath}`);
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  } catch (error) {
    throw new Error(`Design MCP receipt is not valid JSON: ${error.message}`);
  }
  validateMcpReceipt(receipt, expected);
  return { receipt, receiptPath, digest: sha256(`${JSON.stringify(receipt, null, 2)}\n`) };
}

export function mcpReceiptSummary(receipt) {
  return {
    schemaVersion: receipt.schemaVersion,
    serviceId: receipt.serviceId,
    family: receipt.family,
    request: receipt.request,
    ...(receipt.generationRequest ? { generationRequest: receipt.generationRequest } : {}),
    createdAt: receipt.createdAt,
    contextCall: receipt.contextCall,
    contextResponse: receipt.contextResponse,
    acceptedPackages: receipt.acceptedPackages
  };
}
