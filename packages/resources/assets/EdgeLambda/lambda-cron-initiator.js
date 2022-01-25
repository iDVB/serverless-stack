const util = require('util')
const AWS = require('aws-sdk')

const events = new AWS.CloudWatchEvents({apiVersion: '2015-10-07'});

const { CronRuleName } = process.env

const onEvent = async (event) => {
  console.log(util.inspect({ event }, { depth: null }))

  if (!CronRuleName) throw new Error('Envs Missing!')

  const Data = {}

  const requestType = event['RequestType']

  console.log({ requestType, CronRuleName })

  if (requestType === 'Create') {
    const PhysicalResourceId = CronRuleName
    console.log('-- Create --')
    return { PhysicalResourceId, Data }
    //
    //
  } else if (requestType === 'Update') {
    const oldPhysicalResourceId = event.PhysicalResourceId
    const newPhysicalResourceId = CronRuleName
    console.log('-- Update --', { oldPhysicalResourceId, newPhysicalResourceId })
    return { PhysicalResourceId: newPhysicalResourceId, Data }
    //
    //
  } else if (requestType === 'Delete') {
    const { PhysicalResourceId } = event
    console.log('-- Delete --', PhysicalResourceId)

    const resp = await enableRule(CronRuleName)
    console.log(util.inspect({ resp }, { depth: null }))

    return { PhysicalResourceId, Data }
    //
    //
  } else {
    throw new Error(`Invalid request type: ${requestType}`)
  }
}

const enableRule = (Name) => 
  events.enableRule({ Name }).promise()

module.exports = { onEvent }
