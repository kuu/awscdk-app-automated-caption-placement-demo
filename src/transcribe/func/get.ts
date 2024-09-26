import { TranscribeClient, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';

const client = new TranscribeClient({
  region: process.env.REGION,
});

export async function handler(event: any) {
  console.log(`Event: ${JSON.stringify(event)}`);
  const jobName = event.jobName;

  if (!jobName) {
    throw new Error('The TranscriptionJobName is not specified');
  }

  const command = new GetTranscriptionJobCommand({
    TranscriptionJobName: jobName,
  });
  const response = await client.send(command);
  console.log(JSON.stringify(response, null, 2));

  const status = response.TranscriptionJob?.TranscriptionJobStatus;
  if (status !== 'COMPLETED') {
    return { jobName, status };
  }

  const input = {
    videoUrl: response.TranscriptionJob?.Media?.MediaFileUri,
    sampleRate: response.TranscriptionJob?.MediaSampleRateHertz,
  };

  const output = {
    subtitleUrl: response.TranscriptionJob?.Subtitles?.SubtitleFileUris?.[0],
    transcriptUrl: response.TranscriptionJob?.Transcript?.TranscriptFileUri,
  };
  return { status, input, output };
}
