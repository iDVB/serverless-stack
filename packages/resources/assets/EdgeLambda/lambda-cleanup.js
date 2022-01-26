const util = require('util')
const AWS = require('aws-sdk')

const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});
const iam = new AWS.IAM({apiVersion: '2010-05-08'});
const events = new AWS.CloudWatchEvents({apiVersion: '2015-10-07'});

const { EdgeFunctionArn, FunctionRoleName, EventRuleName } = process.env

const handler = async (event, context) => {
  console.log(util.inspect({ event }, { depth: null }))

  if (!EdgeFunctionArn || !FunctionRoleName || !EventRuleName) throw new Error('Env vars missing')
  
  const thisFunctionName = context.functionName

  const isDeleted = await deleteFunction(EdgeFunctionArn)

  if(isDeleted) {
    console.log(`Attempting to deleteEventRule: ${EventRuleName}`)
    await deleteEventRule(EventRuleName)
    console.log(`Attempting to deleteFunction: ${thisFunctionName}`)
    await deleteFunction(thisFunctionName)
    console.log(`Attempting to deleteRole: ${FunctionRoleName}`)
    await deleteRole(FunctionRoleName)
    console.log('COMPLETED all deletions')
  }

  return
}

const deleteEventRule = async (Rule) => {
  const { Targets } = await events.listTargetsByRule({ Rule }).promise()
  console.log(util.inspect({ Targets }, { depth: null }))

  const Ids = Targets.map((target) => target.Id)
  await events.removeTargets({ Ids, Rule }).promise()
  await events.deleteRule({ Name: Rule }).promise()
}

const deleteFunction = async (FunctionName) => {
  let deleteStatus

  try {
    const deleteFunctionResp = await lambda.deleteFunction({
      FunctionName
    }).promise()
    console.log(util.inspect({ deleteFunctionResp }, { depth: null }))
    deleteStatus = true
  } catch (deleteFunctionError) {
    console.log(util.inspect({ deleteFunctionError }, { depth: null }))
    deleteStatus = false

    const { code, statusCode } = deleteFunctionError
    if (statusCode !== '400' || code === 'InvalidParameterValueException') {
      throw new Error(deleteFunctionError)
    }
    else {
      console.log('Replica Function Detected. Sleeping.')
    }
  }

  return deleteStatus
}
// 2022-01-25T22:22:43.084Z	3cbaa9f3-cbd5-4188-9354-ac7cccd2184e	INFO	{
//   deleteFunctionError: InvalidParameterValueException: Lambda was unable to delete arn:aws:lambda:us-east-1:104477223281:function:test-edge-function-my-stack-EdgeFunction71EFB7B6-3gAimmVa6yCc:1 because it is a replicated function. Please see our documentation for Deleting Lambda@Edge Functions and Replicas.
//       at Object.extractError (/var/runtime/node_modules/aws-sdk/lib/protocol/json.js:52:27)
//       at Request.extractError (/var/runtime/node_modules/aws-sdk/lib/protocol/rest_json.js:49:8)
//       at Request.callListeners (/var/runtime/node_modules/aws-sdk/lib/sequential_executor.js:106:20)
//       at Request.emit (/var/runtime/node_modules/aws-sdk/lib/sequential_executor.js:78:10)
//       at Request.emit (/var/runtime/node_modules/aws-sdk/lib/request.js:686:14)
//       at Request.transition (/var/runtime/node_modules/aws-sdk/lib/request.js:22:10)
//       at AcceptorStateMachine.runTo (/var/runtime/node_modules/aws-sdk/lib/state_machine.js:14:12)
//       at /var/runtime/node_modules/aws-sdk/lib/state_machine.js:26:10
//       at Request.<anonymous> (/var/runtime/node_modules/aws-sdk/lib/request.js:38:9)
//       at Request.<anonymous> (/var/runtime/node_modules/aws-sdk/lib/request.js:688:12) {
//     code: 'InvalidParameterValueException',
//     time: 2022-01-25T22:22:43.025Z,
//     requestId: '1cade985-2198-427d-bd11-b9e3709024e0',
//     statusCode: 400,
//     retryable: false,
//     retryDelay: 36.166511901113466
//   }
// }

const deleteRole = async (RoleName) => {

  // Detach ManagedPolicies
  const { AttachedPolicies } = await iam.listAttachedRolePolicies({ RoleName }).promise()
  console.log(util.inspect({ AttachedPolicies }, { depth: null }))

  const promises = []
  AttachedPolicies.forEach(({ PolicyArn }) => {
    console.log(`Detaching Managed Policy: ${PolicyArn}`)
    promises.push(iam.detachRolePolicy({ PolicyArn, RoleName }).promise())
  })

  // Delete InlinePolices
  const { PolicyNames } = await iam.listRolePolicies({ RoleName }).promise()
  console.log(util.inspect({ PolicyNames }, { depth: null }))

  PolicyNames.forEach(( PolicyName ) => {
    console.log(`Deleting Inline Policy: ${PolicyName}`)
    promises.push(iam.deleteRolePolicy({ PolicyName, RoleName }).promise())
  })

  await Promise.all(promises)
  
  await iam.deleteRole({ RoleName }).promise() 

  return
}



module.exports = { handler }
