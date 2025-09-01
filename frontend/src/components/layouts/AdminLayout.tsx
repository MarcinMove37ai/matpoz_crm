"use client"

import Image from 'next/image';
import React, { useState, ReactNode, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, ClipboardList, PiggyBank, TrendingUp, Map, Settings, Menu, X, Power, UserSearch, BarChart4, Flame, Ship, ChartNoAxesCombined, ChartPie, ChartBarStacked, Building } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentDate } from '@/hooks/useCurrentDate';
import Cookies from 'js-cookie';

// Import zminimalizowanego mechanizmu anulowania zapytań
import { useEnhancedRequestCancellation } from '@/utils/enhancedFetchInterceptor';

type UserRole = 'BOARD' | 'BRANCH' | 'REPRESENTATIVE' | 'ADMIN' | 'STAFF' | 'BASIA';
const userRoleDisplay = {
  'BOARD': '- ZARZĄD',
  'BRANCH': '- ODDZIAŁ',
  'REPRESENTATIVE': '- PH',
  'ADMIN': '- ADMIN',
  'STAFF': '- PRACOWNIK'
} as const;

interface MenuItem {
  IconComponent: LucideIcon;
  label: string;
  path: string;
  roles: UserRole[];
}

const menuItems: MenuItem[] = [
  {
    IconComponent: Building,
    label: 'Firma',
    path: '/company',
    roles: ['ADMIN']
  },
  {
    IconComponent: ChartNoAxesCombined,
    label: 'Strona główna',
    path: '/dashboard',
    roles: ['BOARD', 'ADMIN']
  },
  {
    IconComponent: Flame,
    label: 'Sprzedaż',
    path: '/sales',
    roles: ['BOARD', 'BRANCH', 'ADMIN']
  },
  {
    IconComponent: ChartBarStacked,
    label: 'Oddział vs. PH',
    path: '/salesph',
    roles: ['BOARD', 'BRANCH', 'ADMIN']
  },
  {
    IconComponent: UserSearch,
    label: 'Sprzedaż PH',
    path: '/salesphind',
    roles: ['BOARD', 'BRANCH', 'REPRESENTATIVE', 'ADMIN']
  },
  {
    IconComponent: ClipboardList,
    label: 'Lista kosztów',
    path: '/costs',
    roles: ['BOARD', 'BRANCH', 'REPRESENTATIVE', 'ADMIN', 'STAFF', 'BASIA']
  },
  {
    IconComponent: ChartPie,
    label: 'Podział kosztów',
    path: '/costs-summary',
    roles: ['BOARD', 'BRANCH', 'ADMIN']
  },
  {
    IconComponent: TrendingUp,
    label: 'Zyski (Firma)',
    path: '/profits',
    roles: ['BOARD', 'ADMIN']
  },
  {
    IconComponent: TrendingUp,
    label: 'Zyski (Oddział)',
    path: '/profits-branch',
    roles: ['BOARD', 'ADMIN']
  },
  {
    IconComponent: TrendingUp,
    label: 'Zyski (PH)',
    path: '/profits-ph',
    roles: ['BOARD', 'REPRESENTATIVE', 'ADMIN']
  },
  {
    IconComponent: Map,
    label: 'Mapa klientów',
    path: '/map',
    roles: ['BOARD', 'BRANCH', 'REPRESENTATIVE', 'ADMIN']
  },
    {
    IconComponent: Ship,
    label: 'Salpa Expeditions',
    path: '/salpa',
    roles: ['BOARD', 'ADMIN']
  },
  {
    IconComponent: Settings,
    label: 'Ustawienia',
    path: '/settings',
    roles: ['BOARD', 'ADMIN']
  }
];

const getCurrentPageLabel = (path: string | null) => {
  if (!path) return 'Strona główna';
  const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
  const menuItem = menuItems.find(item => normalizedPath === item.path);
  return menuItem?.label || 'Strona główna';
};

interface AdminLayoutProps {
  children: ReactNode;
}

