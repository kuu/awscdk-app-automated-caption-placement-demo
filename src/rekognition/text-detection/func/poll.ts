import { SQSClient, ReceiveMessageCommand } from '@aws-sdk/client-sqs';

const client = new SQSClient({
  region: process.env.REGION,
});

const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL as string;

export async function handler() {
  const command = new ReceiveMessageCommand({
    QueueUrl: SQS_QUEUE_URL,
  });
  const response = await client.send(command);
  try {
    const responseText = JSON.stringify(response, null, 2);
    console.log(responseText);
  } catch (e) {
    console.log(response);
    console.error(e);
  }
  // console.log(JSON.stringify(response, null, 2));
  return { MessageCount: response.Messages?.length ?? 0, ...response };
}
