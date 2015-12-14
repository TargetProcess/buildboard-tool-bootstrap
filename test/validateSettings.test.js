var expect = require("chai").expect;

var validateSettings = require("../src/validateSettings").validateSettings;

describe('Validate Settings', function () {
    it('should validate simple types', ()=> {
        var settings = {
            string: 'some string',
            list: [1]
        };
        expect(
            validateSettings({
                'string': {
                    type: 'string'
                },
                'list': {
                    type: 'list'
                }
            }, settings).next().value)
            .to.be.eql({accountConfig: settings});
    });
    it('should validate urls', ()=> {
        var settings = {
            url: 'http://url'
        };
        expect(
            validateSettings({
                'url': {
                    type: 'uri'
                }
            }, settings).next().value)
            .to.be.eql({accountConfig: settings});
    });
    it('should fail on invalid urls', ()=> {
        var settings = {
            url: 'fail'
        };
        expect(validateSettings({
            url: {type: 'uri'}
        }, settings).next().value)
            .to.be.eql({
            "error": [
                "'url' has invalid type, should be uri"
            ]
        })
    })
});
