import { CloudFormationCustomResourceEvent } from 'aws-lambda'
import { customAlphabet } from 'nanoid'

const { SUFFIX } = process.env
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', 10)

const onEvent = async (event: CloudFormationCustomResourceEvent) => {
  console.log('lambda.js: onEvent', event)
  const { EdgeFunctionArn } = event.ResourceProperties
  if (!EdgeFunctionArn) throw new Error('Envs Missing!')

  const Data = {}

  const requestType = event['RequestType']

  console.log({ requestType, EdgeFunctionArn })

  if (requestType === 'Create') {
    const PhysicalResourceId = EdgeFunctionArn
    console.log('-- Create --')
    return { PhysicalResourceId, Data }
    //
    //
  } else if (requestType === 'Update') {
    const oldPhysicalResourceId = event.PhysicalResourceId
    const newPhysicalResourceId = EdgeFunctionArn
    console.log('-- Update --', { oldPhysicalResourceId, newPhysicalResourceId })
    return { PhysicalResourceId: newPhysicalResourceId, Data }
    //
    //
  } else if (requestType === 'Delete') {
    const { PhysicalResourceId } = event
    console.log('-- Delete --', PhysicalResourceId)

    // create eventBridgeCron for EdgeFunctionArn

    return { PhysicalResourceId, Data }
    //
    //
  } else {
    throw new Error(`Invalid request type: ${requestType}`)
  }
}

export { onEvent }
