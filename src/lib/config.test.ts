import { afterEach, describe, expect, it, vi } from "vitest";

describe("config allowlists", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps default Disqus shortname and rejects injection", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISQUS_SHORTNAME", "evil.com/x");
    const { DISQUS_SHORTNAME } = await import("./config");
    expect(DISQUS_SHORTNAME).toBe("lsemods");
  });

  it("accepts a valid Disqus shortname", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISQUS_SHORTNAME", "lsemods-test");
    const { DISQUS_SHORTNAME } = await import("./config");
    expect(DISQUS_SHORTNAME).toBe("lsemods-test");
  });

  it("rejects non-https Open Collective URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_OPEN_COLLECTIVE_URL", "http://opencollective.com/lsemods");
    const { OPEN_COLLECTIVE_URL } = await import("./config");
    expect(OPEN_COLLECTIVE_URL).toBe("https://opencollective.com/lsemods");
  });

  it("allows localhost SITE_URL for Docker QA", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { SITE_URL } = await import("./config");
    expect(SITE_URL).toBe("http://localhost:3000");
  });

  it("rejects javascript: Telegram URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_TELEGRAM_URL", "javascript:alert(1)");
    const { TELEGRAM_URL } = await import("./config");
    expect(TELEGRAM_URL.startsWith("https://t.me/")).toBe(true);
  });
});
