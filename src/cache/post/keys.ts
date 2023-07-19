export const keyPostDetail = (postId: string | number) => {
  return `post:${postId}:detail`;
};

export const keyPostLikes = (postId: string | number) => {
  return `post:${postId}:likes`;
};

export const keyUserLikesPost = (userId: string | number) => {
  return `user:${userId}:post_likes`;
};
