export const keyUserProfile = (userId: string | number) => {
  return `user:${userId}:profile`;
};

export const keyUserPosts = (userId: string | number) => {
  return `user:${userId}:posts`;
};

export const keyUserFollowers = (userId: string | number) => {
  return `user:${userId}:followers`;
};

export const keyUserFollowing = (userId: string | number) => {
  return `user:${userId}:following`;
};