// Główny komponent AdminLayout
const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, loading, user, userRole: authUserRole, userBranch: authUserBranch, userFullName: authUserFullName } = useAuth();
  const [hoveredSidebar, setHoveredSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { formatDate, loading: dateLoading } = useCurrentDate();
  const [mounted, setMounted] = useState(false);
  const normalizedPathname = pathname?.endsWith('/') ? pathname.slice(0, -1) : pathname;

  // Używamy udoskonalonego mechanizmu anulowania zapytań - bez wskaźników i monitorowania
  useEnhancedRequestCancellation({
    debug: process.env.NODE_ENV === 'development'
  });

  // Ref do śledzenia poprzedniej ścieżki
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filtrujemy elementy menu na podstawie roli z kontekstu auth
  const userRoleFromAuth = (authUserRole || user?.['custom:role'] || 'BOARD') as UserRole;
  const filteredMenuItems = menuItems.filter(item =>
    item.roles.includes(userRoleFromAuth)
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileMenuOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    await signOut();
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <div
        className={`fixed left-0 z-50 top-[calc(4rem)] h-[calc(90vh)]
          ${isMobile
            ? isMobileMenuOpen
              ? 'translate-x-0 w-64 bg-white/60 backdrop-blur-lg backdrop-saturate-150 shadow-xl rounded-r-3xl'
              : '-translate-x-full'
            : `bg-white shadow-lg rounded-r-2xl ${hoveredSidebar ? 'w-64' : 'w-20'}`
          }
          transition-all duration-300 ease-in-out overflow-y-auto`}
        onMouseEnter={() => !isMobile && setHoveredSidebar(true)}
        onMouseLeave={() => !isMobile && setHoveredSidebar(false)}
      >
        <nav className="py-4">
          <ul className="space-y-2 px-3">
            {filteredMenuItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`
                    flex items-center h-11 px-3
                    rounded-lg transition-colors
                    ${normalizedPathname === item.path ? 'bg-blue-100' : 'hover:bg-gray-50'}
                  `}
                  onClick={() => isMobile && setIsMobileMenuOpen(false)}
                >
                  <div className={`
                    flex-shrink-0 w-6 text-center
                    ${normalizedPathname === item.path ? 'text-red-600' : 'text-gray-600'}
                  `}>
                    <item.IconComponent size={24} />
                  </div>
                  <span className={`
                    ml-3 text-gray-700 whitespace-nowrap
                    transition-all duration-300
                    ${(hoveredSidebar || isMobileMenuOpen) ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'}
                  `}>
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
            {isMobile && (
              <li>
                <button
                  onClick={handleLogout}
                  className={`
                    flex items-center h-11 px-3 w-full
                    rounded-lg transition-colors hover:bg-gray-50
                  `}
                >
                  <div className="flex-shrink-0 w-6 text-center text-gray-600">
                    <Power size={24} />
                  </div>
                  <span className={`
                    ml-3 text-gray-700 whitespace-nowrap
                    transition-all duration-300
                    ${(hoveredSidebar || isMobileMenuOpen) ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'}
                  `}>
                    Wyloguj się
                  </span>
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>

      <div
        className={`transition-all duration-300 ease-in-out
          ${isMobile ? 'ml-0' : hoveredSidebar ? 'ml-64' : 'ml-20'}
          flex-1 overflow-auto mt-16`}
      >

        <header className={`fixed top-0 left-0 w-full h-16 bg-white shadow-md z-50 flex items-center justify-between ${isMobile ? 'px-4' : 'px-6'}`}>
          <div className="flex items-center">
            {isMobile && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={isMobileMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6 text-gray-600" />
                ) : (
                  <Menu className="h-6 w-6 text-gray-600" />
                )}
              </button>
            )}
            <Image
              src="/logo.png"
              alt="CRM MatPoz"
              width={200}
              height={48}
              priority
              className="h-8 md:h-12 w-auto mr-4"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                {authUserFullName || (user && user.name) || ''}
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {authUserBranch || (user && user.branch) || ''}
              </span>
            </div>
            {!isMobile && (
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Wyloguj się"
              >
                <Power className="h-5 w-5" />
              </button>
            )}
          </div>
        </header>

        <main className={`${isMobile ? 'px-0' : 'px-6'} pt-2 pb-6`}>
          <div className="flex items-center mb-2 px-0 md:px-0">
            <div className="bg-white px-4 py-1 rounded-r-lg md:rounded-lg shadow-sm">
              <h2 className="text-md font-semibold text-gray-500">
                {getCurrentPageLabel(pathname)}
              </h2>
            </div>
            {!dateLoading && (
              <div className="bg-white px-4 py-1 rounded-l-lg md:rounded-lg shadow-sm ml-auto">
                <span className="text-md font-semibold text-gray-500">
                  {formatDate(isMobile)}
                </span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 min-h-[calc(100vh-160px)]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;