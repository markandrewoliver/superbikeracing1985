import { expect, test } from "@playwright/test";

/**
 * A press, in the shape a post actually has.
 *
 * A Playwright page is top-level and focused; a post is neither. This loads the
 * app the way Reddit does — a sandboxed, cross-origin iframe inside a page that
 * holds the focus itself (embed.html; `127.0.0.1` against `localhost` is one
 * server on two origins).
 *
 * **Assert what the reader can see**, never that a handler ran: a handler can
 * run and the screen still look dead.
 */
const EMBED = "/embed.html#app";

test("pressing in an embedded post changes what the reader sees", async ({ page }) => {
  await page.goto(EMBED);
  const post = page.frameLocator("#post");
  const total = post.locator(".count strong").first();
  await total.waitFor({ timeout: 20_000 });
  const before = Number(await total.textContent());
  await post.locator(".btn").first().click();
  await expect.poll(async () => Number(await total.textContent()), { timeout: 5_000 }).toBeGreaterThan(before);
});

test("several posts on one page all draw", async ({ page }) => {
  await page.goto("/embed.html?n=4#app");
  for (const id of ["#post", "#post-1", "#post-2", "#post-3"]) {
    await page.frameLocator(id).locator(".count strong").first().waitFor({ timeout: 20_000 });
  }
});
