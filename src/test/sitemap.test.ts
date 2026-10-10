import { describe, expect, it } from "vitest";
import { createRootRoute, createRoute, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { sitemapStaticPaths, sitemapXML } from "../lib/sitemap";

describe("public sitemap", () => {
  it("derives public URLs and cannot override excluded private ancestors", () => {
    const root = createRootRoute({ staticData: { sitemap: false } });
    const home = createRoute({ getParentRoute: () => root, path: "/", staticData: { sitemap: true } });
    const credits = createRoute({ getParentRoute: () => root, path: "credits", staticData: { sitemap: true } });
    const auth = createRoute({ getParentRoute: () => root, path: "auth", staticData: { sitemap: false } });
    const privateLayout = createRoute({ getParentRoute: () => root, id: "private", staticData: { sitemap: "exclude-subtree" } });
    const salon = createRoute({ getParentRoute: () => privateLayout, path: "salons", staticData: { sitemap: true } });
    const dynamic = createRoute({ getParentRoute: () => root, path: "story/$id", staticData: { sitemap: true } });
    const router = createRouter({ routeTree: root.addChildren([home, credits, auth, privateLayout.addChildren([salon]), dynamic]), history: createMemoryHistory() });
    expect(sitemapStaticPaths(router)).toEqual(["/", "/credits"]);
  });
  it("uses the published domain without invented lastmod dates", () => {
    const xml = sitemapXML("https://bastion-brutalist-crawl.lovable.app", [{ path: "/" }, { path: "/credits" }, { path: "/" }]);
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain("<loc>https://bastion-brutalist-crawl.lovable.app/credits</loc>");
    expect(xml).not.toContain("lastmod");
  });
  it("rejects malformed destinations and non-origin base URLs", () => {
    for (const path of ["//evil.example", "/?token=private", "/#secret", "relative"]) {
      expect(() => sitemapXML("https://bastion-brutalist-crawl.lovable.app", [{ path }])).toThrow();
    }
    expect(() => sitemapXML("https://example.com/private", [{ path: "/" }])).toThrow();
  });
});