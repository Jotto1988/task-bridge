# Wiring the API-key system into your existing repo

## 1. New files (just add these, no conflicts)
Copy into your repo at the matching paths:
- src/lib/apiKey.ts
- src/services/apiKeys.ts
- src/api/publicApi.ts
- src/api/apiKeys.ts

## 2. src/services/hitlRequests.ts — add one function
Add this to the end of the file (it's a new export, doesn't touch anything existing):

```ts
/** Get a single request by ID — used by the org-facing API to let a company check status on something it submitted. */
export async function getRequestById(requestId: string): Promise<HitlRequest | null> {
  const snap = await collections.requests.doc(requestId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<HitlRequest, "id">) };
}
```

## 3. src/types/index.ts — append this block at the end of the file
```ts
export type ApiKeyStatus = "active" | "revoked";

export interface ApiKey {
  id: string;
  orgId: string;
  label: string;
  prefix: string;
  hashedKey: string;
  status: ApiKeyStatus;
  createdBy: string;
  createdAt: Timestamp;
  lastUsedAt?: Timestamp;
  revokedAt?: Timestamp;
  revokedBy?: string;
}
```

## 4. src/lib/firestore.ts — add one line inside the `collections` object
```ts
apiKeys: db.collection("apiKeys"),
```

## 5. src/index.ts — add these two export lines
```ts
export { apiSubmitRequest, apiGetRequest } from "./api/publicApi";
export { createApiKey, listApiKeys, revokeApiKey } from "./api/apiKeys";
```

## 6. firestore.rules — add this match block inside `match /databases/{database}/documents { ... }`
```
match /apiKeys/{keyId} {
  allow read: if false;
  allow write: if false;
}
```

## 7. Deploy
```
npm run build
firebase deploy --only functions,firestore:rules
```

Your REST base URL for the SDK/company integrations will be something like:
`https://REGION-YOURPROJECT.cloudfunctions.net`
