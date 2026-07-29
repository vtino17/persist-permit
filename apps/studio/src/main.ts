import {
  adversarialBatch,
  compileRetention,
  safeBatch,
  samplePolicy,
  sampleStore,
} from "@persistpermit/core";
import type {
  MemoryDecision,
  RetentionCompilation,
} from "@persistpermit/core";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing application root.");

let scenario: "safe" | "adversarial" = "adversarial";
let selected: string | undefined;

const escapeHtml = (value: unknown): string =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const card = (decision: MemoryDecision, compilation: RetentionCompilation): string => {
  const record = compilation.records.find((item) => item.id === decision.proposalId);
  const proposal = (scenario === "safe" ? safeBatch : adversarialBatch).proposals.find((item) => item.id === decision.proposalId);
  return `
    <button class="memory memory--${decision.action} ${selected === decision.proposalId ? "active" : ""}" data-memory="${decision.proposalId}">
      <div class="memory__top"><span>${decision.action}</span><code>#${decision.contentHash.slice(0, 8)}</code></div>
      <h3>${escapeHtml(decision.proposalId)}</h3>
      <p>${escapeHtml(proposal?.content ?? "")}</p>
      <div class="memory__foot">
        <span>${escapeHtml(proposal?.purposeId ?? "")}</span>
        <span>${escapeHtml(record?.sensitivity ?? proposal?.sensitivity ?? "")}</span>
      </div>
    </button>
  `;
};

const detail = (decision: MemoryDecision | undefined): string => {
  if (!decision) return `<div class="detail__empty">Select a proposed memory to inspect its permit.</div>`;
  return `
    <div class="detail__head"><span>DECISION</span><strong>${decision.action}</strong></div>
    <dl>
      <div><dt>Proposal</dt><dd>${escapeHtml(decision.proposalId)}</dd></div>
      <div><dt>Content hash</dt><dd>${decision.contentHash.slice(0, 20)}</dd></div>
      <div><dt>Delete at</dt><dd>${decision.assignedExpiresAt ?? "not scheduled"}</dd></div>
    </dl>
    <h3>Compiler findings</h3>
    <div class="detail__findings">
      ${decision.findings.length > 0 ? decision.findings.map((item) => `
        <article class="mini mini--${item.severity}">
          <span>${item.severity}</span>
          <code>${escapeHtml(item.code)}</code>
          <p>${escapeHtml(item.message)}</p>
        </article>
      `).join("") : `<p class="all-clear">✓ All retention controls passed.</p>`}
    </div>
  `;
};

const download = (compilation: RetentionCompilation): void => {
  const blob = new Blob([`${JSON.stringify(compilation, null, 2)}\n`], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `persist-permit-${scenario}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};

const render = async (): Promise<void> => {
  const batch = scenario === "safe" ? safeBatch : adversarialBatch;
  const compilation = await compileRetention({
    batch,
    store: sampleStore,
    policy: samplePolicy,
    compiledAt: new Date("2026-07-29T09:00:00.000Z"),
  });
  selected ??= compilation.decisions[0]?.proposalId;
  const chosen = compilation.decisions.find((item) => item.proposalId === selected);
  root.innerHTML = `
    <header>
      <a class="brand" href="#"><span>PP</span>PersistPermit</a>
      <p>AI MEMORY / RETENTION COMPILER</p>
      <a href="https://github.com/vtino17/persist-permit">Source ↗</a>
    </header>
    <main>
      <section class="hero">
        <div class="eyebrow">MEMORY IS A PRIVILEGE, NOT A DEFAULT</div>
        <h1>Before an agent<br><em>remembers forever.</em></h1>
        <div class="hero__bottom">
          <p>Compile purpose, consent, sensitivity, source trust, contradictions, and deletion deadlines before a write reaches persistent memory.</p>
          <div class="switch">
            <button data-scenario="safe" class="${scenario === "safe" ? "active" : ""}">Compliant batch</button>
            <button data-scenario="adversarial" class="${scenario === "adversarial" ? "active" : ""}">Poisoned batch</button>
          </div>
        </div>
      </section>
      <section class="verdict verdict--${compilation.status}">
        <div><small>COMPILER STATUS</small><strong>${compilation.status}</strong></div>
        <div><small>PRIVACY SCORE</small><strong>${compilation.score}<i>/100</i></strong></div>
        <div><small>PERSIST</small><strong>${compilation.summary.persisted}</strong></div>
        <div><small>SKIP</small><strong>${compilation.summary.skipped}</strong></div>
        <div><small>REJECT</small><strong>${compilation.summary.rejected}</strong></div>
        <button id="download">Report ↓</button>
      </section>
      <section class="workspace">
        <div class="inbox">
          <div class="section-title"><span>01</span><div><h2>Memory inbox</h2><p>Every proposed long-term write receives an explicit disposition.</p></div></div>
          <div class="memory-grid">${compilation.decisions.map((item) => card(item, compilation)).join("")}</div>
        </div>
        <aside class="detail">
          <div class="section-title"><span>02</span><div><h2>Permit detail</h2><p>Content-addressed evidence and retention deadline.</p></div></div>
          ${detail(chosen)}
        </aside>
      </section>
      <section class="rules">
        <div><span>03</span><h2>Retention controls</h2></div>
        <ul>
          <li><b>01</b>Purpose limitation</li><li><b>02</b>Consent coverage</li>
          <li><b>03</b>Secret and PII detection</li><li><b>04</b>Untrusted instruction residue</li>
          <li><b>05</b>Fact contradiction</li><li><b>06</b>Deletion scheduling</li>
        </ul>
      </section>
    </main>
    <footer><span>PersistPermit / 0.1.0</span><span>Deterministic · offline · memory-store agnostic</span></footer>
  `;
  root.querySelectorAll<HTMLButtonElement>("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => {
      scenario = button.dataset.scenario as "safe" | "adversarial";
      selected = undefined;
      void render();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-memory]").forEach((button) => {
    button.addEventListener("click", () => {
      selected = button.dataset.memory;
      void render();
    });
  });
  root.querySelector<HTMLButtonElement>("#download")?.addEventListener("click", () => download(compilation));
};

await render();
