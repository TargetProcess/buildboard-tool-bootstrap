var validateSettings = require('./validateSettings').validateSettings;
var _ = require('lodash');

module.exports = function (settings, mongoConfig) {


    return {
        setupRoutes(router){
            router
                .get('/account/:toolToken', checkSystemPassport, getAccount, get)
                .post('/account/:toolToken', checkSystemPassport, getAccount, createOrUpdate)
                .delete('/account/:toolToken', checkSystemPassport, getAccount, deleteAccount)

        }
    };

    function *checkSystemPassport(next) {
        if (this.passport.user.type == 'system') {
            yield next;
        }
        else {
            this.status = 403;
            this.body = {success: false}
        }
    }

    function *getAccount(next) {
        this.accountsCollection = this.mongo.db(mongoConfig.db)
            .collection('accounts');

        var toolToken = this.params.toolToken;

        this.account = yield this.accountsCollection
            .find({toolToken})
            .limit(1)
            .next();

        yield next;
    }


    function *get() {
        if (this.account) {
            this.body = _.omit(this.account, '_id');
        }
        else {
            this.body = {error: [`Account '${this.params.toolToken}' not found`]};
            this.status = 404;
        }
    }


    function *createOrUpdate() {
        var {error,accountConfig} = yield validateSettings(settings, this.request.body.config);
        if (error) {
            this.status = 400;
            this.body = error;
        }
        else {
            this.status = this.account ? 200 : 201;
            var account = _.assign(this.account || {}, {
                name: this.request.body.name,
                toolToken: this.params.toolToken,
                config: accountConfig
            });
            yield this.accountsCollection.updateOne({toolToken: this.params.toolToken},
                {$set: account},
                {upsert: !this.account});
            this.body = _.omit(account, '_id');
        }
    }

    function *deleteAccount() {
        if (this.account) {
            yield this.accountsCollection.deleteOne({_id: this.account._id});
            this.body = {result: 'deleted'};
            this.status = 200;
        }
        else {
            this.body = {error: [`Account '${this.params.toolToken}' not found`]};
            this.status = 404;
        }
    }


};