import * as cdk from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as sst from "@serverless-stack/resources"

export default class MyStack extends sst.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const edgeFunc = new sst.EdgeFunction(this, "EdgeFunction", {
      handler: "src/lambda-stub.handler",
      // memorySize: 128,
      timeout: cdk.Duration.seconds(5),
    });

    new sst.StaticSite(this, "Site", {
      path: "frontend",
      indexPage: "index.html",
      errorPage: "error.html",
      cfDistribution: {
        defaultBehavior: {
          edgeLambdas: [
            {
              functionVersion: edgeFunc.currentVersion,
              eventType: cloudfront.LambdaEdgeEventType.VIEWER_RESPONSE,
            },
          ],
        },
      },
    });
   
  }
}
