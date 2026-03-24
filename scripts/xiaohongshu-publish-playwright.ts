import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import {
  chromium,
  type BrowserContext,
  type Frame,
  type Locator,
  type Page,
} from "playwright";
import { Client } from "pg";

const PUBLISH_URL =
  "https://creator.xiaohongshu.com/publish/publish?source=official&from=menu&target=video";
const DEFAULT_USER_DATA_DIR = path.join(
  process.cwd(),
  ".playwright",
  "xiaohongshu-user-data",
);
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const TITLE_LIMIT = 20;
const FIXED_HASHTAGS = ["#科技新闻", "#前沿科技", "#献哥AI报道"];

type CliOptions = {
  video: string;
  title?: string;
  caption?: string;
  publish: boolean;
  keepOpen: boolean;
  headless: boolean;
  channel?: "chrome" | "chromium";
  timeoutMs: number;
  userDataDir: string;
  profileDirectory?: string;
};

type LatestDigestCopy = {
  title: string;
  caption: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: Partial<CliOptions> = {
    publish: false,
    keepOpen: false,
    headless: false,
    channel: "chrome",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    userDataDir: DEFAULT_USER_DATA_DIR,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--video":
        options.video = next;
        i += 1;
        break;
      case "--title":
        options.title = next;
        i += 1;
        break;
      case "--caption":
        options.caption = next;
        i += 1;
        break;
      case "--user-data-dir":
        options.userDataDir = next;
        i += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = Number(next);
        i += 1;
        break;
      case "--profile-directory":
        options.profileDirectory = next;
        i += 1;
        break;
      case "--channel":
        if (next === "chrome" || next === "chromium") {
          options.channel = next;
        } else {
          throw new Error(`Unsupported --channel value: ${next}`);
        }
        i += 1;
        break;
      case "--publish":
        options.publish = true;
        break;
      case "--keep-open":
        options.keepOpen = true;
        break;
      case "--headless":
        options.headless = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown argument: ${arg}`);
        }
    }
  }

  if (!options.video) {
    throw new Error("Missing required argument: --video /absolute/path/to/video.mov");
  }

  return options as CliOptions;
}

function ensureFileExists(filePath: string) {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`Video path must be absolute: ${filePath}`);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Video file not found: ${filePath}`);
  }
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function truncateGraphemes(text: string, limit: number) {
  const chars = Array.from(text.trim());
  return chars.length <= limit ? text.trim() : chars.slice(0, limit).join("");
}

function compressTitle(fullTitle: string, limit = TITLE_LIMIT) {
  const normalized = normalizeWhitespace(fullTitle);
  if (Array.from(normalized).length <= limit) {
    return normalized;
  }

  const parts = normalized
    .split(/[，,、]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chosen: string[] = [];
  for (const part of parts) {
    const candidate = [...chosen, part].join("、");
    if (Array.from(candidate).length > limit) {
      break;
    }
    chosen.push(part);
  }

  if (chosen.length > 0) {
    return chosen.join("、");
  }

  return truncateGraphemes(normalized, limit);
}

function buildCaptionFromScript(script: string, hashtags: string[]) {
  const paragraphs = script
    .split(/\n+/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean)
    .filter((paragraph) => !paragraph.startsWith("大家好，这里是"));

  const body = normalizeWhitespace(paragraphs.slice(0, 3).join(" "));
  const snippet = truncateGraphemes(body, 180);
  const tags = hashtags.join(" ");
  return `${snippet}\n\n${tags}`.trim();
}

async function getLatestDigestCopy(): Promise<LatestDigestCopy> {
  const connectionString =
    process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DIRECT_DATABASE_URL or DATABASE_URL");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query<{
      title: string | null;
      hashtags: string[] | null;
      script: string;
    }>(`
      select title, hashtags, script
      from "NewsDigest"
      order by date desc
      limit 1
    `);

    const row = result.rows[0];
    if (!row) {
      throw new Error("No NewsDigest rows found");
    }

    const hashtags = [
      ...new Set([...(row.hashtags ?? []), ...FIXED_HASHTAGS]),
    ].filter(Boolean);

    const title = compressTitle(row.title ?? "AI新闻更新");
    const caption = buildCaptionFromScript(row.script, hashtags);

    return { title, caption };
  } finally {
    await client.end();
  }
}

async function waitForManualLogin(page: Page, timeoutMs: number) {
  const isLoginPage =
    page.url().includes("/login") ||
    (await page.locator('input[name="email"]').count()) > 0;

  if (!isLoginPage) {
    return;
  }

  console.log("Detected Xiaohongshu login page.");
  console.log("Please complete login in the opened browser window.");

  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: timeoutMs,
  });
}

