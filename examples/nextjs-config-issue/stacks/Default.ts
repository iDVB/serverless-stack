import { StackContext, NextjsSite, Config } from "sst/constructs";

export function Default({ stack }: StackContext) {
  const TEST_PARAM = new Config.Parameter(stack, 'TEST_PARAM', {
    value: 'this is a test',
  })

  const site = new NextjsSite(stack, "site", {
    path: "packages/web",
    bind: [TEST_PARAM],
  });
  stack.addOutputs({
    SiteUrl: site.url,
  });
}
