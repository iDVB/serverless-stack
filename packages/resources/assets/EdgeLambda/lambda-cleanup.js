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
    const resp = await lambda.deleteFunction({
      FunctionName
    }).promise()
    console.log(util.inspect({ resp }, { depth: null }))
    deleteStatus = true
  } catch (error) {
    console.log(util.inspect({ error }, { depth: null }))
    deleteStatus = false
  }

  return deleteStatus
}

const deleteRole = async (RoleName) => {

  // Detach ManagedPolicies
  const { AttachedPolicies } = await iam.listAttachedRolePolicies({ RoleName }).promise()
  console.log(util.inspect({ AttachedPolicies }, { depth: null }))

  const promises = []
  AttachedPolicies.forEach(({ PolicyArn })=> {
    console.log(`Detaching Managed Policy: ${PolicyArn}`)
    promises.push(iam.detachRolePolicy({ PolicyArn, RoleName }).promise())
  })

  // Delete InlinePolices
  const { PolicyNames } = await iam.listRolePolicies({ RoleName }).promise()
  console.log(util.inspect({ PolicyNames }, { depth: null }))

  PolicyNames.forEach(( PolicyName )=> {
    console.log(`Deleting Inline Policy: ${PolicyName}`)
    promises.push(iam.deleteRolePolicy({ PolicyName, RoleName }).promise())
  })

  await Promise.all(promises)
  
  await iam.deleteRole({ RoleName }).promise() 

  return
}



module.exports = { handler }
