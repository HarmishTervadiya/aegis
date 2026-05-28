export interface UserProfile {
  wallet: string;
  createdAt: string;
  notifications: boolean;
  label: string | null;
  lastSeenAt: string;
}

// In-memory user store: walletAddress -> UserProfile
const users = new Map<string, UserProfile>();

export function getOrCreateUser(wallet: string): UserProfile {
  if (!users.has(wallet)) {
    users.set(wallet, {
      wallet,
      createdAt: new Date().toISOString(),
      // Notification preferences (email alerts etc — future feature)
      notifications: false,
      // Custom label the user sets for their own reference
      label: null,
      // Last time the frontend checked in
      lastSeenAt: new Date().toISOString(),
    });
  }
  return users.get(wallet)!;
}

export function updateUser(
  wallet: string,
  updates: Partial<UserProfile>,
): UserProfile {
  const user = getOrCreateUser(wallet);
  const allowed: (keyof UserProfile)[] = [
    "label",
    "notifications",
    "lastSeenAt",
  ];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      (user as any)[key] = updates[key];
    }
  }
  users.set(wallet, user);
  return user;
}

export function getUser(wallet: string): UserProfile | null {
  return users.get(wallet) || null;
}
