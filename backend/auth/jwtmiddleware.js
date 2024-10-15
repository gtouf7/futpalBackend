const jwt = require('jsonwebtoken');

// Authenticate the token
const tokenAuth = (req, res, next) => {
    //console.log('headers:', req.headers);
    let token = req.headers['authorization'];
    //console.log('token is:', token);
    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    } else if (token.startsWith('Bearer ')) {
        token = token.split(' ')[1];
    }
    // token is successfully split
    //console.log('new token is:', token);
    jwt.verify(token, process.env.JWTSECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token" });
        }

        req.user = user; //decoded user
        next();

    });
}

module.exports = tokenAuth;