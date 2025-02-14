const bcrypt = require('bcrypt');
const { User, Post, Hashtag, Friend, Room, Message, Comment } = require('../db/models');

const createUser = async ({ email, name, password, gender, birth }) => {
  const exUser = await User.findOne({ where: { email } });
  if (exUser) return false;

  const hash = await bcrypt.hash(password, 12);
  await User.create({
    email,
    name,
    password: hash,
    gender,
    birth,
  });
  return true;
};

const createHashtags = (hashtags) => {
  return Promise.all(
    hashtags.map((tag) =>
      Hashtag.findOrCreate({
        where: { title: tag.slice(1).toLowerCase() },
      }),
    ),
  );
};

const createPost = async ({ content, img, userId }) => {
  const newPost = await Post.create({ content, img, userId });
  const hashtags = content.match(/#[^\s#]*/g);
  if (hashtags) {
    const result = await createHashtags(hashtags);
    await newPost.addHashtags(result.map((r) => r[0]));
  }
};

const createOneWayFriend = async ({ userId, targetUID }) => {
  const user = await User.findOne({ where: { id: userId } });
  await user.addFollowing(targetUID, { through: { accepted: false } });
};

const createTwoWayFriend = async ({ userId, targetUID }) => {
  let friendRequested = await Friend.findOne({
    where: { followerId: targetUID, followingId: userId },
  });
  if (!friendRequested) {
    const err = new Error('Not Found');
    err.status = 404;
    throw err;
  }

  friendRequested.accepted = true;
  friendRequested = await friendRequested.save();

  const user = await User.findOne({ where: { id: userId } });
  const [friendAccepted] = await user.addFollowing(targetUID, {
    through: { accepted: true },
  });

  const room = await Room.create({});
  await room.addFriends([friendRequested, friendAccepted]);

  return room.id;
};

const createMessage = async ({ userId = null, roomId, content }) => {
  const room = await Room.findOne({
    where: { id: roomId },
    include: [
      {
        model: Friend,
      },
    ],
  });
  if (!room) {
    // room doesn't exist
    const err = new Error('Not Found');
    err.status = 404;
    throw err;
  } else if (userId && !room.friends.map((f) => f.followingId).includes(userId)) {
    // it is not a system message && the user isn't in the room.
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  return Message.create({ userId, roomId, content });
};

const createLike = async ({ userId, target, targetId }) => {
  const targetObj =
    target === 'post'
      ? await Post.findOne({ where: { id: targetId } })
      : await Comment.findOne({ where: { id: targetId } });
  if (!targetObj) {
    const err = new Error('Not Found');
    err.status = 404;
    throw err;
  }

  if (target === 'post') await targetObj.addUserWhoLikePost(userId);
  else await targetObj.addUserWhoLikeComment(userId);
};

const createComment = async ({ content, depth, userId, postId, bundleCreatedAt }) => {
  const post = await Post.findOne({ where: { id: postId } });
  if (!post) {
    const err = new Error('Not Found');
    err.status = 404;
    throw err;
  }

  return Comment.create(
    bundleCreatedAt
      ? { content, depth, userId, postId, bundleCreatedAt }
      : { content, depth, userId, postId },
  );
};

module.exports = {
  createUser,
  createPost,
  createOneWayFriend,
  createTwoWayFriend,
  createMessage,
  createLike,
  createComment,
};
