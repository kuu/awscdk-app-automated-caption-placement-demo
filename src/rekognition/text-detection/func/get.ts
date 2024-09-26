import { RekognitionClient, GetTextDetectionCommand } from '@aws-sdk/client-rekognition';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const client = new RekognitionClient({
  region: process.env.REGION,
});

const s3Client = new S3Client({
  region: process.env.REGION,
});

const OUTPUT_BUCKET_NAME = process.env.OUTPUT_BUCKET_NAME as string;

export async function handler(event: any) {
  console.log(`Event: ${JSON.stringify(event)}`);
  const messages = event.Messages;

  if (!messages || messages.length === 0 || !messages[0].Body) {
    console.error('Empty message');
    return {};
  }

  const bodyText = messages[0].Body;

  console.log(`Message body: ${bodyText}`);

  try {
    JSON.parse(bodyText);
  } catch (e) {
    console.error('Invalid message body');
    return {};
  }

  const data = JSON.parse(bodyText);

  if (!data || !data?.Message) {
    console.error('Message is not defined');
    return {};
  }

  const messageText = data.Message;

  try {
    JSON.parse(messageText);
  } catch (e) {
    console.error('Invalid message');
    return {};
  }

  const message = JSON.parse(messageText);

  if (!message || !message?.JobId) {
    console.error('JobId is not defined');
    return {};
  }

  const command = new GetTextDetectionCommand({
    JobId: message.JobId,
  });

  const response = await client.send(command);

  if (!response || !response?.TextDetections) {
    console.error('TextDetections are not defined');
    return {};
  }

  const textDetections = response.TextDetections;
  const input = {
    s3Object: response.Video?.S3Object,
    videoMetadata: response.VideoMetadata,
  };

  const outputFileName = `${message.Video.S3ObjectName}.text.json`;
  const output = {
    s3Object: {
      Bucket: OUTPUT_BUCKET_NAME,
      Name: outputFileName,
    },
  };

  await s3Client.send(new PutObjectCommand({
    Bucket: OUTPUT_BUCKET_NAME,
    Key: outputFileName,
    Body: JSON.stringify(textDetections, null, 2),
  }));

  console.log(`TextDetections are saved to s3://${OUTPUT_BUCKET_NAME}/${outputFileName}`);

  return { input, output };
}
