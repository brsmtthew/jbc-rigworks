# Firebase user and company admin accounts

The app has two roles: **user** and **admin**. Public signup creates user accounts. The only admin is the Firebase Authentication account for `jbcrigworks@gmail.com`, with its exact UID recorded in `config/adminAccount`. The app and Firestore rules require the company email to be verified and the UID to match that document before granting admin access. No role field in a user profile can grant admin access.

Firebase Authentication stores passwords. After a user verifies their email and refreshes the app or signs in again, the app creates `users/{uid}` in Firestore with their name, sign-in email, and creation time. The admin can view verified profiles in **Users**.

## Manual Firebase setup

1. Enable **Email/Password** in Firebase Authentication and create the Cloud Firestore database in the same project used by `.env.local` (`jbc-rigworks` in this workspace).
2. In **Firestore Database → Rules**, review the existing rules, merge any existing collection rules into [`firestore.rules`](firestore.rules), and publish the merged file. Publishing replaces the project's current rules. The supplied file denies access to other Firestore collections until rules for them are added.
3. In **Authentication → Users**, create exactly one email/password account using `jbcrigworks@gmail.com`. Keep its password with the business; it should not be added to this repository or Firestore.
4. Copy that account's Firebase UID. In **Firestore Database → Data**, create collection `config`, document `adminAccount`, with one field: `uid` of type **string**, set to the exact UID. Client apps cannot create or edit this document under the supplied rules.
5. Sign in through the app with the company account. Use **Send verification email** if needed, verify the link from the company inbox, then click **I verified my email** or sign in again. The account will enter the admin workspace after its verified email and UID both match.
6. Everyone else uses **Create account** on the sign-in page. They receive the user role and appear in the admin's **Users** directory after verifying their email.

The earlier `config/ownerAdmins` roster and Firebase `admin` custom claims are no longer used by this app. Existing copies can be left in Firebase while you complete the switch, but they grant no access through this code.

## Current business data

User profiles and the admin UID are in Firestore. Jobs, inventory, sales, requests, and shop settings still use browser storage, so separate devices do not share those records yet.
