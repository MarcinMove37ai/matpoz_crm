'use client';

import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Logo"
            width={200}
            height={48}
            priority
            className="h-12 w-auto"
          />
        </div>
      </div>

      <div className="mt-8 mx-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-xl">
          {children}
        </div>
      </div>
    </div>
  )
}