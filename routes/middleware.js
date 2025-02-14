module.exports.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) next();
  else res.redirect(303, '/unauth');
};

module.exports.isNotLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) next();
  else res.redirect(303, '/');
};