async function waitForAppHydration(page: Page, timeoutMs: number) {
  await page.waitForLoadState("domcontentloaded");

  try {
    await page.waitForLoadState("networkidle", {
      timeout: Math.min(timeoutMs, 15_000),
    });
  } catch {
    // Some pages keep long-polling requests open. Continue with DOM-based checks.
  }

  await Promise.race([
    page.getByRole("button", { name: "上传视频" }).first().waitFor({
      state: "visible",
      timeout: timeoutMs,
    }),
    page.getByPlaceholder("填写标题会有更多赞哦").waitFor({
      state: "visible",
      timeout: timeoutMs,
    }),
    page.waitForFunction(
      () => {
        const app = document.querySelector("#app");
        return Boolean(app && app.textContent && app.textContent.trim().length > 0);
      },
      { timeout: timeoutMs },
    ),
  ]);
}

async function dumpDebugArtifacts(page: Page, userDataDir: string) {
  const debugDir = path.join(userDataDir, "debug");
  ensureDir(debugDir);

  const htmlPath = path.join(debugDir, "xiaohongshu-publish-debug.html");
  const screenshotPath = path.join(
    debugDir,
    "xiaohongshu-publish-debug.png",
  );

  fs.writeFileSync(htmlPath, await page.content(), "utf8");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log(`Saved debug HTML to ${htmlPath}`);
  console.log(`Saved debug screenshot to ${screenshotPath}`);
}

async function firstFileInput(frame: Frame) {
  const input = frame.locator('input[type="file"]').first();
  return (await input.count()) > 0 ? input : null;
}

async function getUploadInput(page: Page, userDataDir: string) {
  const uploadButtons = [
    page.getByRole("button", { name: "上传视频" }).first(),
    page.getByText("拖拽视频到此或点击上传").first(),
  ];

  for (const button of uploadButtons) {
    if ((await button.count()) > 0) {
      await button.click().catch(() => undefined);
      await page.waitForTimeout(800);
    }
  }

  for (const frame of page.frames()) {
    const input = await firstFileInput(frame);
    if (input) {
      return input;
    }
  }

  const inputSummary = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).map((element) => ({
      type: element.getAttribute("type"),
      name: element.getAttribute("name"),
      accept: element.getAttribute("accept"),
      hidden:
        element.getAttribute("hidden") !== null ||
        getComputedStyle(element).display === "none" ||
        getComputedStyle(element).visibility === "hidden",
    })),
  );

  console.log(`Current page URL: ${page.url()}`);
  console.log(`Discovered inputs: ${JSON.stringify(inputSummary, null, 2)}`);
  await dumpDebugArtifacts(page, userDataDir);
  throw new Error("Could not find file input on the Xiaohongshu publish page");
}

async function waitForEditState(page: Page, timeoutMs: number) {
  const editSignals = [
    page.getByPlaceholder("填写标题会有更多赞哦"),
    page.getByRole("button", { name: "发布" }),
    page.locator('input[readonly][value*="fakepath"]'),
  ];

  await Promise.race(
    editSignals.map((locator) =>
      locator.waitFor({ state: "visible", timeout: timeoutMs }),
    ),
  );
}

async function fillIfPresent(locator: Locator, value: string) {
  await locator.click();
  await locator.fill(value);
}

async function describeEditables(page: Page) {
  const summary = await page.evaluate(() => {
    const elements = Array.from(
      document.querySelectorAll("input, textarea, [contenteditable='true']"),
    );

    return elements.map((element) => {
      const html = element as HTMLElement;
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      const style = getComputedStyle(html);
      const text =
        "value" in input && typeof input.value === "string"
          ? input.value
          : html.innerText || html.textContent || "";

      return {
        tag: element.tagName,
        type: input.getAttribute("type"),
        placeholder: input.getAttribute("placeholder"),
        ariaLabel: input.getAttribute("aria-label"),
        visible:
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          html.offsetParent !== null,
        text: text.slice(0, 100),
      };
    });
  });

  console.log(`Editable summary: ${JSON.stringify(summary, null, 2)}`);
}

