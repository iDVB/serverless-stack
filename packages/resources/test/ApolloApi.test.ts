import { countResources, countResourcesLike, hasResource } from "./helper";
import { App, Stack, ApolloApi, ApolloApiProps } from "../src";

test("server-undefined-error", async () => {
  const stack = new Stack(new App(), "stack");
  expect(() => {
    new ApolloApi(stack, "Api", {} as ApolloApiProps);
  }).toThrow(/Missing "server"/);
});

test("server-string", async () => {
  const stack = new Stack(new App(), "stack");
  new ApolloApi(stack, "Api", {
    server: "test/lambda.handler",
  });
  countResources(stack, "AWS::ApiGatewayV2::Api", 1);
  countResources(stack, "AWS::ApiGatewayV2::Route", 2);
  hasResource(stack, "AWS::ApiGatewayV2::Route", {
    RouteKey: "GET /",
    Target: {
      "Fn::Join": [
        "",
        [
          "integrations/",
          {
            Ref: "ApiRouteGETIntegrationGET10DCD122",
          },
        ],
      ],
    },
  });
  hasResource(stack, "AWS::ApiGatewayV2::Route", {
    RouteKey: "POST /",
    Target: {
      "Fn::Join": [
        "",
        [
          "integrations/",
          {
            Ref: "ApiRouteGETIntegrationGET10DCD122",
          },
        ],
      ],
    },
  });
  countResources(stack, "AWS::Lambda::Function", 1);
  countResourcesLike(stack, "AWS::Lambda::Function", 1, {
    Handler: "test/lambda.handler",
  });
});

test("routes", async () => {
  const stack = new Stack(new App(), "stack");
  expect(() => {
    new ApolloApi(stack, "Api", {
      server: "test/lambda.handler",
      routes: {
        "GET /": "test/lambda.handler",
      },
    } as ApolloApiProps);
  }).toThrow(/Please use the "server" option/);
});

test("rootPath", async () => {
  const stack = new Stack(new App(), "stack");
  const rootPath = "/api";
  const api = new ApolloApi(stack, "Api", {
    server: "test/lambda.handler",
    rootPath,
  } as ApolloApiProps);
  expect(api.serverFunction).toBeDefined();
  countResources(stack, "AWS::ApiGatewayV2::Route", 2);
  hasResource(stack, "AWS::ApiGatewayV2::Route", {
    RouteKey: "GET /api",
  });
  hasResource(stack, "AWS::ApiGatewayV2::Route", {
    RouteKey: "POST /api",
  });
});

///////////////////
// Test Properties
///////////////////

test("serverFunction", async () => {
  const stack = new Stack(new App(), "stack");
  const api = new ApolloApi(stack, "Api", {
    server: "test/lambda.handler",
  });
  expect(api.serverFunction).toBeDefined();
});
