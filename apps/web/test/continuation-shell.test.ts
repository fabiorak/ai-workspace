import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext, Script } from "node:vm";
import { APP_JS, shellHtml } from "../src/assets.ts";
import { CONTINUATION_BEHAVIOUR } from "../src/assets/continuation-client.ts";
import { CONTINUATION_TEXT } from "../src/text/continuation.ts";

class Element {
  hidden = false;
  value = "";
  textContent = "";
  checked = false;
  disabled = false;
  open = false;
  rows = 0;
  readOnly = false;
  type = "";
  selectionStart = 0;
  selectionEnd = 0;
  children: unknown[] = [];
  focused = false;
  listeners = new Map<string, () => unknown>();
  addEventListener(name: string, callback: () => unknown) {
    this.listeners.set(name, callback);
  }
  async fire(name: string) {
    await this.listeners.get(name)?.call(null, ...([] as []));
  }
  focus() {
    this.focused = true;
  }
  setAttribute() {}
  append(...values: unknown[]) {
    this.children.push(...values);
  }
  replaceChildren(...values: unknown[]) {
    this.children = values;
  }
}

test("continuation shell has labelled keyboard controls and complete IT/EN text", () => {
  const html = shellHtml("synthetic");
  new Script(APP_JS);
  assert.ok(
    html.indexOf('id="continuation-panel"') >
      html.indexOf('id="home-conversation"'),
  );
  assert.ok(
    html.indexOf('id="continuation-panel"') < html.indexOf('id="home-answer"'),
  );
  assert.match(html, /id="continuation-heading" tabindex="-1"/u);
  assert.match(
    html,
    /id="continuation-status" role="status" aria-live="polite"/u,
  );
  assert.doesNotMatch(
    CONTINUATION_BEHAVIOUR,
    /innerHTML|localStorage|sessionStorage/u,
  );
  for (const value of Object.values(CONTINUATION_TEXT)) {
    assert.ok(value.en.trim());
    assert.ok(value.it.trim());
  }
});

test("browser keeps questions by conversation, discards stale results and removes protected text after editing", async () => {
  const elements = new Map<string, Element>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id)!;
  };
  let response: unknown = {
    ready: true,
    label: "Synthetic",
    model: "model",
    keptAt: "2026-09-08",
  };
  let pending: ((value: unknown) => void) | null = null;
  let defer = false;
  const requests: { path: string; body: unknown }[] = [];
  const context = {
    document: {
      getElementById: element,
      createElement: () => new Element(),
      createTextNode: (text: string) => text,
    },
    api: async (path: string, options: { body?: string }) => {
      requests.push({
        path,
        body: options.body ? JSON.parse(options.body) : null,
      });
      if (defer)
        return new Promise((resolve) => {
          pending = resolve;
        });
      return response;
    },
    say: (item: Element, key: string) => {
      item.textContent = key;
    },
    text: (item: Element, value: string) => {
      item.textContent = value;
    },
    dateTime: (value: string) => value,
    message: (value: string) => value,
    setRow: (row: unknown) => {
      void row;
    },
  };
  runInNewContext(
    CONTINUATION_BEHAVIOUR +
      "\nglobalThis.setRow = setContinuationConversation;",
    context,
  );
  const row = { id: "conversation-one", projectId: "project-one" };
  context.setRow(row);
  element("continuation-question").value = "La città e 🛰️";
  await element("continuation-open").fire("click");
  assert.equal(element("continuation-heading").focused, true);
  await element("continuation-back").fire("click");
  assert.equal(element("continuation-question").value, "La città e 🛰️");
  context.setRow({ id: "conversation-two", projectId: "project-two" });
  assert.equal(element("continuation-question").value, "");
  context.setRow(row);
  assert.equal(element("continuation-question").value, "La città e 🛰️");
  defer = true;
  const opening = element("continuation-open").fire("click");
  context.setRow({ id: "conversation-two", projectId: "project-two" });
  (pending as unknown as (value: unknown) => void)({
    ready: true,
    label: "stale",
    model: "stale",
    keptAt: "stale",
  });
  await opening;
  assert.equal(element("continuation-panel").hidden, true);
  defer = false;
  context.setRow(row);
  response = {
    ready: true,
    proposal: "opaque",
    label: "Synthetic",
    model: "model",
    keptAt: "2026-09-08",
    items: [{ text: "Città 🛰️" }],
    suggestions: [],
  };
  const submit = element("continuation-propose").listeners.get(
    "submit",
  ) as unknown as (event: { preventDefault(): void }) => Promise<void>;
  await submit({ preventDefault() {} });
  assert.equal(element("continuation-review").hidden, false);
  response = {
    ready: true,
    text: "exact protected text",
    label: "Synthetic",
    model: "model",
    keptAt: "2026-09-08",
  };
  await element("continuation-protect").fire("click");
  assert.equal(element("continuation-text").value, "exact protected text");
  await element("continuation-question").fire("input");
  assert.equal(element("continuation-text").value, "");
  assert.equal(element("continuation-final").hidden, true);
  assert.ok(
    requests.every((request) => request.path.startsWith("/api/conversations/")),
  );
});
