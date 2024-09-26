import * as crypto from 'crypto';
import { TranscribeClient, StartTranscriptionJobCommand } from '@aws-sdk/client-transcribe';

const client = new TranscribeClient({
  region: process.env.REGION,
});

const INPUT_BUCKET_NAME = process.env.INPUT_BUCKET_NAME as string;
const OUTPUT_BUCKET_NAME = process.env.OUTPUT_BUCKET_NAME as string;
const ROLE_ARN = process.env.ROLE_ARN as string;

export async function handler(event: any) {
  const mediaFileName = event.s3Object?.key;
  if (typeof mediaFileName != 'string' || !mediaFileName.endsWith('.mp4')) {
    throw new Error(`Invalid media file name: "${mediaFileName}"`);
  }
  const jobName = `${crypto.randomUUID()}`;
  const command = new StartTranscriptionJobCommand({ // StartTranscriptionJobRequest
    TranscriptionJobName: jobName, // required
    LanguageCode: 'en-US',
    MediaSampleRateHertz: 48000,
    MediaFormat: 'mp4',
    Media: { // Media
      MediaFileUri: `s3://${INPUT_BUCKET_NAME}/${mediaFileName}`,
    },
    JobExecutionSettings: {
      AllowDeferredExecution: true,
      DataAccessRoleArn: ROLE_ARN,
    },
    OutputBucketName: OUTPUT_BUCKET_NAME,
    OutputKey: `${mediaFileName}.transcribe.json`,
    Subtitles: {
      Formats: [
        'vtt',
      ],
    },
  });
  const response = await client.send(command);
  console.log(JSON.stringify(response, null, 2));
  return { jobName };
}
