import { describe, expect, it } from "vitest";
import type { ProjectMapApiEndpoint } from "../../project-map/types";
import { searchApiEndpoints } from "./apiProvider";

const base: ProjectMapApiEndpoint = {
  id: "users-get", protocol: "http", language: "java", method: "GET",
  path: "/users/{id}", handlerSymbol: "UserController.getUser",
  sourceFile: "src/UserController.java", parameters: [], responses: [],
  groupIds: [], callChainIds: [], confidence: "high", evidence: [{
    path: "src/UserController.java",
    line: 105,
    excerpt: "public User getUser(String id) {",
    parserSource: "fallback-pattern",
  }],
};
const source = {
  workspaceId: "ws-1", workspaceName: "Demo",
  endpoints: [base, { ...base, id: "graphql-user", protocol: "graphql" as const,
    method: undefined, path: undefined, operationName: "userProfile",
    handlerSymbol: "Query.userProfile" }],
};

describe("searchApiEndpoints", () => {
  it("supports path and method plus path intent", () => {
    expect(searchApiEndpoints("/users", source)[0]?.id).toBe("api:ws-1:users-get");
    expect(searchApiEndpoints("get /users", source)[0]?.title).toBe("GET /users/{id}");
    expect(searchApiEndpoints("post /users", source)).toEqual([]);
  });

  it("searches non-http operations and handlers", () => {
    expect(searchApiEndpoints("userProfile", source)[0]?.id).toBe("api:ws-1:graphql-user");
    expect(searchApiEndpoints("UserController", source)[0]?.filePath).toBe("src/UserController.java");
  });

  it("preserves the endpoint evidence line for source navigation", () => {
    expect(searchApiEndpoints("/users", source)[0]).toMatchObject({
      filePath: "src/UserController.java",
      fileLine: 105,
      fileColumn: 1,
      locationLabel: "src/UserController.java:105",
    });
  });

  it("falls back to opening the source file when evidence has no valid line", () => {
    const result = searchApiEndpoints("/users", {
      ...source,
      endpoints: [{
        ...base,
        evidence: [{
          path: "src/AnotherController.java",
          line: 42,
          parserSource: "fallback-pattern",
        }],
      }],
    })[0];

    expect(result).toMatchObject({
      filePath: "src/UserController.java",
      locationLabel: "src/UserController.java",
    });
    expect(result?.fileLine).toBeUndefined();
  });
});
