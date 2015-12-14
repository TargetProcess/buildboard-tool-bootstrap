const _ = require('lodash');

var validators = {
    'string': _.isString,
    'list': _.isArray,
    'multiple selection': (value, config)=> {
        if (!_.isArray(value)) {
            return false;
        }
        var rest = _.without(value, config.values);
        if (rest.length > 0) {
            return `Unknown values: ${rest.join(',')}`;
        }
        return true;
    },
    'uri': value=>_.isString(value) && (value.indexOf('http://') == 0 || value.indexOf('https://') == 0)
};

module.exports = {
    validators,
    *validateSettings (settingsInfo, settings) {
        var customValidation = _.isFunction(settingsInfo.validation) && settingsInfo.validation;

        if (!_.isArray(settingsInfo)) {
            settingsInfo = _(settingsInfo)
                .omit('validation')
                .map((v, k)=> {
                    v.id = k;
                    return v;
                })
                .value();
        }

        var error = _(settingsInfo)
            .map(config=> {
                var id = config.id;
                var value = settings[id];
                if (!value) {
                    if (config.optional) {
                        return;
                    } else {
                        return `'${id}' is required`;
                    }
                }
                var validator = validators[config.type];
                if (!validator) {
                    return `Unknown type ${config.type} for ${id}`
                }
                var validationResult = validator(value, config);
                if (validationResult === false) {
                    return `'${id}' has invalid type, should be ${config.type}`;
                }
                else if (_.isString(validationResult)) {
                    return validationResult;
                }

            })
            .compact()
            .value();


        if (error.length !== 0) {
            return {error};
        }


        if (customValidation) {
            var customValidationResult = yield customValidation(settings);
            if (customValidationResult !== true) {
                return {error: customValidationResult.error || ['Tool validation failed']}
            }
        }

        return {accountConfig: settings};
    }

};