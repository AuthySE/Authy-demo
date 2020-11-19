const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const config = require('../config.js');
const qs = require('qs');

const authy = require('authy')(config.API_KEY);

const lookup = require('../lookup')(config.TWILIO_ACCT_SID,config.TWILIO_AUTH_TOKEN);

function hashPW (pwd) {
    return crypto.createHash('sha256').update(pwd).digest('base64').toString();
}

/**
 * Login a user
 * @param req
 * @param res
 */
exports.login = function (req, res) {
    User.findOne({username: req.body.username})
        .exec(function (err, user) {
            if (!user) {
                err = 'Username Not Found';
            } else if (('password' in req.body) && (user.hashed_password !==
                hashPW(req.body.password.toString()))) {
                err = 'Wrong Password';
            } else {
                createSession(req, res, user);
            }

            if (err) {
                res.status(500).json(err);
            }
        });
};

/**
 * Logout a user
 *
 * @param req
 * @param res
 */
exports.logout = function (req, res) {
    req.session.destroy(function (err) {
        if (err) {
            console.log("Error Logging Out: ", err);
            return next(err);
        }
        res.status(200).send();
    });
};


/**
 * Check user login status.  Redirect appropriately.
 *
 * @param req
 * @param res
 */
exports.loggedIn = function (req, res) {

    if (req.session.loggedIn && req.session.authy) {
        res.status(200).json({url: "/protected"});
    } else if (req.session.loggedIn && !req.session.authy) {
        res.status(200).json({url: "/2fa"});
    } else {
        res.status(200).json({url: "/login"});
    }
};


/**
 * Sign up a new user.
 *
 * @param req
 * @param res
 */
exports.register = function (req, res) {

    let username = req.body.username;

    User.findOne({username: username}).exec(function (err, user) {
        if (err) {
            console.log('Rregistration Error', err);
            res.status(500).json(err);
            return;
        }
        if (user) {
            res.status(409).json({err: "Username Already Registered"});
            return;
        }

        console.log(user);

        user = new User({username: req.body.username});

        user.set('hashed_password', hashPW(req.body.password));
        user.set('email', req.body.email);
        user.set('authyId', null);
        user.save(function (err) {
            if (err) {
                console.log('Error Creating User', err);
                res.status(500).json(err);
            } else {

                authy.register_user(req.body.email, req.body.phone_number, req.body.country_code,
                    function (err, regRes) {
                        if (err) {
                            console.log('Error Registering User with Authy');
                            res.status(500).json(err);
                            return;
                        }

                        user.set('authyId', regRes.user.id);

                        // Save the AuthyID into the database then request an SMS
                        user.save(function (err) {
                            if (err) {
                                console.log('error saving user in authyId registration ', err);
                                res.session.error = err;
                                res.status(500).json(err);
                            } else {
                                createSession(req, res, user);
                            }
                        });
                    });
            }
        });
    });
};

/**
 * Request a OneCode via SMS
 *
 * @param req
 * @param res
 */
exports.sms = function (req, res) {
    let username = req.session.username;
    User.findOne({username: username}).exec(function (err, user) {
        console.log("Send SMS");
        if (err) {
            console.log('SendSMS', err);
            res.status(500).json(err);
            return;
        }

        /**
         * If the user has the Authy app installed, it'll send a text
         * to open the Authy app to the TOTP token for this particular app.
         *
         * Passing force: true forces an SMS send.
         */
        authy.request_sms(user.authyId, true, function (err, smsRes) {
            if (err) {
                console.log('ERROR requestSms', err);
                res.status(500).json(err);
                return;
            }
            console.log("requestSMS response: ", smsRes);
            res.status(200).json(smsRes);
        });
    });
};

/**
 * Request a OneCode via a voice call
 *
 * @param req
 * @param res
 */
exports.voice = function (req, res) {
    let username = req.session.username;
    User.findOne({username: username}).exec(function (err, user) {
        console.log("Send SMS");
        if (err) {
            console.log('ERROR SendSMS', err);
            res.status(500).json(err);
            return;
        }

        /**
         * If the user has the Authy app installed, it'll send a text
         * to open the Authy app to the TOTP token for this particular app.
         *
         * Passing force: true forces an voice call to be made
         */
        authy.request_call(user.authyId, true, function (err, callRes) {
            if (err) {
                console.error('ERROR requestcall', err);
                res.status(500).json(err);
                return;
            }
            console.log("requestCall response: ", callRes);
            res.status(200).json(callRes);
        });
    });
};

/**
 * Verify an Authy Code
 *
 * @param req
 * @param res
 */
exports.verify = function (req, res) {
    let username = req.session.username;
    User.findOne({username: username}).exec(function (err, user) {
        console.log("Verify Token");
        if (err) {
            console.error('Verify Token User Error: ', err);
            res.status(500).json(err);
        }


        authy.verify(user.authyId, req.body.token, function (err, tokenRes) {
            if (err) {
                console.log("Verify Token Error: ", err);
                res.status(500).json(err);
                return;
            }
            console.log("Verify Token Response: ", tokenRes);
            if (tokenRes.success) {
                req.session.authy = true;
            }
            res.status(200).json(tokenRes);
        });
    });
};

/**
 * Create a Push Notification request.
 * The front-end client will poll 12 times at a frequency of 5 seconds before terminating.
 * If the status is changed to approved, it quit polling and process the user.
 *
 * @param req
 * @param res
 */
