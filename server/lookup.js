const request = require('request');
const VERSION = "0.1";

module.exports = function (SID, AUTH_TOKEN) {
	return new Lookup(SID, AUTH_TOKEN);
};

function Lookup(SID, AUTH_TOKEN) {
	this.SID = SID;
	this.AUTH_TOKEN = AUTH_TOKEN;
	this.URL = "https://lookups.twilio.com";
	this.headers = {};
    this.SETUP = false;
	this.init();
}

Lookup.prototype.init = function () {

    if(!this.SID || !this.AUTH_TOKEN){
        console.error("Account SID AND Auth Token required for Lookups");
    } else {
        this.SETUP = true;
        this.headers = {
            "Authorization": "Basic " + new Buffer(this.SID + ":" + this.AUTH_TOKEN).toString("base64")
        };
        console.info("Lookup setup properly");
    }
};

/**
 * Lookup a number.
 *
 */
Lookup.prototype.get = function (phone_number, country_code, callback) {
    console.log(this);
    if(!this.SETUP){
        console.log('Lookup was not setup properly.');
        callback(false);
    } else {
        this._request("get", "/v1/PhoneNumbers/" + country_code + phone_number + "/?Type=carrier", {},
            callback
        );
    }
};

Lookup.prototype._request = function (type, path, params, callback, qs) {

	let options = {
		url: this.URL + path,
		form: params,
		headers: this.headers,
		qs: qs,
		json: true,
		jar: false,
		strictSSL: true
	};

	let callback_check = function (err, res, body) {
		if (!err) {
			if (res.statusCode === 200) {
				callback(body);
			} else {
				callback(false);
			}
		} else {
			callback(err);
		}
	};

	switch (type) {
		case "post":
			request.post(options, callback_check);
			break;

		case "get":
			request.get(options, callback_check);
			break;
	}
};