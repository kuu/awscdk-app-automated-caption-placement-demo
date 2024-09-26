import { RekognitionClient, GetFaceDetectionCommand } from '@aws-sdk/client-rekognition';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const client = new RekognitionClient({
  region: process.env.REGION,
});

const s3Client = new S3Client({
  region: process.env.REGION,
  endpoint: `https://s3.${process.env.REGION}.amazonaws.com`,
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

  const command = new GetFaceDetectionCommand({
    JobId: message.JobId,
  });

  const response = await client.send(command);

  if (!response || !response?.Faces) {
    console.error('Faces are not defined');
    return {};
  }

  const faces = response.Faces;
  const input = {
    s3Object: response.Video?.S3Object,
    videoMetadata: response.VideoMetadata,
  };

  const outputFileName = `${message.Video.S3ObjectName}.faces.json`;
  const output = {
    s3Object: {
      Bucket: OUTPUT_BUCKET_NAME,
      Name: outputFileName,
    },
  };

  const s3Response = await s3Client.send(new PutObjectCommand({
    Bucket: OUTPUT_BUCKET_NAME,
    Key: outputFileName,
    Body: JSON.stringify(faces, null, 2),
  }));

  console.log(`Faces are saved to s3://${OUTPUT_BUCKET_NAME}/${outputFileName}`);

  return { input, output };
}
