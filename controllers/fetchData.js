const {
  Post,
  User,
  Sequelize,
  Friend,
  Comment,
  Room,
  Message,
  Hashtag,
} = require('../db/models');

const fetchFriends = async (userId) => {
  const followingsObj = {};
  const followingsArr = await Friend.findAll({
    where: { followerId: userId },
    attributes: ['followingId', 'accepted', 'roomId'],
  });
  followingsArr.forEach((f) => {
    followingsObj[f.followingId] = { accepted: f.accepted, roomId: f.roomId };
  });

  const followersObj = {};
  const followersArr = await Friend.findAll({
    where: { followingId: userId },
    attributes: ['followerId', 'accepted', 'roomId'],
  });
  followersArr.forEach((f) => {
    followersObj[f.followerId] = { accepted: f.accepted, roomId: f.roomId };
  });

  return { followingsObj, followersObj };
};

const fetchPosts = async (ids = []) => {
  const findOption = {
    include: [
      {
        model: User,
        attributes: ['id', 'name', 'profileImg'],
      },
      {
        model: User,
        attributes: ['id', 'name'],
        as: 'UserWhoLikePosts',
      },
      {
        model: Comment,
        include: [
          {
            model: User,
            attributes: ['id', 'name', 'profileImg'],
          },
          {
            model: User,
            attributes: ['id', 'name'],
            as: 'UserWhoLikeComments',
          },
        ],
        order: [[Sequelize.literal('bundleCreatedAt, createdAt'), 'ASC']],
      },
    ],
    order: [['createdAt', 'DESC']],
  };
  if (ids.length) findOption.where = { id: { [Sequelize.Op.in]: ids } };

  const posts = await Post.findAll(findOption);
  const likes = { posts: {}, comments: {} };

  posts.forEach((post) => {
    // UserWhoLikePosts
    likes.posts[post.id] = { id: [], name: [] };
    post.UserWhoLikePosts.forEach((user) => {
      likes.posts[post.id].id.push(user.id);
      likes.posts[post.id].name.push(user.name);
    });

    // UserWhoLikeComments
    // console.log('post', post);
    post.comments.forEach((comment) => {
      likes.comments[comment.id] = { id: [], name: [] };
      comment.UserWhoLikeComments.forEach((user) => {
        likes.comments[comment.id].id.push(user.id);
        likes.comments[comment.id].name.push(user.name);
      });
    });
  });

  return { posts, likes };
};

const fetchPostsWithTag = async (tag) => {
  const hashtag = await Hashtag.findOne({
    where: { title: tag },
    include: [
      {
        model: Post,
        attributes: ['id'],
      },
    ],
  });
  const posts = [];
  const likes = { posts: {}, comments: {} };
  if (!hashtag) return { posts, likes };

  const postIds = hashtag.posts.map((p) => p.id);
  return fetchPosts(postIds);
};

const fetchRooms = async (userId) => {
  // fetch friends
  let rooms = [];
  const user = await User.findOne({ where: { id: userId } });
  const friends = await user.getFollowings({
    through: {
      where: { accepted: true },
      attributes: ['createdAt', 'roomId'],
    },
  });
  if (!friends.length) return { friends, rooms };

  // fetch chatting rooms with the latest message
  const roomIds = friends.map((f) => f.friend.roomId);
  rooms = await Room.findAll({
    where: { id: { [Sequelize.Op.in]: roomIds } },
    include: [
      {
        model: Message,
        order: [['createdAt', 'DESC']],
        limit: 1,
      },
    ],
  });

  return { friends, rooms };
};

const fetchMessages = async (roomId) => {
  const messages = await Message.findAll({
    where: { roomId },
    paranoid: false,
    order: [['createdAt', 'ASC']],
  });

  const msgsUnread = messages.filter((msg) => !msg.isRead);
  await Promise.all(
    msgsUnread.map((msg) => {
      msg.isRead = true;
      return msg.save();
    }),
  );

  return messages;
};

const fetchFriendInRoom = async ({ userId, roomId }) => {
  const room = await Room.findOne({
    where: { id: roomId },
    include: [
      {
        model: Friend,
      },
    ],
  });
  const friendInRoom = room.friends
    .map((f) => f.followingId)
    .filter((uid) => uid !== userId);
  if (friendInRoom.length > 1) {
    // user is not in the room
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  return friendInRoom[0];
};

module.exports = {
  fetchFriends,
  fetchPosts,
  fetchPostsWithTag,
  fetchRooms,
  fetchMessages,
  fetchFriendInRoom,
};
