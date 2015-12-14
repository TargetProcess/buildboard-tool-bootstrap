var validateSettings = require('./validateSettings').validateSettings;
var _ = require('lodash');

module.exports = function (settings, mongoConfig) {


    return {
        setupRoutes(router){
            router
                .post('/account/validate')
                .get('/account/:accountToken', checkSystemPassport, getAccount, get)
                .post('/account/:accountToken', checkSystemPassport, getAccount, createOrUpdate)
                .delete('/account/:accountToken', checkSystemPassport, getAccount, deleteAccount)

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

        var accountToken = this.params.accountToken;

        this.account = yield this.accountsCollection
            .find({accountToken})
            .limit(1)
            .next();

        yield next;
    }


    function *get() {
        if (this.account) {
            this.body = _.omit(this.account, '_id');
        }
        else {
            this.body = {result: `Account '${this.params.accountToken}' not found`};
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
                accountToken: this.params.accountToken,
                config: accountConfig
            });
            yield this.accountsCollection.updateOne({accountToken: this.params.accountToken},
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
            this.body = {result: `Account '${this.params.accountToken}' not found`};
            this.status = 404;
        }
    }


};