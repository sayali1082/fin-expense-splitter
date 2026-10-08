import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { usersApi } from '../api/users';

interface UserContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  createUser: (name: string) => Promise<User>;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  createUser: async () => ({ id: '', name: '' }),
  logout: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('fin_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('fin_user');
      }
    }
    setLoading(false);
  }, []);

  const createUser = useCallback(async (name: string): Promise<User> => {
    const res = await usersApi.create(name);
    const newUser = { id: res.data.id, name: res.data.name };
    setUser(newUser);
    localStorage.setItem('fin_user', JSON.stringify(newUser));
    return newUser;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('fin_user');
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, setUser, createUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
