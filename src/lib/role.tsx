// Who is using this phone: the group admin (picks verses, posts, grades) or a
// member (receives the daily verse). Desktop is always the admin's tool.

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { currentWeekStart } from './dates';
import { isNative } from './platform';
import { syncAndSchedule } from './scheduler';

export type Role = 'admin' | 'member';

interface RoleState {
  role: Role | null; // null = not chosen yet (first launch)
  ready: boolean;
  /** Members must be logged in (name + PIN) to use the app. */
  memberAuthed: boolean;
  setRole: (r: Role) => Promise<void>;
  /** Member logged out → back to the name + PIN screen. */
  signOutMember: () => Promise<void>;
}

const Ctx = createContext<RoleState>({ role: 'admin', ready: true, memberAuthed: true, setRole: async () => {}, signOutMember: async () => {} });

const hasMemberToken = async () => !!((await api().settings.getAll()) as Record<string, string>).member_token;

async function detectRole(): Promise<Role | null> {
  const s = (await api().settings.getAll()) as Record<string, string>;
  if (s.app_role === 'admin' || s.app_role === 'member') return s.app_role;
  if (!isNative()) return 'admin';
  // Upgrading from 0.0.2: a phone that already has members or verses picked is the admin's.
  const [users, count] = await Promise.all([
    api().users.list() as Promise<unknown[]>,
    api().selections.count(currentWeekStart()) as Promise<number>,
  ]);
  if (users.length > 0 || count > 0) {
    await api().settings.set('app_role', 'admin');
    return 'admin';
  }
  return null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);
  const [memberAuthed, setMemberAuthed] = useState(false);

  useEffect(() => {
    detectRole()
      .then(async (r) => {
        setMemberAuthed(await hasMemberToken());
        setRoleState(r);
        if (r) syncAndSchedule().catch(() => {}); // role may be set only now (0.0.2 upgrade)
      })
      .catch(() => setRoleState(isNative() ? null : 'admin'))
      .finally(() => setReady(true));
  }, []);

  const setRole = useCallback(async (r: Role) => {
    await api().settings.set('app_role', r);
    setMemberAuthed(await hasMemberToken());
    setRoleState(r);
  }, []);

  const signOutMember = useCallback(async () => {
    for (const k of ['member_token', 'member_id', 'member_name']) await api().settings.set(k, '');
    setMemberAuthed(false);
  }, []);

  return <Ctx.Provider value={{ role, ready, memberAuthed, setRole, signOutMember }}>{children}</Ctx.Provider>;
}

export const useRole = () => useContext(Ctx);
