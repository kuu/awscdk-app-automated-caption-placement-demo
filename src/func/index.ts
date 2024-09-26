import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as VTT from 'node-webvtt';

const client = new S3Client({
  region: process.env.REGION,
});

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME as string;

//import {readFileSync, writeFileSync} from 'fs';
//import {join} from 'path';

interface Coordinates {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  d?: string;
}

export async function handler(event: any) {
  // Get the results of the Transcribe and Rekognition jobs
  const { input, output } = event;

  // Get the video file name
  const videoFileName = input?.videoS3Object?.Name;
  if (!videoFileName) {
    throw new Error('The videoFileName is not specified');
  }

  // Get the video size
  const videoMetadata = input?.videoMetadata;
  if (!videoMetadata?.FrameHeight) {
    throw new Error('videoMetadata is not defined');
  }

  // Get the caption file name
  const captionFileName = output?.captionUrl?.split('/').pop();
  if (!captionFileName) {
    throw new Error('The captionFileName is not specified');
  }

  // Get the face detection file name
  const faceDetectionFileName = output?.faceDetectionS3Object?.Name;
  if (!faceDetectionFileName) {
    throw new Error('The faceDetectionFileName is not specified');
  }

  // Get the text detection file name
  const textDetectionFileName = output?.textDetectionS3Object?.Name;
  if (!textDetectionFileName) {
    throw new Error('The textDetectionFileName is not specified');
  }

  // Video area
  const SCREEN_COORDINATES: Coordinates = {
    x: 0,
    y: 0,
    w: videoMetadata.FrameWidth,
    h: videoMetadata.FrameHeight,
  };

  // Subtitle area
  const MAIN_OBJECT_COORDINATES: Coordinates = {
    x: SCREEN_COORDINATES.w * 0.1,
    y: SCREEN_COORDINATES.h * 0.8,
    w: SCREEN_COORDINATES.w * 0.75,
    h: SCREEN_COORDINATES.h * 0.2,
  };

  // Download WebVTT file
  const caption = await client.send(new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: captionFileName,
  }));
  if (!caption || !caption?.Body) {
    console.error('The subtitle file is not found');
    return;
  }
  const captionStr = await caption.Body?.transformToString();
  //const captionStr = readFileSync(join(__dirname, '../../fixture/2024-Best-Actress_2.vtt')).toString();

  // Download Face Detection file
  const faces = await client.send(new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: faceDetectionFileName,
  }));
  if (!faces || !faces?.Body) {
    console.error('The faces file is not found');
    return;
  }
  const facesStr = await faces.Body?.transformToString();
  if (!facesStr) {
    console.error('The faces file is empty');
    return;
  }
  //const facesStr = readFileSync(join(__dirname, '../../fixture/2024-Best-Actress_2.mp4.faces.json')).toString();

  // Download Text Detection file
  const texts = await client.send(new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: textDetectionFileName,
  }));
  if (!texts || !texts?.Body) {
    console.error('The faces file is not found');
    return;
  }
  const textsStr = await texts.Body?.transformToString();
  if (!textsStr) {
    console.error('The texts file is empty');
    return;
  }
  //const textsStr = readFileSync(join(__dirname, '../../fixture/2024-Best-Actress_2.mp4.text.json')).toString();

  // Parse the files and add styles to the WevVTT file
  const vtt = VTT.parse(captionStr, { strict: false });
  const facesArray:{Timestamp: number; Face: {BoundingBox: {Left: number; Top: number; Width: number; Height: number}}}[]
    = JSON.parse(facesStr as string);
  const faceCoordinates = facesArray.map(
    (
      {
        Timestamp,
        Face: {
          BoundingBox: {
            Left: x,
            Top: y,
            Width: w,
            Height: h,
          },
        },
      },
    ) => (
      {
        t: Timestamp / 1000,
        pos: {
          x: x * SCREEN_COORDINATES.w,
          y: y * SCREEN_COORDINATES.h,
          w: w * SCREEN_COORDINATES.w,
          h: h * SCREEN_COORDINATES.h,
        },
      }
    ),
  );
  const textArray: {
    Timestamp: number;
    TextDetection: {
      Geometry: {
        BoundingBox: {
          Left: number;
          Top: number;
          Width: number;
          Height: number;
        };
      };
      DetectedText: string;
    };
  }[] = JSON.parse(textsStr!);
  const textCoordinates = textArray.map(
    (
      {
        Timestamp,
        TextDetection: {
          Geometry: {
            BoundingBox: {
              Left: x,
              Top: y,
              Width: w,
              Height: h,
            },
          },
          DetectedText,
        },
      },
    ) => (
      {
        t: Timestamp / 1000,
        pos: {
          x: x * SCREEN_COORDINATES.w,
          y: y * SCREEN_COORDINATES.h,
          w: w * SCREEN_COORDINATES.w,
          h: h * SCREEN_COORDINATES.h,
          d: DetectedText,
        },
      }
    ),
  );
  for (const cue of vtt.cues) {
    const faceList = getCoexistingObjects(cue, faceCoordinates);
    const textList = getCoexistingObjects(cue, textCoordinates);
    cue.styles = shiftLeftOrRight(cue.text, faceList, textList, SCREEN_COORDINATES, MAIN_OBJECT_COORDINATES);
  }
  const styledVtt = VTT.compile(vtt);
  //writeFileSync(join(__dirname, '../../fixture/2024-Best-Actress_2.styled.vtt'), styledVtt);
  const outputFileName = `${captionFileName.replace('.vtt', '.styled.vtt')}`;
  await client.send(new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: outputFileName,
    Body: styledVtt,
  }));
  console.log(`Updates WebVTT file is saved to s3://${S3_BUCKET_NAME}/${outputFileName}`);
  return {
    video: videoFileName,
    originalCaption: captionFileName,
    styledCaption: outputFileName,
  };
}

