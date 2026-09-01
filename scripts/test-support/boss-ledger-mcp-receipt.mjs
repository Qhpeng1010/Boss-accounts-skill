import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SHARED_PACKAGES = [
  'boss-ledger-domain-overview',
  'boss-ledger-business-core',
  'boss-ledger-design-visual',
  'boss-ledger-design-page-selection',
  'boss-ledger-interaction-acceptance',
  'boss-ledger-context-core',
  'shared-requirement-product-core'
];

function familyPackage(family) {
  return family === 'empty-state' ? 'boss-ledger-context-empty-state' : `boss-ledger-context-${family}`;
}

export function createTestMcpReceipt(request, family) {
  const directory = mkdtempSync(join(tmpdir(), 'boss-ledger-mcp-receipt-'));
  const path = join(directory, 'receipt.json');
  const packageIds = [...SHARED_PACKAGES, familyPackage(family)];
  const receipt = {
    schemaVersion: 1,
    serviceId: 'boss-ledger',
    family,
    request,
    createdAt: new Date().toISOString(),
    contextCall: {
      tool: 'design_get_context_pack',
      arguments: { serviceId: 'boss-ledger', family }
    },
    contextResponse: {
      status: 'success',
      packageIds,
      testFixture: true
    },
    acceptedPackages: packageIds.map((packageId) => ({
      packageId,
      verificationCall: {
        tool: 'knowledge_check_verification',
        arguments: { ref: `package:${packageId}` }
      },
      verificationResponse: { status: 'verified', packageId, testFixture: true },
      verified: true
    }))
  };
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return { path, receipt, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

export function testMcpEnvironment(receipt, generationRequest = receipt.receipt.request) {
  return {
    ...process.env,
    BOSS_LEDGER_MCP_RECEIPT: receipt.path,
    BOSS_LEDGER_MCP_ORIGINAL_REQUEST: receipt.receipt.request,
    BOSS_LEDGER_MCP_GENERATION_REQUEST: generationRequest
  };
}
