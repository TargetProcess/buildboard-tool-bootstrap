var Koa = require('koa');
var app = new Koa();
var url = require('url');
var _ = require('lodash');
var Mongo = require('koa-mongo');

function readGeneralSettings(id) {
    var config = require(process.cwd() + '/../config-' + (process.env.NODE_ENV || 'dev') + '.json');

    var secretKey = config.secret;

    var toolConfig = _.find(config.tools, tool=>tool.id == id);
    var mongo = _.defaults(toolConfig.mongo || {}, {host: '127.0.0.1', port: 27017, db: id});
    var toolUrl = url.parse(toolConfig.url);

    var port = parseInt(toolUrl.port || (toolUrl.protocol == 'https:' ? '443' : '80'));

    var generalSettings = {id, port, mongo, secretKey, url: toolConfig.url, buildboardUrl: config.url};

    console.log(generalSettings);
    if (!port || !mongo || !secretKey) {
        console.error('Invalid configuration: ');

        process.exit(1);
    }
    return generalSettings;
}

function getMongoUrl(mongo) {
    if (mongo.url) {
        return mongo.url;
    } else {
        var auth = (mongo.user && mongo.password) ? `${mongo.user}:${mongo.password}@` : '';
        return `mongodb://${auth}${mongo.host}:${mongo.port}/${mongo.db}`;
    }
}

module.exports = {
    bootstrap({id, settings, methods, account}, securedRouterCallback)
    {
        const generalSettings = readGeneralSettings(id);
        var mongoUrl = getMongoUrl(generalSettings.mongo);

        app.use(require('koa-bodyparser')());
        app.use(Mongo({url: mongoUrl}));

        var auth = require('./auth');
        auth(mongoUrl, generalSettings.secretKey);

        const passport = require('koa-passport');
        app.use(passport.initialize());

        var logger = require('koa-logger');
        var json = require('koa-json');

        app.use(json());
        app.use(logger());

        var Router = require('koa-router');

        var unsecuredRouter = new Router();

        unsecuredRouter.get('/', function () {
            this.body = {
                settings,
                methods
            };
        });

        app.use(unsecuredRouter.routes());

        app.use(function*(next) {
            var ctx = this;
            yield passport.authenticate('authtoken',
                {session: true},
                function*(err, user) {
                    if (err) {
                        throw err;
                    }
                    if (user === false) {
                        ctx.status = 401;
                        ctx.body = {success: false, error: 'Authentication fails. Unknown tool token.'};
                    } else {
                        yield ctx.login(user);
                        yield next;

                    }
                }).call(this, next);
        });

        app.use(function*(next) {
            if (this.isAuthenticated()) {
                yield next;
            } else {
                this.redirect('/');
            }
        });

        var securedRouter = new Router();

        if (_.isFunction(account)) {
            account = account({generalSettings});
        }

        var accountController = require('./accounts')(settings, generalSettings.mongo, account);
        accountController.setupRoutes(securedRouter);

        if (securedRouterCallback) {
            securedRouterCallback({
                router: securedRouter,
                generalSettings
            });
        }

        _.each(methods, (method, methodName)=> {
            _.each(method, (config, action)=> {
                securedRouter[action]('/' + methodName, config.action);
            });
        });

        app
            .use(securedRouter.routes())
            .use(securedRouter.allowedMethods());

        app.listen(generalSettings.port);

        return generalSettings;

    },
    getUrl(ctx)
    {
        var request = ctx.request;
        return url.parse(request.protocol + '://' + request.host + request.originalUrl, true);
    }
};

