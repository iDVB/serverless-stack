const util = require('util')
const AWS = require('aws-sdk')

const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});
const iam = new AWS.IAM({apiVersion: '2010-05-08'});
const events = new AWS.CloudWatchEvents({apiVersion: '2015-10-07'});

const { EdgeFunctionArn, FunctionRoleArn, EventRuleName } = process.env

const handler = async (event, context) => {
  console.log(util.inspect({ event }, { depth: null }))

  if (!EdgeFunctionArn || !FunctionRoleArn || !EventRuleName) throw new Error('Env vars missing')
  
  const thisFunctionName = context.functionName

  const isDeleted = await deleteFunction(EdgeFunctionArn)

  if(isDeleted) {
    console.log(`Attempting to deleteEventRule: ${EventRuleName}`)
    await deleteEventRule(EventRuleName)
    console.log(`Attempting to deleteFunction: ${thisFunctionName}`)
    await deleteFunction(thisFunctionName)
    console.log(`Attempting to deleteRole: ${FunctionRoleArn}`)
    await deleteRole(FunctionRoleArn)
    console.log('COMPLETED all deletions')
  }

  return
}

const deleteEventRule = (Name) => 
  events.deleteRule({ Name }).promise()

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

const deleteRole = (RoleName) => 
  iam.deleteRole({
    RoleName,
  }).promise()



module.exports = { handler }