async function fillPostCopyWithDomFallback(
  page: Page,
  title: string,
  caption: string,
) {
  const result = await page.evaluate(
    ({ nextTitle, nextCaption }) => {
      const runner = new Function(
        "nextTitle",
        "nextCaption",
        `
          const isVisible = function(element) {
            const html = element;
            const style = getComputedStyle(html);
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              html.offsetParent !== null
            );
          };

          const setControlValue = function(element, value) {
            const html = element;
            html.focus();

            if ("value" in element && typeof element.value === "string") {
              element.value = value;
            } else {
              html.textContent = value;
              html.innerText = value;
            }

            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            html.blur();
          };

          const candidates = Array.from(
            document.querySelectorAll("input, textarea, [contenteditable='true']")
          ).filter(isVisible);

          const titleEl =
            candidates.find((element) =>
              (element.getAttribute("placeholder") || "").includes("标题")
            ) ??
            candidates.find((element) =>
              (element.getAttribute("aria-label") || "").includes("标题")
            ) ??
            candidates.find(
              (element) =>
                element.tagName === "INPUT" || element.tagName === "TEXTAREA"
            );

          const bodyEl =
            candidates.find(
              (element) =>
                element !== titleEl &&
                (element.tagName === "TEXTAREA" ||
                  element.getAttribute("contenteditable") === "true")
            ) ??
            candidates.find((element) => element !== titleEl);

          if (!titleEl || !bodyEl) {
            return {
              ok: false,
              titleFound: Boolean(titleEl),
              bodyFound: Boolean(bodyEl),
              candidates: candidates.map((element) => ({
                tag: element.tagName,
                type: element.getAttribute("type"),
                placeholder: element.getAttribute("placeholder"),
                ariaLabel: element.getAttribute("aria-label"),
              })),
            };
          }

          setControlValue(titleEl, nextTitle);
          setControlValue(bodyEl, nextCaption);

          return {
            ok: true,
            titleFound: true,
            bodyFound: true,
          };
        `,
      );

      return runner(nextTitle, nextCaption);
    },
    { nextTitle: title, nextCaption: caption },
  );

  if (!result.ok) {
    throw new Error(`DOM fallback failed: ${JSON.stringify(result)}`);
  }
}

async function fillPostCopy(page: Page, title: string, caption: string) {
  await describeEditables(page);
  await fillPostCopyWithDomFallback(page, title, caption);
  await page.waitForTimeout(800);
  console.log("Filled title/caption with DOM fallback.");
}

async function publishIfRequested(page: Page, publish: boolean, timeoutMs: number) {
  const publishButton = page.getByRole("button", { name: "发布" });
  await publishButton.waitFor({ state: "visible", timeout: timeoutMs });

  if (!publish) {
    console.log("Dry run complete. Title/body filled but --publish was not provided.");
    return;
  }

  await publishButton.click();

  await Promise.race([
    page.waitForURL((url) => url.searchParams.get("published") === "true", {
      timeout: timeoutMs,
    }),
    page.getByRole("button", { name: "上传视频" }).waitFor({
      state: "visible",
      timeout: timeoutMs,
    }),
  ]);

  console.log("Publish flow reached a success/reset state.");
}

async function openPublishPage(context: BrowserContext) {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(PUBLISH_URL, { waitUntil: "domcontentloaded" });
  return page;
}

async function ensureLoggedInOnPublishPage(page: Page, timeoutMs: number) {
  await waitForManualLogin(page, timeoutMs);

  if (page.url().includes("/login")) {
    throw new Error("Login did not complete before timeout");
  }

  if (!page.url().includes("/publish/")) {
    await page.goto(PUBLISH_URL, { waitUntil: "domcontentloaded" });
  }

  await page.waitForTimeout(1000);
  await waitForManualLogin(page, timeoutMs);

  if (!page.url().includes("/publish/")) {
    await page.goto(PUBLISH_URL, { waitUntil: "domcontentloaded" });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureFileExists(options.video);
  ensureDir(options.userDataDir);

  const fallbackCopy = await getLatestDigestCopy();
  const title = compressTitle(options.title ?? fallbackCopy.title);
  const caption = options.caption ?? fallbackCopy.caption;

  console.log("Launching Playwright with persistent browser profile...");
  console.log(`userDataDir=${options.userDataDir}`);
  console.log(`video=${options.video}`);
  console.log(`title=${title}`);

  const context = await chromium.launchPersistentContext(options.userDataDir, {
    channel: options.channel,
    headless: options.headless,
    viewport: { width: 1440, height: 1200 },
    args: [
      "--disable-blink-features=AutomationControlled",
      ...(options.profileDirectory
        ? [`--profile-directory=${options.profileDirectory}`]
        : []),
    ],
  });

  try {
    const page = await openPublishPage(context);
    page.setDefaultTimeout(options.timeoutMs);
    console.log(`Opened page: ${page.url()}`);

    await ensureLoggedInOnPublishPage(page, options.timeoutMs);
    console.log(`Ready after login check: ${page.url()}`);
    await waitForAppHydration(page, options.timeoutMs);
    console.log("Xiaohongshu publish app hydrated.");

    const uploadInput = await getUploadInput(page, options.userDataDir);
    await uploadInput.setInputFiles(options.video);
    console.log("Selected local video with setInputFiles().");

    await waitForEditState(page, options.timeoutMs);
    console.log("Publish page entered edit state.");

    await fillPostCopy(page, title, caption);
    console.log("Filled title and caption.");

    await publishIfRequested(page, options.publish, options.timeoutMs);

    if (options.keepOpen) {
      console.log("Keeping browser open. Press Ctrl+C when done.");
      await new Promise(() => undefined);
    }
  } finally {
    if (!options.keepOpen) {
      await context.close();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
