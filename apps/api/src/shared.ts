import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { Queue } from "bullmq";
export function services() {
  for (const key of [
    "FIREBASE_PROJECT_ID",
    "PRIVATE_STORAGE_BUCKET",
    "REDIS_URL",
  ])
    if (!process.env[key]) throw Error(`Missing server configuration: ${key}`);
  if (!getApps().length)
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.PRIVATE_STORAGE_BUCKET,
    });
  const r = new URL(process.env.REDIS_URL!);
  const connection = {
    host: r.hostname,
    port: Number(r.port || 6379),
    username: r.username || undefined,
    password: r.password ? decodeURIComponent(r.password) : undefined,
    tls: r.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
  return {
    db: getFirestore(),
    bucket: getStorage().bucket(),
    connection,
    queue: new Queue("paperly", { connection }),
  };
}