const MARGIN = 0.075;

function getCoexistingObjects(cue: {start: number; end: number}, objects: {t: number; pos: Coordinates}[]): Coordinates[] {
  const results: Coordinates[] = [];
  for (const { t, pos } of objects) {
    const lower = t - MARGIN;
    const upper = t + MARGIN;
    if (upper > cue.start && lower < cue.end) {
      results.push(pos);
    }
  }
  return results;
}

const SHIFT_LEFT = 'position:50% align:end';
const REMAIN_CENTER = '';
const SHIFT_RIGHT = 'position:50% align:start';

// Figure out which direction to move so you can avoid the main object to be obstructed by other objects
function shiftLeftOrRight(text: string, faceList: Coordinates[], textList: Coordinates[], screen: Coordinates, mainObject: Coordinates): string {
  let leftMost = screen.w;
  let rightMost = 0;
  const minWidth = screen.w * 0.1;
  //console.log('--- shiftLeftOrRight ---');
  //console.log(`\ttext: ${text}`);
  for (const { x, y, w, h } of faceList) {
    if (w < minWidth || y + h < mainObject.y) {
      continue;
    }
    //console.log(`\tfaceList: ${x}, ${y}, ${w}, ${h}`);
    leftMost = Math.min(leftMost, x);
    rightMost = Math.max(rightMost, x + w);
  }
  for (const { x, y, w, h, d } of textList) {
    if (w < minWidth || y + h < mainObject.y) {
      continue;
    }
    //console.log(`\ttextList: ${x}, ${y}, ${w}, ${h}, ${d}`);
    leftMost = Math.min(leftMost, x);
    rightMost = Math.max(rightMost, x + w);
  }
  //console.log(`\tleftMost: ${leftMost}, rightMost: ${rightMost}`);
  if (leftMost === screen.w && rightMost === 0) {
    //console.log('REMAIN_CENTER');
    return REMAIN_CENTER;
  }
  if (leftMost < (screen.w - rightMost)) {
    //console.log('SHIFT_RIGHT');
    return SHIFT_RIGHT;
  }
  //console.log('SHIFT_LEFT');
  return SHIFT_LEFT;
}
