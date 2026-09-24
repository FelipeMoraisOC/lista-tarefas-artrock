// ── Firebase Authentication — helpers para login/logout ───

import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export const onAuthChange = cb => onAuthStateChanged(auth, cb);

export const getFirebaseUser = () => auth.currentUser;

export const resetPassword = email => sendPasswordResetEmail(auth, email);
