"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar';
import Navbar from '@/components/Navbar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is logged in and is admin
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!userData || !token) {
      router.push('/login');
      return;
    }

    try {
      const user = JSON.parse(userData);
      const adminRoles = ['superadmin', 'admin', 'admin_pembelajaran'];
      if (!adminRoles.includes(user.role)) {
        // User is not admin, redirect to user dashboard
        router.push('/user');
        return;
      }

      // Restrict specific pages for admin_pembelajaran
      const isAdminPembelajaran = user.role === 'admin_pembelajaran';
      if (isAdminPembelajaran) {
        const p = pathname || '';
        const restrictedPrefixes = [
          '/admin/upload-data',
          '/admin/upload-ptp-data',
          '/admin/upload-ikt-data',
          '/admin/upload-tcu-data',
          '/admin/upload-bopo-spmt',
          '/admin/upload-bopo-ptp',
          '/admin/upload-bopo-ikt',
          '/admin/upload-bopo-tcu',
          '/admin/struktur-organisasi',
          '/admin/ptp-struktur-organisasi',
          '/admin/ikt-struktur-organisasi',
          '/admin/tcu-struktur-organisasi',
          '/admin/storage',
        ];
        if (restrictedPrefixes.some((pref) => p.startsWith(pref))) {
          router.push('/admin');
          return;
        }
      }

      setIsAuthorized(true);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  }, [router, pathname]);

  useEffect(() => {
    // Trigger a small fade-in on route change
    setFadeIn(false);
    const id = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memverifikasi akses...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <Navbar />
      
      {/* Main Content */}
      <div className="flex">
        {/* Sidebar */}
        <AdminSidebar />
        
        {/* Content Area */}
        <div key={pathname} className={`flex-1 p-6 transition-opacity duration-200 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
