import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';

/** يحمي المسارات: يتطلب تسجيل دخول، واختيارياً أدوار محددة */
export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
