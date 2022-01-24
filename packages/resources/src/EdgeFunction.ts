import path from 'path'
import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as cr from 'aws-cdk-lib/custom-resources'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'

import { Construct } from 'constructs'

import {
  Function,
  FunctionProps,
} from "./Function";

export interface EdgeFunctionSiteProps extends Omit<FunctionProps, 'environment'> {
  distribution: s3.IBucket
}

export class EdgeFunction extends Function {
  public readonly distribution: s3.IBucket

  constructor(scope: Construct, id: string, props: EdgeFunctionSiteProps) {
    super(scope, id, {
      ...props,
      currentVersionOptions: {
        ...props.currentVersionOptions,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      },
    })

    this.createCustomResource()

    this.distribution = props.distribution
  }

  private createCustomResource(): cdk.CustomResource {
    // Create lambda to delete edgefunction and events rule.
    const lambdaCleanup = new lambda.Function(this, 'LambdaCleanup', {
      handler: 'lambda-cleanup.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../assets/EdgeLambda')),
      runtime: lambda.Runtime.NODEJS_14_X,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: { EdgeFunctionArn: this.functionArn },
      currentVersionOptions: {
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      },
    })
    lambdaCleanup.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:DeleteFunction'],
        resources: [this.functionArn],
      }),
    )

    // Create cron that runs lambdaCleanup on schedule
    // until its able to delete the edge-function
    // - deletes edge-function
    // - deletes cron rule
    // - deletes itself
    const cronCleanup = new events.Rule(this, 'Rule', {
      schedule: events.Schedule.cron({ minute: '15', hour: '0' }),
      targets: [new targets.LambdaFunction(lambdaCleanup)],
      enabled: false,
    })
    cronCleanup.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN)
    // Allow cronCleanup to invoke lambdaCleanup
    lambdaCleanup.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:DeleteRule'],
        resources: [cronCleanup.ruleArn],
      }),
    )

    // Create CR that will enable cronCleanup once distro is changed/deleted
    const lambdaCronInitiator = new lambda.Function(this, 'LambdaCronInitiator', {
      handler: 'lambda-cron-initiator.onEvent',
      code: lambda.Code.fromAsset(path.join(__dirname, '../assets/EdgeLambda')),
      runtime: lambda.Runtime.NODEJS_14_X,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: { CronRuleArn: cronCleanup.ruleArn },
    })
    lambdaCronInitiator.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutRule'],
        resources: [cronCleanup.ruleArn],
      }),
    )
    // Allow providerCronInitiator to invoke lambdaCleanup
    const providerCronInitiator = new cr.Provider(this, 'ProviderCronInitiator', {
      onEventHandler: lambdaCronInitiator,
      logRetention: logs.RetentionDays.ONE_DAY,
    })

    const crCronInitiator = new cdk.CustomResource(this, 'CustomResourceCronInitiator', {
      serviceToken: providerCronInitiator.serviceToken,
      properties: {
        DistributionId: this.distribution,
      },
    })

    this.distribution.node.addDependency(crCronInitiator)

    return crCronInitiator
  }
}
