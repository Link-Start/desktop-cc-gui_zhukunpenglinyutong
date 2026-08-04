import { describe, expect, it } from "vitest";
import { resolveGitHistoryAuthorAvatar } from "./gitHistoryAuthorAvatar";

describe("resolveGitHistoryAuthorAvatar", () => {
  it("resolves bundled avatar for known contributor display names", () => {
    const result = resolveGitHistoryAuthorAvatar(
      "chenxiangning@example.com",
      "chenxiangning",
    );

    expect(result.avatarSrc).toBeTruthy();
    expect(result.githubProfileUrl).toBe("https://github.com/chenxiangning");
  });

  it("resolves login from GitHub noreply email", () => {
    const result = resolveGitHistoryAuthorAvatar(
      "123456+zhukunpenglinyutong@users.noreply.github.com",
      "Someone Else",
    );

    expect(result.avatarSrc).toBeTruthy();
    expect(result.githubProfileUrl).toBe(
      "https://github.com/zhukunpenglinyutong",
    );
  });

  it("uses github CDN for login-like names outside the persona pool", () => {
    const result = resolveGitHistoryAuthorAvatar(undefined, "octocat");

    expect(result.avatarSrc).toBe("https://github.com/octocat.png?size=40");
    expect(result.githubProfileUrl).toBe("https://github.com/octocat");
  });

  it("returns empty when author cannot map to a github login", () => {
    expect(
      resolveGitHistoryAuthorAvatar("alice@example.com", "Alice Smith"),
    ).toEqual({
      avatarSrc: null,
      githubProfileUrl: null,
    });
    expect(resolveGitHistoryAuthorAvatar(undefined, undefined)).toEqual({
      avatarSrc: null,
      githubProfileUrl: null,
    });
  });
});
