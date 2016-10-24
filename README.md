# Authy Demo Site

A simple NodeJS and AngularJS implementation of a website that uses Authy to protect.  This app uses MongoDB as a data store.  You may have to install that as well and make sure it is up and running.

### Features
- URL path protected with both user session and Authy 2FA
- Authy OneCode (SMS and Voice)
- Authy SoftTokens
- Authy OneTouch (via polling)

### Setup
- Clone this repo
- Run `npm install`
- Register for a [Twilio Account](https://www.twilio.com/).
- Setup an Authy app via the [Twilio Console](https://twilio.com/console).
- Grab an Authy API key from the Authy dashboard and save it in your demo.env
- Load the demo.env environmental variables into your shell `source demo.env`
- Check and make sure MongoDB is up and running
- Run `nodemon .` or `node .` from the cloned repo to run the app

### Authy Library
- In this example, we primarily use the [Authy client provided by Seegno](https://github.com/seegno/authy-client)
- As Authy is a cloud based REST API, you're free to develop your own library.

### License
- MIT