var passport = require('koa-passport');

passport.serializeUser((user, done)=>done(null, user));
passport.deserializeUser((user, done)=>done(null, user));

var MongoClient = require('mongodb').MongoClient;

var TokenStrategy = require('passport-auth-token').Strategy;


module.exports = (url)=> {
    passport.use(new TokenStrategy(
        function (token, done) {
            console.log(token);
            if (process.env.SECRET_KEY && token == process.env.SECRET_KEY) {
                done(null, {type: 'system'}, {scope: 'all'});
            }
            else {
                MongoClient.connect(url, function (err, db) {
                    if (err) {
                        done(err)
                    } else {
                        db
                            .collection('accounts')
                            .find({accountToken: {$eq: token}})
                            .limit(1)
                            .next(function (err, doc) {
                                db.close();
                                if (err) {
                                    done(err);
                                } else {
                                    if (doc) {
                                        done(null, doc, {scope: 'all'});
                                    } else {
                                        done(null, false);
                                    }
                                }
                            });
                    }
                });
            }
        }
    ));

};


