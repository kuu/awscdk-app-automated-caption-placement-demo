import { awscdk } from 'projen';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'awscdk-app-automated-caption-placement-demo',
  projenrcTs: true,
  repository: 'https://github.com/kuu/awscdk-app-automated-caption-placement-demo.git',
  keywords: [
    'cdk',
    'cdk-app',
    'Amazon Transcribe',
    'Amazon Rekognition',
    'captions',
    'subtitles',
    'WebVTT',
    'AI',
  ],
  licensed: true,
  license: 'MIT',
  copyrightOwner: 'Kuu Miyazaki',

  deps: [
    '@aws-sdk/client-rekognition',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-sqs',
    '@aws-sdk/client-transcribe',
    'aws-cdk-lib',
    'constructs',
    'node-webvtt',
    'source-map-support',
  ],
  description: 'AWS CDK app for deploying the necessary resources for the automated caption positioning demo',
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();
