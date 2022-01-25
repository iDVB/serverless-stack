import * as sst from "@serverless-stack/resources";
// import { Distribution } from "aws-cdk-lib/aws-cloudfront";

export default class MyStack extends sst.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const edgeFunction = new sst.EdgeFunction(this, 'EdgeFunction1', {
      handler:  'src/lambda-stub.handler',
    })

    console.log({edgeFunction})
  }
}
