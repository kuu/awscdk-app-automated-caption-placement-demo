import * as fs from 'fs';
import * as path from 'path';
import { Duration, aws_logs as logs } from 'aws-cdk-lib';
import { Role, PolicyStatement, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface LambdaProps {
  readonly inputBucket: IBucket; // S3 bucket that stores the video file
  readonly outputBucket: IBucket; // S3 Object Key for the video
  readonly topicArn: string; // The Amazon SNS topic ARN to which Amazon Rekognition posts the completion status
  readonly sqsQueueUrl: string; // The URL of the SQS queue that subscribe to the SNS topic
}

export class Lambda extends Construct {
  public readonly startFunc: NodejsFunction;
  public readonly pollFunc: NodejsFunction;
  public readonly getFunc: NodejsFunction;

  constructor(scope: Construct, id: string, {
    inputBucket,
    outputBucket,
    topicArn,
    sqsQueueUrl,
  }: LambdaProps) {
    super(scope, id);

    const TS_START_ENTRY = path.resolve(__dirname, 'func', 'start.ts');
    const JS_START_ENTRY = path.resolve(__dirname, 'func', 'start.js');
    const TS_POLL_ENTRY = path.resolve(__dirname, 'func', 'poll.ts');
    const JS_POLL_ENTRY = path.resolve(__dirname, 'func', 'poll.js');
    const TS_GET_ENTRY = path.resolve(__dirname, 'func', 'get.ts');
    const JS_GET_ENTRY = path.resolve(__dirname, 'func', 'get.js');

    //Create an IAM Role that gives Amazon Rekognition publishing permissions to the Amazon SNS topic
    const role = new Role(this, 'IamRoleForRekognition', {
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSNSFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess'),
        ManagedPolicy.fromManagedPolicyArn(this, 'AmazonRekognitionServiceRole', 'arn:aws:iam::aws:policy/service-role/AmazonRekognitionServiceRole'),
      ],
      assumedBy: new ServicePrincipal('rekognition.amazonaws.com'),
    });
    const roleArn = role.roleArn;

    // Create Lambda functions for face detection
    this.startFunc = new NodejsFunction(scope, `StartFaceRekognitionFunction${id}`, {
      runtime: Runtime.NODEJS_18_X,
      entry: fs.existsSync(TS_START_ENTRY) ? TS_START_ENTRY : JS_START_ENTRY,
      handler: 'handler',
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: process.env.NODE_ENV as string,
        REGION: process.env.CDK_DEFAULT_REGION as string,
        INPUT_BUCKET_NAME: inputBucket.bucketName,
        SNS_TOPIC_ARN_TO_BE_NOTIFIED_OF_COMPLETION: topicArn,
        ROLE_ARN_TO_ALLOW_REKOGNITION_TO_PUBLISH_TO_SNS_TOPIC: roleArn,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });
    this.startFunc.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 's3:*',
        Resource: '*',
      }),
    );
    this.startFunc.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'rekognition:*',
        Resource: '*',
      }),
    );
    // Add a statement to pass the IAM role to Rekognition
    this.startFunc.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'iam:PassRole',
        Resource: roleArn,
      }),
    );

    this.pollFunc = new NodejsFunction(scope, `PollFaceRekognitionFunction${id}`, {
      runtime: Runtime.NODEJS_18_X,
      entry: fs.existsSync(TS_POLL_ENTRY) ? TS_POLL_ENTRY : JS_POLL_ENTRY,
      handler: 'handler',
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: process.env.NODE_ENV as string,
        REGION: process.env.CDK_DEFAULT_REGION as string,
        SQS_QUEUE_URL: sqsQueueUrl,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });
    this.pollFunc.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'sqs:*',
        Resource: '*',
      }),
    );

    this.getFunc = new NodejsFunction(scope, `GetFaceRekognitionFunction${id}`, {
      runtime: Runtime.NODEJS_18_X,
      entry: fs.existsSync(TS_GET_ENTRY) ? TS_GET_ENTRY : JS_GET_ENTRY,
      handler: 'handler',
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: process.env.NODE_ENV as string,
        REGION: process.env.CDK_DEFAULT_REGION as string,
        OUTPUT_BUCKET_NAME: outputBucket.bucketName,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });
    this.getFunc.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'rekognition:*',
        Resource: '*',
      }),
    );
    this.getFunc.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 's3:*',
        Resource: '*',
      }),
    );
  }
}