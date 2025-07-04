'use client';

import { Amplify } from 'aws-amplify';
import { ReactNode, useEffect } from 'react';

const AuthProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

    if (!userPoolId || !clientId) {
      console.error('Missing Cognito configuration');
      return;
    }

    try {
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId,
            userPoolClientId: clientId,
            signUpVerificationMethod: 'code',
            loginWith: {
              username: true,
              email: false,
              phone: false
            }
          }
        }
      }, { ssr: true });

      console.log('Amplify configured successfully');
    } catch (error) {
      console.error('Amplify configuration error:', error);
    }
  }, []);

  return <>{children}</>;
};

export default AuthProvider;