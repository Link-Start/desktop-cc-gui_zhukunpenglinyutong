import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { buildConversationCompletionEmail } from "./conversationCompletionEmail";

const baseMetadata = {
  workspaceId: "ws-1",
  workspaceName: "Moss Workspace",
  workspacePath: "/repo/mossx",
  threadId: "thread-1",
  threadName: "Email proposal",
  turnId: "turn-1",
  engine: "codex" as const,
};

describe("buildConversationCompletionEmail", () => {
  it("builds completion email from the assistant final answer text", () => {
    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "Please implement it." },
      { id: "a1", kind: "message", role: "assistant", text: "Done. I changed the files." },
    ];

    const result = buildConversationCompletionEmail(items, baseMetadata);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.subject).toBe("Moss completed - Codex · Email proposal · Moss Workspace");
    expect(result.request.textBody).not.toContain("Workspace: Moss Workspace");
    expect(result.request.textBody).not.toContain("Thread: Email proposal");
    expect(result.request.textBody).toContain("本轮用户请求");
    expect(result.request.textBody).toContain("Please implement it.");
    expect(result.request.textBody).toContain("本轮修复信息");
    expect(result.request.textBody).toContain("Done. I changed the files.");
    expect(result.request.textBody).toContain("下一步建议");
    expect(result.request.textBody).toContain("这封邮件只是完成通知");
    expect(result.request.textBody).not.toContain("--- Reply above this line ---");
    expect(result.request.textBody).not.toContain("ACTION: NEXT");
    expect(result.request.textBody).not.toContain("Moss context");
    expect(result.request.mailDrivenSessionEnabled).toBe(false);
    expect(result.request.sessionId).toBe("ms_thread-1");
    expect(result.request.nextRecommendations?.length).toBeGreaterThan(0);
    expect(result.activityCount).toBe(0);
  });

  it("uses human reply instructions for actionable mail-driven sessions", () => {
    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "Continue by email." },
      { id: "a1", kind: "message", role: "assistant", text: "- **修复收信失败**\n- 下一步检查邮箱" },
    ];

    const result = buildConversationCompletionEmail(items, baseMetadata, {
      mailDrivenSessionEnabled: true,
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.mailDrivenSessionEnabled).toBe(true);
    expect(result.request.textBody).toContain("如何回复");
    expect(result.request.textBody).toContain("继续：执行下一步");
    expect(result.request.textBody).toContain("直接写要求");
    expect(result.request.textBody).toContain("--- Reply above this line ---");
    expect(result.request.textBody).not.toContain("ACTION: NEXT");
    expect(result.request.textBody).toContain("- **修复收信失败**");
  });

  it("does not reuse an assistant final message completed before the current email intent was armed", () => {
    const result = buildConversationCompletionEmail(
      [
        { id: "u1", kind: "message", role: "user", text: "第一轮请求" },
        {
          id: "a1",
          kind: "message",
          role: "assistant",
          text: "第一轮结果。",
          isFinal: true,
          finalCompletedAt: 1_000,
        },
      ],
      { ...baseMetadata, turnId: "turn-2" },
      {
        mailDrivenSessionEnabled: true,
        minAssistantFinalCompletedAt: 2_000,
      },
    );

    expect(result).toEqual({
      status: "skipped",
      reason: "missing_assistant_message",
    });
  });

  it("uses the latest assistant final message completed after the current email intent was armed", () => {
    const result = buildConversationCompletionEmail(
      [
        { id: "u1", kind: "message", role: "user", text: "第一轮请求" },
        {
          id: "a1",
          kind: "message",
          role: "assistant",
          text: "第一轮结果。",
          isFinal: true,
          finalCompletedAt: 1_000,
        },
        { id: "u2", kind: "message", role: "user", text: "第二轮请求" },
        {
          id: "a2",
          kind: "message",
          role: "assistant",
          text: "第二轮结果。",
          isFinal: true,
          finalCompletedAt: 2_500,
        },
      ],
      { ...baseMetadata, turnId: "turn-2" },
      {
        mailDrivenSessionEnabled: true,
        minAssistantFinalCompletedAt: 2_000,
      },
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain("第二轮请求");
    expect(result.request.textBody).toContain("第二轮结果");
    expect(result.request.textBody).not.toContain("第一轮结果");
  });

  it("puts engine and a shortened session name in the email subject", () => {
    const result = buildConversationCompletionEmail(
      [
        { id: "u1", kind: "message", role: "user", text: "查一下登录为什么失败。" },
        { id: "a1", kind: "message", role: "assistant", text: "已经定位并修复。" },
      ],
      {
        ...baseMetadata,
        workspaceName: "springboot-demo",
        threadName: "登录注册鉴权链路异常排查和 refresh token 文档同步这串非常长的 session 名称",
        engine: "claude",
      },
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.subject).toContain("Claude");
    expect(result.request.subject).toContain("登录注册鉴权链路异常排查");
    expect(result.request.subject).toContain("...");
    expect(result.request.subject).toContain("springboot-demo");
    expect(result.request.subject.length).toBeLessThan(90);
  });

  it("uses the final answer text before the reasoning boundary for the repair section", () => {
    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "看一下验证结果。" },
      {
        id: "a1",
        kind: "message",
        role: "assistant",
        text: [
          "最终消息 - 05-21 17:13:56",
          "",
          "我会先看 Maven/Surefire 的测试报告和当前工作区状态。",
          "",
          "本地报告显示当前只有两个测试类：`JwtUtilTest` 和 `UserServiceTest`，共 13 个测试全部通过。",
          "",
          "推理过程",
          "",
          "- Controller 集成测试：注册、登录、/me、401、409。",
          "- SecurityConfig 鉴权链测试：匿名接口放行、受保护接口拦截。",
        ].join("\n"),
      },
    ];

    const result = buildConversationCompletionEmail(items, baseMetadata, {
      mailDrivenSessionEnabled: true,
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain(
      "我会先看 Maven/Surefire 的测试报告和当前工作区状态。",
    );
    expect(result.request.textBody).toContain(
      "本地报告显示当前只有两个测试类：`JwtUtilTest` 和 `UserServiceTest`，共 13 个测试全部通过。",
    );
    expect(result.request.textBody).not.toContain("Controller 集成测试");
    expect(result.request.textBody).not.toContain("SecurityConfig 鉴权链测试");
  });

  it("prefers the assistant item marked as final over later assistant process text", () => {
    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "验证一下。" },
      {
        id: "a-final",
        kind: "message",
        role: "assistant",
        isFinal: true,
        text: "本地报告显示当前只有两个测试类，13 个测试全部通过。",
      },
      {
        id: "a-process",
        kind: "message",
        role: "assistant",
        text: "- Controller 集成测试：注册、登录、/me、401、409。",
      },
    ];

    const result = buildConversationCompletionEmail(items, baseMetadata);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain("13 个测试全部通过");
    expect(result.request.textBody).not.toContain("Controller 集成测试");
  });

  it("keeps all visible assistant text in the completed turn instead of only the last short final", () => {
    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "项目分析" },
      {
        id: "a-scan",
        kind: "message",
        role: "assistant",
        text: [
          "已完成项目扫描，给你先给结论：",
          "",
          "项目结论：这是一个可运行的 Spring Boot 多端认证演示服务。",
          "",
          "核心架构",
          "- 入口：Spring Boot 2.7.18 + Java 11 + Maven。",
          "- 分层：controller / service / security / repository。",
        ].join("\n"),
      },
      {
        id: "tool-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "mvn test",
        detail: "test output",
        status: "completed",
      },
      {
        id: "a-confirm",
        kind: "message",
        role: "assistant",
        text: "我再补一个小确认：当前工作区有少量未提交变更，本次我未做进一步修改。",
        isFinal: true,
        finalCompletedAt: 2_000,
      },
    ];

    const result = buildConversationCompletionEmail(items, baseMetadata, {
      mailDrivenSessionEnabled: true,
      minAssistantFinalCompletedAt: 1_000,
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain("已完成项目扫描，给你先给结论");
    expect(result.request.textBody).toContain("项目结论：这是一个可运行的 Spring Boot 多端认证演示服务");
    expect(result.request.textBody).toContain("我再补一个小确认");
    expect(result.request.textBody).not.toContain("mvn test");
    expect(result.request.textBody).not.toContain("test output");
  });

  it("omits file change and tool cards from the email body", () => {
    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "Add tests." },
      {
        id: "tool-1",
        kind: "tool",
        toolType: "fileChange",
        title: "File changes",
        detail: "Updated source",
        status: "completed",
        changes: [
          { path: "src/a.ts", kind: "modified" },
          { path: "src/b.ts", kind: "added" },
        ],
      },
      {
        id: "tool-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "npm test",
        detail: "vitest",
        status: "completed",
        output: "PASS src/a.test.ts",
      },
      { id: "a1", kind: "message", role: "assistant", text: "Tests are passing." },
    ];

    const result = buildConversationCompletionEmail(items, baseMetadata);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain("Tests are passing.");
    expect(result.request.textBody).not.toContain("File changes");
    expect(result.request.textBody).not.toContain("src/a.ts");
    expect(result.request.textBody).not.toContain("src/b.ts");
    expect(result.request.textBody).not.toContain("npm test");
    expect(result.request.textBody).not.toContain("PASS src/a.test.ts");
    expect(result.activityCount).toBe(0);
  });

  it("omits non-file-change activity cards from the email body", () => {
    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "Review and draw." },
      {
        id: "d1",
        kind: "diff",
        title: "src/app.ts",
        diff: "+const value = true;",
        status: "completed",
      },
      {
        id: "r1",
        kind: "review",
        state: "completed",
        text: "No blocking issues.",
      },
      {
        id: "g1",
        kind: "generatedImage",
        status: "completed",
        promptText: "wireframe",
        images: [{ src: "image://one", localPath: "/tmp/one.png" }],
      },
      { id: "a1", kind: "message", role: "assistant", text: "Review done." },
    ];

    const result = buildConversationCompletionEmail(items, baseMetadata);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).not.toContain("Diff: src/app.ts");
    expect(result.request.textBody).not.toContain("Review: completed");
    expect(result.request.textBody).not.toContain("Generated image: completed");
    expect(result.request.textBody).not.toContain("/tmp/one.png");
    expect(result.activityCount).toBe(0);
  });

  it("keeps workspace paths out of the visible email body", () => {
    const result = buildConversationCompletionEmail(
      [
        { id: "u1", kind: "message", role: "user", text: "Ship it." },
        { id: "a1", kind: "message", role: "assistant", text: "Shipped." },
      ],
      {
        ...baseMetadata,
        workspacePath: "C:\\Users\\Chen\\project",
      },
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).not.toContain("C:\\Users\\Chen\\project");
  });

  it("truncates long user context before adding it to the email body", () => {
    const longUserMessage = `请处理：${"很长的上下文".repeat(180)}`;
    const result = buildConversationCompletionEmail(
      [
        { id: "u1", kind: "message", role: "user", text: longUserMessage },
        { id: "a1", kind: "message", role: "assistant", text: "已处理。" },
      ],
      baseMetadata,
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain("本轮用户请求");
    expect(result.request.textBody).toContain("[truncated]");
    expect(result.request.textBody).not.toContain(longUserMessage);
  });

  it("keeps the visible final assistant text instead of summarizing it", () => {
    const finalText = [
      "可以，我先按你说的来做。先给你一个明确执行计划（先确认后落盘）：",
      "",
      "目标：把项目文档同步到当前项目现状，明确“演示级实现 + 生产前必须修复项”。",
      "",
      "1. `README.md`：新增“安全与生产配置”与“当前限制/待优化”。",
      "2. `快速开始.md`：补充 3 分钟可跑环境与默认凭证/配置警告。",
      "",
      "收到。你确认了就按这个方向直接改。",
      "我先等你点头（回复“开始”/“按这个范围来”即可），然后我会立刻落地三处文档更新。",
    ].join("\n");

    const result = buildConversationCompletionEmail(
      [
        { id: "u1", kind: "message", role: "user", text: "先更新一下项目文档" },
        { id: "a1", kind: "message", role: "assistant", text: finalText },
      ],
      baseMetadata,
      { mailDrivenSessionEnabled: true },
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain(finalText);
    expect(result.request.textBody).not.toContain("完整内容请回到 Moss 客户端会话查看");
  });

  it("caps extremely long assistant final text", () => {
    const longAnswer = Array.from({ length: 80 }, (_, index) => `line ${index}`).join("\n");
    const result = buildConversationCompletionEmail(
      [
        { id: "u1", kind: "message", role: "user", text: "Explain everything." },
        { id: "a1", kind: "message", role: "assistant", text: longAnswer },
      ],
      baseMetadata,
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain("line 0");
    expect(result.request.textBody).toContain("line 79");

    const veryLongAnswer = Array.from({ length: 120 }, (_, index) => `line ${index}`).join("\n");
    const capped = buildConversationCompletionEmail(
      [
        { id: "u1", kind: "message", role: "user", text: "Explain everything." },
        { id: "a1", kind: "message", role: "assistant", text: veryLongAnswer },
      ],
      baseMetadata,
    );

    expect(capped.status).toBe("ready");
    if (capped.status !== "ready") {
      return;
    }
    expect(capped.request.textBody).toContain("[内容过长，已截断；完整内容请回到 Moss 客户端查看。]");
  });

  it("skips when the visible conversation has no assistant answer", () => {
    const result = buildConversationCompletionEmail(
      [{ id: "u1", kind: "message", role: "user", text: "Ping" }],
      baseMetadata,
    );

    expect(result).toEqual({
      status: "skipped",
      reason: "missing_assistant_message",
    });
  });

  it("summarizes prose by sentence boundaries without regex lookbehind", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "conversationCompletionEmail.ts"),
      "utf8",
    );
    // Older WKWebView throws on lookbehind: invalid group specifier name.
    const codeWithoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(codeWithoutComments).not.toMatch(/\(\?<[=!]/);

    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "What changed?" },
      {
        id: "a1",
        kind: "message",
        role: "assistant",
        text: "Fixed the crash. Updated the sanitizer. 请再验证一次。",
      },
    ];
    const result = buildConversationCompletionEmail(items, baseMetadata);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    // Sentence split keeps terminators on the preceding segment (lookbehind-equivalent).
    expect(result.request.textBody).toContain("Fixed the crash.");
    expect(result.request.textBody).toContain("Updated the sanitizer.");
    expect(result.request.textBody).toContain("请再验证一次。");
  });
});
