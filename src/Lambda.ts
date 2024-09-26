import * as fs from 'fs';
import * as path from 'path';
import { Duration, aws_logs as logs } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface LambdaProps {
  readonly bucket: s3.IBucket; // S3 bucket that stores the caption file, face detection file, and text detection file
}

export class Lambda extends Construct {
  public readonly func: NodejsFunction;

  constructor(scope: Construct, id: string, {
    bucket,
  }: LambdaProps) {
    super(scope, id);

    const TS_ENTRY = path.resolve(__dirname, 'func', 'index.ts');
    const JS_ENTRY = path.resolve(__dirname, 'func', 'index.js');

    this.func = new NodejsFunction(scope, `VttFunction${id}`, {
      runtime: Runtime.NODEJS_18_X,
      entry: fs.existsSync(TS_ENTRY) ? TS_ENTRY : JS_ENTRY,
      handler: 'handler',
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: process.env.NODE_ENV as string,
        REGION: process.env.CDK_DEFAULT_REGION as string,
        S3_BUCKET_NAME: bucket.bucketName,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });
    this.func.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 's3:*',
        Resource: '*',
      }),
    );
  }
}