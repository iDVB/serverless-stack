import * as s3 from 'aws-cdk-lib/aws-s3'
import * as sst from "@serverless-stack/resources";
// import { Distribution } from "aws-cdk-lib/aws-cloudfront";

export default class MyStack extends sst.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'TestBucket')

    new sst.EdgeFunction(this, 'EdgeFunction', {
      handler:  'src/lambda-stub.handler',
      distribution: bucket,
    })
  }
}
