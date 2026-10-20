import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";

let client: S3Client | undefined;
function r2() {
  const e = env();
  return (client ??= new S3Client({
    region: "auto",
    endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
  }));
}

// Keys are always namespaced by user id; never build one from client input.
export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await r2().send(new PutObjectCommand({ Bucket: env().R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

/** Short-lived download link; callers must check ownership of `key` first. */
export async function downloadUrl(key: string, filename: string) {
  return getSignedUrl(r2(), new GetObjectCommand({
    Bucket: env().R2_BUCKET, Key: key,
    ResponseContentDisposition: `attachment; filename="${filename.replace(/[^\w.\- ]/g, "")}"`,
  }), { expiresIn: 300 });
}
