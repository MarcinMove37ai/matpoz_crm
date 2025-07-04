// Funkcja do pobierania danych użytkownika z ciasteczek lub localStorage
export const getUserData = () => {
  // Pobierz dane z ciasteczek
  const getCookie = (name: string): string => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || '';
    }
    return '';
  };

  // Pobierz dane z localStorage jako backup
  const getFromStorage = () => {
    try {
      const stored = localStorage.getItem('auth_state');
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  };

  // Najpierw spróbuj z ciasteczek
  const userRole = getCookie('userRole');
  const userBranch = getCookie('userBranch');
  const userFullName = getCookie('userFullName');
  const userLongitude = getCookie('userLongitude');
  const userLatitude = getCookie('userLatitude');

  // Jeśli nie ma w ciasteczkach, użyj localStorage
  if (!userRole || !userBranch) {
    const storedData = getFromStorage();

    return {
      userRole: userRole || storedData?.userRole || '',
      userBranch: userBranch || storedData?.branch || '',
      userFullName: userFullName || storedData?.fullName || '',
      userLongitude: userLongitude ? parseFloat(userLongitude) : storedData?.longitude || null,
      userLatitude: userLatitude ? parseFloat(userLatitude) : storedData?.latitude || null
    };
  }

  return {
    userRole,
    userBranch,
    userFullName,
    userLongitude: userLongitude ? parseFloat(userLongitude) : null,
    userLatitude: userLatitude ? parseFloat(userLatitude) : null
  };
};