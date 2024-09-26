import * as crypto from 'crypto';
import { RekognitionClient, StartFaceDetectionCommand } from '@aws-sdk/client-rekognition';; // Amazon Rekognition for Stored Video SDK

const client = new RekognitionClient({
  region: process.env.REGION,
});

const INPUT_BUCKET_NAME = process.env.INPUT_BUCKET_NAME as string;
const SNS_TOPIC_ARN_TO_BE_NOTIFIED_OF_COMPLETION = process.env.SNS_TOPIC_ARN_TO_BE_NOTIFIED_OF_COMPLETION as string; // The ARN of Amazon SNS topic to which Amazon Rekognition posts the completion status
const ROLE_ARN_TO_ALLOW_REKOGNITION_TO_PUBLISH_TO_SNS_TOPIC = process.env.ROLE_ARN_TO_ALLOW_REKOGNITION_TO_PUBLISH_TO_SNS_TOPIC as string; // The ARN of an IAM role that gives Amazon Rekognition publishing permissions to the Amazon SNS topic

export async function handler(event: any) {
  const mediaFileName = event.s3Object?.key;
  if (typeof mediaFileName != 'string' || !mediaFileName.endsWith('.mp4')) {
    throw new Error(`Invalid media file name: "${mediaFileName}"`);
  }
  const command = new StartFaceDetectionCommand({
    ClientRequestToken: `${crypto.randomUUID()}`,
    Video: {
      S3Object: {
        Bucket: INPUT_BUCKET_NAME,
        Name: mediaFileName,
      },
    },
    NotificationChannel: {
      SNSTopicArn: SNS_TOPIC_ARN_TO_BE_NOTIFIED_OF_COMPLETION, // required
      RoleArn: ROLE_ARN_TO_ALLOW_REKOGNITION_TO_PUBLISH_TO_SNS_TOPIC, // required
    },
    FaceAttributes: 'ALL',
  });
  const response = await client.send(command);
  console.log(JSON.stringify(response, null, 2));
  return response;
}
