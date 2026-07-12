import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";
import {
  GuiApplication,
  startGuiServer,
  type GuiServer,
} from "../src/index.ts";

const execFileAsync = promisify(execFile);
const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);

describe("GUI server project onboarding", () => {
  let root: string,
    repository: string,
    server: GuiServer,
    cookie: string,
    csrf: string;
  before(async () => {
    root = await mkdtemp(join(tmpdir(), "ai-workspace-gui-server-"));
    repository = join(root, "repository");
    await mkdir(repository);
    await execFileAsync("git", [
      "-C",
      repository,
      "init",
      "--initial-branch=main",
    ]);
    await writeFile(join(repository, "README.md"), "# Synthetic GUI server\n");
    await execFileAsync("git", ["-C", repository, "add", "README.md"]);
    await execFileAsync("git", [
      "-C",
      repository,
      "-c",
      "user.name=Synthetic GUI",
      "-c",
      "user.email=gui@example.invalid",
      "commit",
      "-m",
      "initial",
    ]);
    server = await startGuiServer(
      new GuiApplication({
        workspaceHome: join(root, "home"),
        sampleSessionPath,
      }),
      {
        bootstrapToken: "b".repeat(64),
        sessionToken: "s".repeat(64),
        csrfToken: "c".repeat(64),
      },
    );
    const bootstrap = await fetch(server.bootstrapUrl, { redirect: "manual" });
    assert.equal(bootstrap.status, 303);
    cookie = bootstrap.headers.get("set-cookie")!.split(";", 1)[0]!;
    const page = await fetch(`${server.origin}/`, {
      headers: { Cookie: cookie },
    });
    const html = await page.text();
    csrf = /name="aiw-csrf" content="([a-f0-9]+)"/u.exec(html)?.[1] ?? "";
  });
  after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  it("serves a semantic self-guiding local-only shell", async () => {
    const response = await fetch(`${server.origin}/`, {
      headers: { Cookie: cookie },
    });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-security-policy") ?? "",
      /default-src 'none'/u,
    );
    assert.match(html, /Skip to the guided workflow/u);
    assert.match(html, /aria-live="polite"/u);
    assert.match(html, /Register this project/u);
    assert.match(html, /GUI parity next/u);
    assert.match(html, /label for="search-query"/u);
    assert.match(html, /Create source-linked memory/u);
    assert.match(html, /USER_CURATED does not mean trusted/u);
    assert.match(html, /role="alert"/u);
    assert.equal(/https?:\/\/(?!127\.0\.0\.1)/u.test(html), false);
    const script = await (
      await fetch(`${server.origin}/app.js`, { headers: { Cookie: cookie } })
    ).text();
    const style = await (
      await fetch(`${server.origin}/app.css`, { headers: { Cookie: cookie } })
    ).text();
    assert.match(script, /\.textContent = value/u);
    assert.equal(script.includes("innerHTML"), false);
    assert.match(style, /max-width: 38rem/u);
    assert.match(style, /prefers-reduced-motion/u);
    const secondBootstrap = await fetch(server.bootstrapUrl, {
      redirect: "manual",
    });
    assert.equal(secondBootstrap.status, 410);
  });

  it("requires authentication, same origin, and CSRF for mutation", async () => {
    assert.equal((await fetch(`${server.origin}/api/projects`)).status, 401);
    const noCsrf = await fetch(`${server.origin}/api/projects`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: server.origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: repository }),
    });
    assert.equal(noCsrf.status, 403);
    const wrongOrigin = await fetch(`${server.origin}/api/projects`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "http://example.invalid",
        "Content-Type": "application/json",
        "X-AI-Workspace-CSRF": csrf,
      },
      body: JSON.stringify({ path: repository }),
    });
    assert.equal(wrongOrigin.status, 403);
  });

  it("registers, lists, and refreshes a project without exposing its path", async () => {
    const registered = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ path: repository }),
    });
    assert.equal(registered.status, 201);
    const project = (await registered.json()) as { id: string; name: string };
    const listed = await api("/api/projects");
    const body = await listed.text();
    assert.match(body, new RegExp(project.name, "u"));
    assert.equal(body.includes(repository), false);
    assert.equal(
      (
        await api(`/api/projects/${encodeURIComponent(project.id)}/inspect`, {
          method: "POST",
          body: "{}",
        })
      ).status,
      200,
    );
  });

  it("imports the documented synthetic sample idempotently", async () => {
    const projects = (await (await api("/api/projects")).json()) as {
      id: string;
    }[];
    const projectId = projects[0]!.id;
    const first = (await (
      await api(
        `/api/projects/${encodeURIComponent(projectId)}/import-sample`,
        {
          method: "POST",
          body: "{}",
        },
      )
    ).json()) as { addedEvents: number; trust: string; sourceName: string };
    const second = (await (
      await api(
        `/api/projects/${encodeURIComponent(projectId)}/import-sample`,
        {
          method: "POST",
          body: "{}",
        },
      )
    ).json()) as { addedEvents: number; existingEvents: number };
    assert.ok(first.addedEvents > 0);
    assert.equal(first.trust, "UNTRUSTED");
    assert.match(first.sourceName, /session\.jsonl/u);
    assert.equal(second.addedEvents, 0);
    assert.ok(second.existingEvents > 0);
  });

  it("completes import, search, event, and integrity-verified source inspection", async () => {
    const projects = (await (await api("/api/projects")).json()) as {
      id: string;
    }[];
    const projectId = projects[0]!.id;
    const search = await api(
      `/api/projects/${encodeURIComponent(projectId)}/search?q=${encodeURIComponent("expectation failed")}&type=COMMAND_RESULT&limit=20`,
    );
    assert.equal(search.status, 200);
    const report = (await search.json()) as {
      text: string;
      results: { eventId: string; trust: string; snippet: string }[];
    };
    assert.equal(report.text, "expectation failed");
    assert.equal(report.results.length, 1);
    assert.equal(report.results[0]!.trust, "UNTRUSTED");

    const event = await api(
      `/api/projects/${encodeURIComponent(projectId)}/events/${encodeURIComponent(report.results[0]!.eventId)}`,
    );
    const eventBody = (await event.json()) as {
      eventId: string;
      trust: string;
      injectionWarning: string;
    };
    assert.equal(eventBody.eventId, report.results[0]!.eventId);
    assert.equal(eventBody.trust, "UNTRUSTED");
    assert.match(eventBody.injectionWarning, /inert data/u);

    const source = await api(
      `/api/projects/${encodeURIComponent(projectId)}/events/${encodeURIComponent(eventBody.eventId)}/source`,
    );
    const sourceBody = (await source.json()) as {
      content: string;
      byteLength: number;
      trust: string;
    };
    assert.equal(source.status, 200);
    assert.equal(sourceBody.trust, "UNTRUSTED");
    assert.equal(Buffer.byteLength(sourceBody.content), sourceBody.byteLength);
    assert.match(sourceBody.content, /synthetic expectation failed/u);
  });

  it("preserves bounded empty, filter, and project-scope behavior", async () => {
    const projects = (await (await api("/api/projects")).json()) as {
      id: string;
    }[];
    const projectId = projects[0]!.id;
    const empty = (await (
      await api(
        `/api/projects/${encodeURIComponent(projectId)}/search?q=no-such-synthetic-evidence&limit=1`,
      )
    ).json()) as { results: unknown[]; emptyGuidance: string };
    assert.deepEqual(empty.results, []);
    assert.match(empty.emptyGuidance, /remove filters/u);
    assert.equal(
      (
        await api(
          `/api/projects/${encodeURIComponent(projectId)}/search?q=test&type=NOT_A_TYPE`,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await api(
          `/api/projects/00000000-0000-4000-8000-000000000000/search?q=test`,
        )
      ).status,
      400,
    );
  });

  it("curates and persists complete source-linked memory lifecycle over HTTP", async () => {
    const projects = (await (await api("/api/projects")).json()) as {
      id: string;
    }[];
    const projectId = projects[0]!.id;
    const search = (await (
      await api(
        `/api/projects/${encodeURIComponent(projectId)}/search?q=test&limit=1`,
      )
    ).json()) as { results: { eventId: string }[] };
    const sourceEventIds = [search.results[0]!.eventId];
    const createdResponse = await api(
      `/api/projects/${encodeURIComponent(projectId)}/memory`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "CONSTRAINT",
          content: "Keep the fictional greeting covered by a test.",
          sourceEventIds,
        }),
      },
    );
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as {
      id: string;
      validity: string;
      verification: string;
      confidence: string;
      curation: string;
      sources: { trust: string }[];
    };
    assert.deepEqual(
      [
        created.validity,
        created.verification,
        created.confidence,
        created.curation,
      ],
      ["ACTIVE", "UNVERIFIED", "UNASSESSED", "USER_CURATED"],
    );
    assert.equal(created.sources[0]!.trust, "UNTRUSTED");
    const listed = (await (
      await api(
        `/api/projects/${encodeURIComponent(projectId)}/memory?limit=20`,
      )
    ).json()) as { items: { id: string }[] };
    assert.equal(
      listed.items.some((item) => item.id === created.id),
      true,
    );
    const verified = await api(
      `/api/projects/${encodeURIComponent(projectId)}/memory/${created.id}/verify`,
      {
        method: "POST",
        body: JSON.stringify({
          note: "Reviewed against synthetic evidence.",
          sourceEventIds,
        }),
      },
    );
    assert.equal(
      ((await verified.json()) as { verification: string }).verification,
      "VERIFIED",
    );
    const superseded = (await (
      await api(
        `/api/projects/${encodeURIComponent(projectId)}/memory/${created.id}/supersede`,
        {
          method: "POST",
          body: JSON.stringify({
            content: "Keep the revised fictional greeting covered by a test.",
            sourceEventIds,
          }),
        },
      )
    ).json()) as {
      previous: { validity: string };
      replacement: { id: string; verification: string };
    };
    assert.equal(superseded.previous.validity, "SUPERSEDED");
    assert.equal(superseded.replacement.verification, "UNVERIFIED");
    const invalidated = await api(
      `/api/projects/${encodeURIComponent(projectId)}/memory/${superseded.replacement.id}/invalidate`,
      {
        method: "POST",
        body: JSON.stringify({
          reason: "Synthetic requirement removed.",
          sourceEventIds,
        }),
      },
    );
    assert.equal(
      ((await invalidated.json()) as { validity: string }).validity,
      "INVALIDATED",
    );
    const terminal = await api(
      `/api/projects/${encodeURIComponent(projectId)}/memory?validity=INVALIDATED`,
    );
    assert.match(await terminal.text(), /Synthetic requirement removed/u);
  });

  it("rejects invalid memory filters, missing sources, and terminal transitions", async () => {
    const projectId = (
      (await (await api("/api/projects")).json()) as { id: string }[]
    )[0]!.id;
    assert.equal(
      (await api(`/api/projects/${projectId}/memory?validity=UNKNOWN`)).status,
      400,
    );
    assert.equal(
      (
        await api(`/api/projects/${projectId}/memory`, {
          method: "POST",
          body: JSON.stringify({
            type: "DECISION",
            content: "No source",
            sourceEventIds: [],
          }),
        })
      ).status,
      400,
    );
    const invalidated = (await (
      await api(`/api/projects/${projectId}/memory?validity=INVALIDATED`)
    ).json()) as { items: { id: string }[] };
    const response = await api(
      `/api/projects/${projectId}/memory/${invalidated.items[0]!.id}/verify`,
      {
        method: "POST",
        body: JSON.stringify({
          note: "Must fail",
          sourceEventIds: ["missing-event"],
        }),
      },
    );
    assert.equal(response.status, 400);
    assert.equal((await response.text()).includes("Must fail"), false);
  });

  it("rejects oversized bodies and undeclared methods without leaking input", async () => {
    const canary = "PRIVATE-CANARY-SHOULD-NOT-ECHO";
    const oversized = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ path: canary + "x".repeat(33 * 1024) }),
    });
    assert.equal(oversized.status, 400);
    assert.equal((await oversized.text()).includes(canary), false);
    assert.equal(
      (await api("/api/projects", { method: "DELETE" })).status,
      404,
    );
  });

  it("fails closed when active-memory storage is corrupt", async () => {
    const projectId = (
      (await (await api("/api/projects")).json()) as { id: string }[]
    )[0]!.id;
    const digest = createHash("sha256").update(projectId).digest("hex");
    await writeFile(
      join(root, "home", "memory", `project_${digest}.json`),
      "corrupt-memory-canary",
    );
    const response = await api(`/api/projects/${projectId}/memory`);
    assert.equal(response.status, 400);
    const body = await response.text();
    assert.match(body, /valid JSON/u);
    assert.equal(body.includes("corrupt-memory-canary"), false);
  });

  it("fails closed when source artifact integrity is lost", async () => {
    const projects = (await (await api("/api/projects")).json()) as {
      id: string;
    }[];
    const projectId = projects[0]!.id;
    const report = (await (
      await api(
        `/api/projects/${encodeURIComponent(projectId)}/search?q=${encodeURIComponent("expectation failed")}&limit=1`,
      )
    ).json()) as { results: { eventId: string }[] };
    const event = (await (
      await api(
        `/api/projects/${encodeURIComponent(projectId)}/events/${encodeURIComponent(report.results[0]!.eventId)}`,
      )
    ).json()) as { eventId: string; sourceArtifactId: string };
    const digest = event.sourceArtifactId.slice("artifact://sha256/".length);
    await writeFile(
      join(root, "home", "artifacts", "sha256", digest.slice(0, 2), digest),
      "corrupt",
    );
    const source = await api(
      `/api/projects/${encodeURIComponent(projectId)}/events/${encodeURIComponent(event.eventId)}/source`,
    );
    assert.equal(source.status, 400);
    const body = await source.text();
    assert.match(body, /integrity check/u);
    assert.match(body, /Reimport the reviewed sample/u);
    assert.equal(body.includes("corrupt"), false);
  });

  function api(path: string, options: RequestInit = {}) {
    return fetch(`${server.origin}${path}`, {
      ...options,
      headers: {
        Cookie: cookie,
        Origin: server.origin,
        "Content-Type": "application/json",
        "X-AI-Workspace-CSRF": csrf,
        ...(options.headers ?? {}),
      },
    });
  }
});
