import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();

export const collections = {
  requests: db.collection("hitlRequests"),
  claims: db.collection("claims"),
  users: db.collection("users"),
  ratings: db.collection("ratings"),
  flags: db.collection("flags"),
  organizations: db.collection("organizations"),
  raterStats: db.collection("raterStats"), // internal only — never exposed via API
  orgMembers: db.collection("orgMembers"),
};
