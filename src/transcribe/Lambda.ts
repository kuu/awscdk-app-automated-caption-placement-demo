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
  readonly outputBucket: IBucket; // S3 bucket to write the output files
}

export class Lambda extends Construct {
  public readonly startFunc: NodejsFunction;
  public readonly getFunc: NodejsFunction;

  constructor(scope: Construct, id: string, {
    inputBucket,
    outputBucket,
  }: LambdaProps) {
    super(scope, id);

    const TS_START_ENTRY = path.resolve(__dirname, 'func', 'start.ts');
    const JS_START_ENTRY = path.resolve(__dirname, 'func', 'start.js');
    const TS_GET_ENTRY = path.resolve(__dirname, 'func', 'get.ts');
    const JS_GET_ENTRY = path.resolve(__dirname, 'func', 'get.js');

    //Create an IAM Role that gives Amazon Transcribe S3 access permissions
    const role = new Role(this, 'IamRoleForTranscribe', {
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ],
      assumedBy: new ServicePrincipal('transcribe.amazonaws.com'),
    });
    const roleArn = role.roleArn;

    this.startFunc = new NodejsFunction(scope, `StartTranscribeFunction${id}`, {
      runtime: Runtime.NODEJS_18_X,
      entry: fs.existsSync(TS_START_ENTRY) ? TS_START_ENTRY : JS_START_ENTRY,
      handler: 'handler',
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: process.env.NODE_ENV as string,
        REGION: process.env.CDK_DEFAULT_REGION as string,
        INPUT_BUCKET_NAME: inputBucket.bucketName,
        OUTPUT_BUCKET_NAME: outputBucket.bucketName,
        ROLE_ARN: roleArn,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });
    this.startFunc.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'transcribe:*',
        Resource: '*',
      }),
    );
    // Add a statement to pass the IAM role to Transcribe
    this.startFunc.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'iam:PassRole',
        Resource: roleArn,
      }),
    );

    this.getFunc = new NodejsFunction(scope, `GetTranscribeFunction${id}`, {
      runtime: Runtime.NODEJS_18_X,
      entry: fs.existsSync(TS_GET_ENTRY) ? TS_GET_ENTRY : JS_GET_ENTRY,
      handler: 'handler',
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: process.env.NODE_ENV as string,
        REGION: process.env.CDK_DEFAULT_REGION as string,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });
    this.getFunc.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'transcribe:*',
        Resource: '*',
      }),
    );
  }
}