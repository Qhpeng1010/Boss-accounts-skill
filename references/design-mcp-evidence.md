# Design MCP Evidence

Node scripts cannot invoke a Codex-hosted MCP tool directly. The generation agent therefore performs the MCP calls, records their raw responses, and passes the validated receipt to the local execution layer.

## Required Calls

1. Call `design_get_context_pack({ serviceId: "boss-ledger", family })` exactly once.
2. For every accepted package in that response, call `knowledge_check_verification({ ref: "package:<packageId>" })`.
3. Stop if the context call fails, any accepted package is missing, or any verification does not prove success.

The receipt must contain the original responses, not a prose assertion that the calls succeeded:

```json
{
  "schemaVersion": 1,
  "serviceId": "boss-ledger",
  "family": "list",
  "request": "<original request>",
  "createdAt": "<ISO timestamp>",
  "contextCall": {
    "tool": "design_get_context_pack",
    "arguments": { "serviceId": "boss-ledger", "family": "list" }
  },
  "contextResponse": "<raw tool response object>",
  "acceptedPackages": [
    {
      "packageId": "boss-ledger-context-list",
      "verificationCall": {
        "tool": "knowledge_check_verification",
        "arguments": { "ref": "package:boss-ledger-context-list" }
      },
      "verificationResponse": "<raw tool response object>",
      "verified": true
    }
  ]
}
```

Include every shared package required by the receipt validator and the selected family package. The validator rejects unsupported, duplicate, missing, stale, failed, or mismatched evidence.

## Record And Use

The unified entry returns `mcp.receiptPath`. Write the raw receipt to a temporary file, then normalize and validate it:

```text
node scripts/record-boss-ledger-mcp-receipt.mjs --input <raw-receipt.json> --output <mcp.receiptPath> --request "<original request>" --family <family>
```

Pass that path to local preflight with `--mcp-receipt`. Fast generation uses the returned `commands.fast`, whose `--mcp-verified` option takes the receipt path as its value. A bare flag is invalid.

`read-boss-ledger-rules.mjs` copies the normalized receipt into the Change as `mcp-context-receipt.json` and writes only an MCP evidence summary to `rules-read.md`. It never reads local `director-rules/` or `context-packs/` as design knowledge.
