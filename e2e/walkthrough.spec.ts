import { expect, test, type Page } from "@playwright/test";

/**
 * The demo walkthrough (docs/DEMO_SCRIPT.md), end to end, on synthetic data only.
 * Steps share one server-side seed store, so they run in order and start from a reset.
 */
test.describe.configure({ mode: "serial" });

const REPORT = "samples/synthetic-blood-report.pdf";
const WEARABLE = "samples/synthetic-apple-health-export.xml";

async function resetDemo(page: Page) {
  const r = await page.request.post("/api/demo/reset", { data: { confirm: "RESET" } });
  expect(r.ok()).toBeTruthy();
}

async function ask(page: Page, question: string) {
  await page.getByLabel("Ask Clarity").fill(question);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await resetDemo(page);
  await page.close();
});

test("1. landing introduces Clarity and leads into the app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /try clarity now/i }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening), Alex\.$/ })).toBeVisible();
});

test("2–5. home: upload report and wearable export, get one next move, ask a follow-up", async ({ page }) => {
  await page.goto("/app");
  await page.getByLabel("Add blood report").setInputFiles(REPORT);
  await expect(page.getByText("Read synthetic-blood-report.pdf")).toBeVisible();
  await expect(page.getByText("1 result had no usable range, so it wasn't compared.")).toBeVisible();

  const answer = page.getByText("Your next move").last();
  await expect(answer).toBeVisible();
  await expect(page.getByText("Book a GP appointment to go through your flagged results").last()).toBeVisible();
  await expect(page.getByText(/not medical advice/).last()).toBeVisible();

  await page.getByLabel("Add Apple Health export").setInputFiles(WEARABLE);
  await expect(page.getByText(/Imported \d+ daily wearable values/)).toBeVisible();

  await ask(page, "Why am I tired in the afternoons?");
  await expect(page.getByText(/You asked: "Why am I tired in the afternoons\?"/)).toBeVisible();

  // Uploading the same report again is blocked, not duplicated.
  await page.getByLabel("Add blood report").setInputFiles(REPORT);
  await expect(page.getByText(/already uploaded/i)).toBeVisible();
});

test("bad files get a specific message", async ({ page }) => {
  await page.goto("/app");
  await page.getByLabel("Add blood report").setInputFiles("samples/invalid/not-a-pdf.pdf");
  await expect(page.getByText("This file doesn't look like a valid PDF.")).toBeVisible();
  await page.getByLabel("Add blood report").setInputFiles("samples/invalid/scanned-no-text.pdf");
  await expect(page.getByText(/looks like a scan or photo/)).toBeVisible();
  await page.getByLabel("Add Apple Health export").setInputFiles("samples/invalid/wrong-root.xml");
  await expect(page.getByText(/isn't an Apple Health export/)).toBeVisible();
});

test("6. insights: lab ranges, evidence, and a user correction", async ({ page }) => {
  await page.goto("/app/insights");
  await expect(page.getByText(/21 results, most recently from .* 5 sit outside your lab's range\./)).toBeVisible();

  const first = page.getByRole("button", { name: "What this measures" }).first();
  await first.click();
  await expect(page.getByRole("link", { name: "Ferritin Blood Test" })).toHaveCount(1); // one entry per source page

  await page.getByRole("button", { name: /Correct it/ }).click();
  await page.getByLabel("Value").fill("16");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText(/4 sit outside your lab's range\./)).toBeVisible();
  // The printed "low" flag described the value as first read, so no contradiction is reported.
  await expect(page.getByText(/flagged low on the report/)).toHaveCount(0);
});

test("ask-about link asks once and clears the question from the address bar", async ({ page }) => {
  await page.goto("/app?q=What%20does%20my%20Ferritin%20result%20mean%3F");
  await expect(page.getByText(/You asked: "What does my Ferritin result mean\?"/)).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
});

test("7. body: system by system, and missing is never shown as normal", async ({ page }) => {
  await page.goto("/app/body");
  await page.getByRole("button", { name: /^Kidneys/ }).click();
  await expect(page.getByRole("heading", { name: "Not measured" })).toBeVisible();
  await expect(page.getByText(/Urine albumin:creatinine ratio/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask Clarity about these results" })).toBeVisible();
});

test("8. plan: done, skip, refresh adapts", async ({ page }) => {
  await page.goto("/app/plan");
  const create = page.getByRole("button", { name: "Create my plan" });
  if (await create.isVisible()) await create.click();
  await expect(page.getByText("Your next move")).toBeVisible();

  const step = (title: RegExp) => page.locator("article, li, section").filter({ hasText: title }).filter({ has: page.getByRole("button", { name: "Skip" }) }).last();
  await step(/fibre-rich option/).getByRole("button", { name: "Mark done" }).click();
  await expect(page.getByText(/Done on \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await step(/20-minute brisk walk/).getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText(/Skipped on \d{4}-\d{2}-\d{2}/)).toBeVisible();

  await page.getByRole("button", { name: "Refresh plan" }).click();
  await expect(page.getByText(/lowered a little because you skipped it last time/)).toBeVisible();
});

test("9. discover: mock booking and supplement categories awaiting review", async ({ page }) => {
  await page.goto("/app/discover");
  await page.getByRole("button", { name: "Request to book" }).first().click();
  await expect(page.getByText(/Requested \(mock/)).toBeVisible();

  await page.getByRole("button", { name: "Check what may be relevant" }).click();
  await expect(page.getByText("Awaiting review")).toHaveCount(2); // vitamin D + soluble fibre; no iron after the correction
  await page.getByRole("button", { name: "Check what may be relevant" }).click();
  await expect(page.getByText("Awaiting review")).toHaveCount(2); // no duplicates
});

test("10–11. doctor: restricted, dose only by a reviewer, outcome visible to the member", async ({ page }) => {
  // Members can't open the workspace or review.
  const denied = await page.request.post("/api/doctor/suggestions/00000000-0000-4000-8000-000000000000", { data: { status: "rejected", reviewerNote: "no" } });
  expect(denied.status()).toBe(401);

  await page.goto("/doctor");
  await expect(page).toHaveURL(/\/doctor\/sign-in/);
  await page.getByLabel("Access code").fill("not-the-code");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That access code isn't right.")).toBeVisible();

  await page.getByLabel("Access code").fill("e2e-reviewer-code");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Reviewer workspace" })).toBeVisible();
  await expect(page.getByText(/SIMULATED/).first()).toBeVisible();

  const vitD = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Vitamin D/ }) });
  await vitD.getByRole("button", { name: "Save simulated review" }).click();
  await expect(vitD.getByText(/needs a dose/i)).toBeVisible(); // approve without a dose is refused
  await vitD.getByLabel("Dose", { exact: true }).fill("1000 IU daily (SAMPLE)");
  await vitD.getByRole("button", { name: "Save simulated review" }).click();

  await page.goto("/app/discover");
  await expect(page.getByText("Approved (simulated)")).toBeVisible();
  await expect(page.getByText(/Reviewer dose \(simulated\): 1000 IU daily \(SAMPLE\)/)).toBeVisible();

  await page.goto("/app/timeline");
  await expect(page.getByText("Supplement suggestion approved")).toBeVisible();
});

test("12. profile: reset demo restores the starting synthetic state", async ({ page }) => {
  await page.goto("/app/profile");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("button", { name: "Yes, reset demo" }).click();
  await expect(page.getByText("Demo reset to its starting synthetic state.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("synthetic-history-2026-04.pdf")).toBeVisible();
  await expect(page.getByText("synthetic-blood-report.pdf")).toHaveCount(0);
});
