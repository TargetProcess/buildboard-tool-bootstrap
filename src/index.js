var Koa = require('koa');
var app = new Koa();
var url = require('url');
var _ = require('lodash');
var Mongo = require('koa-mongo');
console.log(process.cwd());

module.exports = {
    bootstrap({ settings, methods }, securedRouterCallback)
    {
        var config = require('./config-' + (process.env.NODE_ENV || 'dev') + '.json');


        var secretKey = config.secret;
        var toolId = process.env.TOOL_ID;
        var toolConfig = _.find(config.tools, tool=>tool.id == toolId);
        mongo = toolConfig.mongo || {};
        var toolUrl = url.parse(toolConfig.url);

        port = parseInt(toolUrl.port || (toolUrl.protocol == "https:" ? "443" : "80"));

        console.log({toolId, port, mongo, secretKey});
        if (!port || !mongo || !secretKey) {
            console.error('Invalid configuration: ');

            process.exit(1);
        }

        // body parser
        const bodyParser = require('koa-bodyparser');
        app.use(bodyParser());

        var auth = require('./auth');

        const mongoUrl = mongo.url || `mongodb://${mongo.host || '127.0.0.1'}:${mongo.port || 27017}/${mongo.db || toolId}`;
        auth(mongoUrl, secretKey);

        app.use(Mongo({url: mongoUrl}));

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
            }
        });


        app.use(unsecuredRouter.routes());

        app.use(function*(next) {
            var ctx = this;
            yield passport.authenticate("authtoken",
                {session: true},
                function*(err, user) {
                    if (err) throw err;
                    if (user === false) {
                        ctx.status = 401;
                        ctx.body = {success: false, error: 'Authentication fails. Unknown tool token.'}
                    } else {
                        yield ctx.login(user);
                        yield next;

                    }
                }).call(this, next);
        });

        app.use(function*(next) {
            if (this.isAuthenticated()) {
                yield next
            } else {
                this.redirect('/')
            }
        });

        var securedRouter = new Router();

        var accountController = require('./accounts')(settings, mongo);
        accountController.setupRoutes(securedRouter);

        if (securedRouterCallback) {
            securedRouterCallback({
                router: securedRouter
            });
        }

        _.each(methods, (method, methodName)=> {
            _.each(method, (config, action)=> {
                securedRouter[action](methodName, config.action)
            });
        });

        app
            .use(securedRouter.routes())
            .use(securedRouter.allowedMethods());

        app.listen(port);

    },
    getUrl(ctx)
    {
        var request = ctx.request;
        return url.parse(request.protocol + '://' + request.host + request.originalUrl, true);
    }
};

