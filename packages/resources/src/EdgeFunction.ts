import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3Assets from "aws-cdk-lib/aws-s3-assets";
import * as cdk from 'aws-cdk-lib';
import { Construct, Node } from 'constructs';
import { customAlphabet } from 'nanoid'

import * as crossRegionHelper from "./edge-function/cross-region-helper";

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', 10)

export type EdgeFunctionProps = lambda.FunctionProps

export class EdgeFunction extends cdk.Resource implements lambda.IVersion {
  public readonly edgeArn: string;
  public readonly functionName: string;
  public readonly functionArn: string;
  public readonly grantPrincipal: iam.IPrincipal;
  public readonly isBoundToVpc = false;
  public readonly permissionsNode: Node;
  public readonly role: iam.Role;
  public readonly version: string;

  private readonly functionVersion: lambda.IVersion;
  private static readonly EDGE_REGION: string = 'us-east-1';
  private readonly props: EdgeFunctionProps;

  constructor(scope: Construct, id: string, props: EdgeFunctionProps) {
    super(scope, id);

    this.props = props

    this.role = this.createEdgeFunctionRole();
    this.functionVersion = this.createEdgeFunction()

    this.edgeArn = this.functionVersion.edgeArn;
    this.functionArn = this.edgeArn;
    this.functionName = this.functionVersion.lambda.functionName;

    this.grantPrincipal = this.role;
    this.permissionsNode = this._edgeFunction.permissionsNode;
    this.version = this.functionVersion.version;

    // this.node.defaultChild = this._edgeFunction;
  }

  public get lambda(): lambda.IFunction {
    return this.functionVersion.lambda;
  }

  public get currentVersion(): lambda.IVersion {
    return this;
  }

  public addAlias(aliasName: string, options: lambda.AliasOptions = {}): lambda.Alias {
    return new lambda.Alias(this.functionVersion.lambda, `Alias${aliasName}`, {
      aliasName,
      version: this,
      ...options,
    });
  }

  /**
   * Not supported. Connections are only applicable to VPC-enabled functions.
   */
  public get connections(): ec2.Connections {
    throw new Error('Lambda@Edge does not support connections');
  }
  public get latestVersion(): lambda.IVersion {
    throw new Error('$LATEST function version cannot be used for Lambda@Edge');
  }
  public get architecture(): lambda.Architecture {
    throw new Error('Lambda@Edge does not support architecture');
  }

  public addEventSourceMapping(id: string, options: lambda.EventSourceMappingOptions): lambda.EventSourceMapping {
    return this.lambda.addEventSourceMapping(id, options);
  }
  public addPermission(id: string, permission: lambda.Permission): void {
    return this.lambda.addPermission(id, permission);
  }
  public addToRolePolicy(statement: iam.PolicyStatement): void {
    return this.lambda.addToRolePolicy(statement);
  }
  public grantInvoke(identity: iam.IGrantable): iam.Grant {
    return this.lambda.grantInvoke(identity);
  }
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metric(metricName, { ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricDuration(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricDuration({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricErrors({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricInvocations(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricInvocations({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricThrottles(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricThrottles({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  /** Adds an event source to this function. */
  public addEventSource(source: lambda.IEventSource): void {
    return this.lambda.addEventSource(source);
  }
  public configureAsyncInvoke(options: lambda.EventInvokeConfigOptions): void {
    return this.lambda.configureAsyncInvoke(options);
  }

  // test-edge-function-my-stack-RoleCleanup-zph6n0jtzi
  private getUniqueName(name: string) {
    const { stackName } = cdk.Stack.of(this) as cdk.Stack
    const hash = nanoid()
    return `${stackName}-${name}-${hash}`
  }

  private createEdgeFunction(
    assetPath: string,
    asset: s3Assets.Asset,
  ): lambda.IVersion {
    // If app region is NOT us-east-1, create a Function in us-east-1
    // using a Custom Resource

    // Create a S3 bucket in us-east-1 to store Lambda code. Create
    // 1 bucket for all Edge functions.
    const bucketCR = crossRegionHelper.getOrCreateBucket(this);
    const bucketName = bucketCR.getAttString("BucketName");

    const name = this.getUniqueName('EdgeFunction')

    // Create a Lambda function in us-east-1
    const functionCR = crossRegionHelper.createFunction(
      this,
      name,
      this.role,
      bucketName,
      {
        Description: `Edge Function`,
        Handler: "index-wrapper.handler",
        Code: {
          S3Bucket: asset.s3BucketName,
          S3Key: asset.s3ObjectKey,
        },
        Runtime: lambda.Runtime.NODEJS_12_X.name,
        MemorySize: 128,
        Timeout: cdk.Duration.seconds(10).toSeconds(),
        Role: this.role.roleArn,
      }
    );
    const functionArn = functionCR.getAttString("FunctionArn");

    // Create a Lambda function version in us-east-1
    const versionCR = crossRegionHelper.createVersion(this, name, functionArn);
    const versionId = versionCR.getAttString("Version");
    crossRegionHelper.updateVersionLogicalId(functionCR, versionCR);

    return lambda.Version.fromVersionArn(
      this,
      `${name}FunctionVersion`,
      `${functionArn}:${versionId}`
    );
  }

  private createEdgeFunctionRole(): iam.Role {
    const managedPolicies = new Array<iam.IManagedPolicy>();

    // the arn is in the form of - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    managedPolicies.push(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));

    const role = new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('edgelambda.amazonaws.com'),
      managedPolicies,
    });

    return role
  }
}
