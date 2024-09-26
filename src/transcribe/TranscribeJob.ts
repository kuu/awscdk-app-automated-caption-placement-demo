import { Duration } from 'aws-cdk-lib';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Pass, Wait, WaitTime, Chain, Choice, Condition, IChainable, Succeed, Fail } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { Lambda } from './Lambda';

export interface TranscribeJobProps {
  readonly inputBucket: IBucket; // S3 bucket that stores the video file
  readonly outputBucket: IBucket; // S3 bucket that stores the output files
}

export class TranscribeJob extends Construct {
  public readonly job: IChainable;

  constructor(scope: Construct, id: string, {
    inputBucket,
    outputBucket,
  }: TranscribeJobProps) {
    super(scope, id);

    // Create Lambda function to call Amazon Transcribe API
    const transcribeLambda = new Lambda(this, 'TranscribeLambda', {
      inputBucket,
      outputBucket,
    });

    const transcribeStart = new LambdaInvoke(this, 'Invoke StartTranscriptionJob API', {
      lambdaFunction: transcribeLambda.startFunc,
      inputPath: '$.Payload',
    });

    const transcribeGet = new LambdaInvoke(this, 'Invoke GetTranscriptionJob API', {
      lambdaFunction: transcribeLambda.getFunc,
      inputPath: '$.Payload',
    });

    const transcribeWait = new Wait(this, 'Wait for Transcribe', {
      time: WaitTime.duration(Duration.seconds(5)),
    });

    this.job = Chain.start(
      new Pass(this, 'Start Transcribe Job', { inputPath: '$', resultPath: '$.Payload' }),
    )
      .next(transcribeStart)
      .next(transcribeWait)
      .next(transcribeGet)
      .next(
        new Choice(this, 'Check if Transcribe is completed')
          .when(Condition.stringEquals('$.Payload.status', 'COMPLETED'), new Succeed(this, 'Transcribe Succeeded'))
          .when(Condition.stringEquals('$.Payload.status', 'FAILED'), new Fail(this, 'Transcribe Failed'))
          .otherwise(transcribeWait),
      );
  }
}