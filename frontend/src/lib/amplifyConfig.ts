// src/lib/amplifyConfig.ts
import { Amplify } from 'aws-amplify';

export function configureAmplify() {
  if (!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || !process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID) {
    console.warn("⚠️ Brak konfiguracji Cognito!");
    return;
  }

  try {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
          userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
          loginWith: {
            username: true,
            email: true
          }
        }
      }
    }, { ssr: true });

    console.log("✅ Amplify skonfigurowane poprawnie.");
  } catch (error) {
    console.error("🚨 Błąd konfiguracji Amplify:", error);
  }
}