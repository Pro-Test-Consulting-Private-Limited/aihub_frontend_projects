/**
 * Test-only timed SSE mock for POST /sit/generate-stream.
 * Not used in DEV deploys. Started by sit-r16-verify.mjs on an ephemeral port.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function row(id, ticket, scenario) {
  return {
    id,
    cells: {
      caseId: id,
      requirementId: ticket,
      issueKey: ticket,
      scenario,
      testType: "Positive",
      steps: "1. Open\n2. Click\n3. Type\n4. Verify",
      expected: "- Ok result here yes",
      preconditions: "- Ready",
      executionStatus: "Not run",
      origin: "ai",
      assessmentSource: "Model",
      deleted: "0",
      acIds: "AC1",
    },
  };
}

export function startSitR16MockStreamServer(opts = {}) {
  const delayMs = opts.delayMs ?? 80;
  const mode = opts.mode || "new";
  const parentRows = opts.parentRows || [];
  const genKeys = opts.genKeys || ["DW-6"];
  const caseCount = opts.caseCount ?? 2;
  const failAt = opts.failAt ?? null; // index to emit error, or 'after-1'

  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      });
      res.end();
      return;
    }
    if (req.method !== "POST" || !String(req.url || "").includes("generate-stream")) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed = {};
    try {
      parsed = JSON.parse(body || "{}");
    } catch {
      parsed = {};
    }
    const tickets = Array.isArray(parsed.tickets) ? parsed.tickets : genKeys.map((k) => ({ issueKey: k }));
    const keys = tickets.map((t) => t.issueKey);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const wbId = randomUUID().replace(/-/g, "").slice(0, 16);
    const allRows = [];
    if (mode === "append" || mode === "new") {
      for (const r of parentRows) {
        if (mode === "append") allRows.push(r);
        else if (r.cells?.origin === "human" || r.cells?.edited === "1") allRows.push(r);
      }
    }

    for (const key of keys) {
      send("ticket_started", { issueKey: key, mode });
      await sleep(delayMs);
      for (let i = 1; i <= caseCount; i++) {
        if (failAt === i) {
          send("error", { message: "mock stream error" });
          send("done", { ok: false });
          res.end();
          return;
        }
        const r = row(`${key}-stream-${i}`, key, `${key} streamed ${i}`);
        allRows.push(r);
        send("case", { issueKey: key, row: r, index: i });
        await sleep(delayMs);
      }
      send("ticket_done", { issueKey: key, caseCount });
    }

    const wb = {
      id: wbId,
      canvasId: parsed.canvasId || "sit-r16-ui-canvas",
      confirmedId: randomUUID(),
      sourceIssueKeys: keys,
      sourceSummaries: Object.fromEntries(keys.map((k) => [k, `${k} story`])),
      status: "ready",
      error: null,
      generator: "huggingface",
      sheets: [
        {
          id: "tc",
          name: "Test Cases",
          kind: "test-cases",
          columns: [],
          rows: allRows,
        },
      ],
      createdBy: { id: "proxy:local-bypass", name: "local-bypass" },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    send("workbook", wb);
    await sleep(delayMs);
    send("done", { ok: true, workbookId: wbId, ms: delayMs * 4 });
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const s = await startSitR16MockStreamServer();
  console.log(JSON.stringify({ mockPort: s.port }));
}
