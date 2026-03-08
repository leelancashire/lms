import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "./env";

const hasFirebaseEnv =
  Boolean(env.FIREBASE_PROJECT_ID) && Boolean(env.FIREBASE_PRIVATE_KEY) && Boolean(env.FIREBASE_CLIENT_EMAIL);

let warnedMissing = false;

export function isFirebaseConfigured() {
  return hasFirebaseEnv;
}

function buildFirebaseApp() {
  if (!hasFirebaseEnv) {
    if (!warnedMissing) {
      console.warn(
        "Firebase credentials are not set. Push notifications will be logged to console instead of sent."
      );
      warnedMissing = true;
    }
    return null;
  }

  if (getApps().length > 0) {
    return getApps()[0];
  }

  try {
    const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    return initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        privateKey,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  } catch (error) {
    console.warn("Firebase init failed. Falling back to console notification logs.", error);
    return null;
  }
}

const firebaseApp = buildFirebaseApp();

export const messaging = firebaseApp ? getMessaging(firebaseApp) : null;
