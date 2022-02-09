import path from 'path'
import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as cr from 'aws-cdk-lib/custom-resources'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as events from 'aws-cdk-lib/aws-events'
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets'
import { customAlphabet } from 'nanoid'
import { Construct } from 'constructs'

import {
  PermissionType,
  Permissions,
  attachPermissionsToRole,
} from "./util/permission";

import * as crossRegionHelper from "./edge-function/cross-region-helper";

export type EdgeFunctionProps = lambda.FunctionProps 

export class EdgeFunction extends cdk.Resource implements lambda.IVersion {
  private readonly props: EdgeFunctionProps;
  private static readonly EDGE_REGION: string = 'us-east-1';

  public readonly edgeArn: string;
  public readonly functionName: string;
  public readonly functionArn: string;
  public readonly grantPrincipal: iam.IPrincipal;
  public readonly isBoundToVpc = false;
  public readonly permissionsNode: ConstructNode;
  public readonly role?: iam.IRole;
  public readonly version: string;
  public readonly architecture: lambda.Architecture;

  private readonly _edgeFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: EdgeFunctionProps) {
    super(scope, id)

    const { edgeFunction, edgeArn } = this.createFunction(id, props);
    
    this.edgeArn = edgeArn;

    this.functionArn = edgeArn;
    this._edgeFunction = edgeFunction;
    this.functionName = this._edgeFunction.functionName;
    this.grantPrincipal = this._edgeFunction.role!;
    this.permissionsNode = this._edgeFunction.permissionsNode;
    this.version = lambda.extractQualifierFromArn(this.functionArn);
    this.architecture = this._edgeFunction.architecture;

    this.node.defaultChild = this._edgeFunction;
  }

  public get lambda(): lambda.IFunction {
    return this._edgeFunction;
  }

  /**
   * Convenience method to make `EdgeFunction` conform to the same interface as `Function`.
   */
  public get currentVersion(): lambda.IVersion {
    return this;
  }

  public attachPermissions(permissions: Permissions): void {
    if (this.role) {
      attachPermissionsToRole(this.role as iam.Role, permissions);
    }
  }

  public getConstructMetadata() {
    return {
      type: "NextSite" as const,
      data: {
      },
    };
  }

  

  private createFunction(
    name: string,
    assetPath: string,
    asset: s3Assets.Asset,
    hasRealCode: boolean
  ): lambda.IVersion {
    // If app region is NOT us-east-1, create a Function in us-east-1
    // using a Custom Resource

    // Create a S3 bucket in us-east-1 to store Lambda code. Create
    // 1 bucket for all Edge functions.
    const bucketCR = crossRegionHelper.getOrCreateBucket(this);
    const bucketName = bucketCR.getAttString("BucketName");

    // Create a Lambda function in us-east-1
    const functionCR = crossRegionHelper.createFunction(
      this,
      name,
      this.edgeLambdaRole,
      bucketName,
      {
        Description: `handler for Next.js`,
        Handler: "index.handler",
        Code: {
          S3Bucket: asset.s3BucketName,
          S3Key: asset.s3ObjectKey,
        },
        Runtime: lambda.Runtime.NODEJS_12_X.name,
        MemorySize: this.props?.memorySize || 512,
        Timeout: cdk.Duration.seconds(this.props?.timeout || 10).toSeconds(),
        Role: this.edgeLambdaRole.roleArn,
      }
    );
    const functionArn = functionCR.getAttString("FunctionArn");

    // Create a Lambda function version in us-east-1
    const versionCR = crossRegionHelper.createVersion(this, name, functionArn);
    const versionId = versionCR.getAttString("Version");
    crossRegionHelper.updateVersionLogicalId(functionCR, versionCR);

    // Deploy after the code is updated
    if (hasRealCode) {
      const updaterCR = this.createLambdaCodeReplacer(name, asset);
      functionCR.node.addDependency(updaterCR);
    }

    return lambda.Version.fromVersionArn(
      this,
      `${name}FunctionVersion`,
      `${functionArn}:${versionId}`
    );
  }

}
