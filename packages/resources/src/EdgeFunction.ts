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
  Function,
  FunctionProps,
} from "./Function";

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', 10)

export class EdgeFunction extends Function {

  constructor(scope: Construct, id: string, props: FunctionProps) {

    super(scope, id, props)

    const { region, account } = cdk.Stack.of(this) as cdk.Stack

    this.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN)
    
    const roleCleanupName = this.getUniqueName('RoleCleanup')
    const roleCleanup = new iam.Role(this, 'RoleCleanup', {
      roleName: roleCleanupName,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    })
    roleCleanup.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN)

    const cronCleanupName = this.getUniqueName('RuleCronCleanup')
    const cronCleanupArn = `arn:aws:events:${region}:${account}:rule/${cronCleanupName}`

    const lambdaCleanupName = this.getUniqueName('LambdaCleanup')
    const lambdaCleanup = new lambda.Function(this, 'LambdaCleanup', {
      functionName: lambdaCleanupName,
      handler: 'lambda-cleanup.handler',
      role: roleCleanup,
      code: lambda.Code.fromAsset(path.join(__dirname, '../assets/EdgeLambda')),
      runtime: lambda.Runtime.NODEJS_14_X,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: { 
        EdgeFunctionArn: this.functionArn, 
        FunctionRoleArn: roleCleanup.roleArn,
        EventRuleName: cronCleanupName,
      },
    })
    lambdaCleanup.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN)

    const cronCleanup = new events.Rule(this, 'RuleCronCleanup', {
      ruleName: cronCleanupName,
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      enabled: false,
    })
    cronCleanup.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN)
    cronCleanup.addTarget(new eventsTargets.LambdaFunction(lambdaCleanup))

    const lambdaPermissionId = 'EventInvokeLambda'
    lambdaCleanup.addPermission(lambdaPermissionId, {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: cronCleanup.ruleArn
    });
    const permission = lambdaCleanup.permissionsNode.tryFindChild(lambdaPermissionId) as lambda.CfnPermission;
    permission.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN)

    const roleCleanupPolicy = new iam.Policy(this, 'RoleCleanupPolicy', {
      statements: [
        // PERMISSION: Can DELETE EdgeLambda and itself
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['lambda:DeleteFunction'],
          resources: [
            this.functionArn,
            `arn:aws:lambda:${region}:${account}:function:${lambdaCleanupName}`, 
          ],
        }),
        // PERMISSION: Can DELETE the CronRule
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['events:DeleteRule'],
          resources: [ cronCleanupArn ],
        }),
        // PERMISSION: Can DELETE it's own role
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['iam:DeleteRole'],
          resources: [
            `arn:aws:iam::${account}:role/aws/${roleCleanupName}`,
          ],
        }),
      ],
    })
    roleCleanupPolicy.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN)
    roleCleanup.attachInlinePolicy(roleCleanupPolicy);

    // Create CR that will enable cronCleanup once distro is changed/deleted
    const lambdaCronInitiator = new lambda.Function(this, 'LambdaCronInitiator', {
      handler: 'lambda-cron-initiator.onEvent',
      code: lambda.Code.fromAsset(path.join(__dirname, '../assets/EdgeLambda')),
      runtime: lambda.Runtime.NODEJS_14_X,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: { CronRuleName: cronCleanup.ruleName },
    })
    lambdaCronInitiator.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:EnableRule'],
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
    })

    crCronInitiator.node.addDependency(this)
  }

  // test-edge-function-my-stack-RoleCleanup-zph6n0jtzi
  private getUniqueName(name: string) {
    const { stackName } = cdk.Stack.of(this) as cdk.Stack
    const hash = nanoid()
    return `${stackName}-${name}-${hash}`
  }
}
