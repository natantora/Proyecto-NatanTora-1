import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function value(...names: string[]): string {
  for (const name of names) if (process.env[name]) return process.env[name]!;
  throw new Error(`Falta variable de almacenamiento: ${names[0]}`);
}

export function bucketName() { return value("BUCKET_NAME", "BUCKET"); }

export function storageClient() {
  return new S3Client({
    region: process.env.BUCKET_REGION ?? process.env.REGION ?? "auto",
    endpoint: value("BUCKET_ENDPOINT", "ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: value("BUCKET_ACCESS_KEY_ID", "ACCESS_KEY_ID"),
      secretAccessKey: value("BUCKET_SECRET_ACCESS_KEY", "SECRET_ACCESS_KEY"),
    },
  });
}

export function mediaUrl(key: string): string {
  return `/api/media?key=${encodeURIComponent(key)}`;
}

export async function storageReady(): Promise<boolean> {
  try {
    await storageClient().send(new HeadBucketCommand({ Bucket: bucketName() }));
    return true;
  } catch { return false; }
}

export async function putObject(key: string, body: Buffer | string, contentType: string) {
  await storageClient().send(new PutObjectCommand({
    Bucket: bucketName(), Key: key, Body: body, ContentType: contentType,
  }));
}

export async function deleteObjects(keys: string[]) {
  await storageClient().send(new DeleteObjectsCommand({
    Bucket: bucketName(), Delete: { Objects: keys.map((Key) => ({ Key })) },
  }));
}

export async function listObjects(prefix: string) {
  const result = await storageClient().send(new ListObjectsV2Command({
    Bucket: bucketName(), Prefix: prefix, MaxKeys: 1000,
  }));
  return result.Contents ?? [];
}

export async function getObjectText(key: string): Promise<string | null> {
  try {
    const result = await storageClient().send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
    return (await result.Body?.transformToString()) ?? null;
  } catch { return null; }
}

export async function signedUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: contentType });
  return getSignedUrl(storageClient(), command, { expiresIn: 15 * 60 });
}