exports.createonetouch = function (req, res) {

    let username = req.session.username;
    console.log("username: ", username);
    User.findOne({username: username}).exec(function (err, user) {
        if (err) {
            console.error("Create OneTouch User Error: ", err);
            res.status(500).json(err);
        }

        let user_payload = {'message': 'Customize this push notification with your messaging'};

        authy.send_approval_request(user.authyId, user_payload, {}, null, function (oneTouchErr, oneTouchRes) {
            if (oneTouchErr) {
                console.error("Create OneTouch Error: ", oneTouchErr);
                res.status(500).json(oneTouchErr);
                return;
            }
            console.log("OneTouch Response: ", oneTouchRes);
            req.session.uuid = oneTouchRes.approval_request.uuid;
            res.status(200).json(oneTouchRes)
        });
    });
};

/**
 * Verify the OneTouch request callback via HMAC inspection.
 *
 * @url https://en.wikipedia.org/wiki/Hash-based_message_authentication_code
 * @url https://gist.github.com/josh-authy/72952c62521480f3dd710dcbad0d8c42
 *
 * @param req
 * @return {Boolean}
 */
function verifyCallback (req) {

    let apiKey = config.API_KEY;

    let url = req.headers['x-forwarded-proto'] + "://" + req.hostname + req.url;
    let method = req.method;
    let params = req.body;

    // Sort the params.
    let sorted_params = qs.stringify(params).split("&").sort().join("&").replace(/%20/g, '+');

    let nonce = req.headers["x-authy-signature-nonce"];
    let data = nonce + "|" + method + "|" + url + "|" + sorted_params;

    let computed_sig = crypto.createHmac('sha256', apiKey).update(data).digest('base64');
    let sig = req.headers["x-authy-signature"];

    return sig === computed_sig;
}

/**
 * Poll for the OneTouch status.  Return the response to the client.
 * Set the user session 'authy' variable to true if authenticated.
 *
 * @param req
 * @param res
 */
exports.checkonetouchstatus = function (req, res) {

    let options = {
        url: "https://api.authy.com/onetouch/json/approval_requests/" + req.session.uuid,
        form: {
            "api_key": config.API_KEY
        },
        headers: {},
        qs: {
            "api_key": config.API_KEY
        },
        json: true,
        jar: false,
        strictSSL: true
    };

    authy.check_approval_status(req.session.uuid, function (err, response) {
        if (err) {
            console.log("OneTouch Status Request Error: ", err);
            res.status(500).json(err);
        }
        console.log("OneTouch Status Response: ", response);
        if (response.approval_request.status === "approved") {
            req.session.authy = true;
        }
        res.status(200).json(response);
    });
};

/**
 * Register a phone
 *
 * @param req
 * @param res
 */
exports.requestPhoneVerification = function (req, res) {
    let phone_number = req.body.phone_number;
    let country_code = req.body.country_code;
    let via = req.body.via;
    let locale = req.body.locale;

    let info = {
        via: via
        , locale: locale,
        //, custom_message: 'Here is your custom message {{code}}',
        //, custom_code: '0051243'
    };


    if (phone_number && country_code && via && locale) {

        authy.phones().verification_start(phone_number, country_code, info, function (err, response) {
            if (err) {
                console.log('error creating phone reg request', err);
                res.status(500).json(err);
            } else {
                console.log('Success register phone API call: ', response);
                res.status(200).json(response);
            }
        });
    } else {
        console.log('Failed in Register Phone API Call', req.body);
        res.status(500).json({error: "Missing fields"});
    }

};

/**
 * Confirm a phone registration token
 *
 * @param req
 * @param res
 */
exports.verifyPhoneToken = function (req, res) {
    let country_code = req.body.country_code;
    let phone_number = req.body.phone_number;
    let token = req.body.token;

    if (phone_number && country_code && token) {

        authy.phones().verification_check(phone_number, country_code, token, function (err, response) {
            if (err) {
                console.log('error creating phone reg request', err);
                res.status(500).json(err);
            } else {
                console.log('Confirm phone success confirming code: ', response);
                if (response.success) {
                    req.session.ph_verified = true;
                }
                res.status(200).json(err);
            }
        });
    } else {
        console.log('Failed in Confirm Phone request body: ', req.body);
        res.status(500).json({error: "Missing fields"});
    }
};

/**
 * Lookup a phone number
 * @param req
 * @param res
 */
exports.lookupNumber = function (req, res) {
    let country_code = req.body.country_code;
    let phone_number = req.body.phone_number;

    if(country_code && phone_number){
        lookup.get(phone_number,country_code, function(resp){
            console.log("response", resp);
            if(resp === false){
                res.status(500).send({"success": false});
            } else {
                console.log("successful response", resp);
                res.json({info: resp})
            }
        });

    } else {
        console.log('Failed in Register Phone API Call', req.body);
        res.status(500).json({error: "Missing fields"});
    }
};


/**
 * Create the initial user session.
 *
 * @param req
 * @param res
 * @param user
 */
function createSession (req, res, user) {
    req.session.regenerate(function () {
        req.session.loggedIn = true;
        req.session.user = user.id;
        req.session.username = user.username;
        req.session.msg = 'Authenticated as: ' + user.username;
        req.session.authy = false;
        req.session.ph_verified = false;
        res.status(200).json();
    });
}