// src/lib/authConfig.ts
type AuthConfig = {
  Cognito: {
    userPoolId: string;
    userPoolClientId: string;
    loginWith: {
      username: boolean;
      email: boolean;
    };
  };
};

export const authConfig: AuthConfig | undefined =
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim() &&
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID?.trim()
    ? {
        Cognito: {
          userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
          userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
          loginWith: {
            username: true,
            email: true
          }
        }
      }
    : undefined;

if (!authConfig) {
  console.warn("⚠️ Brakuje wartości w authConfig.ts!");
} else {
  console.log("✅ authConfig załadowane poprawnie");
}