import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
// In-memory only OAuth access token (never stored in localStorage/sessionStorage or Google Sheets)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure(user);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure(null);
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
  idToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Không lấy được quyền truy cập Google Drive & Sheets. Vui lòng thử đăng nhập lại.'
      );
    }
    const idToken = await result.user.getIdToken(true);
    cachedAccessToken = credential.accessToken;
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      idToken,
    };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getFreshIdToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

export const clearAccessToken = () => {
  cachedAccessToken = null;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
