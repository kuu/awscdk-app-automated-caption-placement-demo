import { Duration } from 'aws-cdk-lib';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Pass, Wait, WaitTime, Chain, Choice, Condition, IChainable } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { Lambda } from './Lambda';

export interface FaceDetectionJobProps {
  readonly inputBucket: IBucket; // S3 bucket that stores the video file
  readonly outputBucket: IBucket; // S3 bucket that stores the output files
}

export class FaceDetectionJob extends Construct {
  public readonly job: IChainable;

  constructor(scope: Construct, id: string, {
    inputBucket,
    outputBucket,
  }: FaceDetectionJobProps) {
    super(scope, id);

    // Create SNS topic
    const faceDetectionComplete = new Topic(this, 'AmazonRekognitionFaceDetectionComplete', {
      topicName: 'AmazonRekognitionFaceDetectionComplete',
    });

    // Create SQS queue
    const queue = new Queue(this, 'FaceDetectionQueue', {
      visibilityTimeout: Duration.seconds(300),
    });

    // Subscribe to the SNS topic
    faceDetectionComplete.addSubscription(new SqsSubscription(queue));

    // Create Lambda function to call Amazon Rekognition API
    const rekognitionLambda = new Lambda(this, 'FaceDetectionLambda', {
      inputBucket,
      outputBucket,
      topicArn: faceDetectionComplete.topicArn,
      sqsQueueUrl: queue.queueUrl,
    });

    // Start face detection
    const rekognitionStart = new LambdaInvoke(this, 'Invoke StartFaceDetection API', {
      lambdaFunction: rekognitionLambda.startFunc,
      inputPath: '$.Payload',
    });

    // Monitor SQS queue
    const monitorQueue = new LambdaInvoke(this, 'Monitor SQS for Face', {
      lambdaFunction: rekognitionLambda.pollFunc,
      inputPath: '$.Payload',
    });

    // Get face detection results
    const rekognitionGet = new LambdaInvoke(this, 'Invoke GetFaceDetection API', {
      lambdaFunction: rekognitionLambda.getFunc,
      inputPath: '$.Payload',
    });

    // Sleep for 5 seconds
    const rekognitionWait = new Wait(this, 'Wait for Face Detection', {
      time: WaitTime.duration(Duration.seconds(5)),
    });

    this.job = Chain.start(
      new Pass(this, 'Start Face Detection Job', { inputPath: '$', resultPath: '$.Payload' }),
    )
      .next(rekognitionStart)
      .next(rekognitionWait)
      .next(monitorQueue)
      .next(
        new Choice(this, 'Check if Face Detection is completed')
          .when(Condition.numberGreaterThan('$.Payload.MessageCount', 0), rekognitionGet)
          .otherwise(rekognitionWait),
      );
  }
}