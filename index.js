'use strict'

require('dotenv').config();
const express = require('express');
const querystring = require('querystring');
// const db_handler = require('./db_handler')
const moment = require('moment');
const bodyParser = require('body-parser');
const getData = require('./getData.js');
const request = require('request');
const authorization = require('./authorization.js');
const botConnector = require('./botConnector.js');

const app = express();

app.set('port', (process.env.PORT || 5000));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.static(__dirname + 'public'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

let code = authorization.code;
let token = authorization.token;

let AUTH_INFO;
let ACCESS_TOKEN;
let REFRESH_TOKEN;
let USER_ID;


app.get('/webhook/', function(req, res) {
	if(req.query['hub.verify_token'] === "blonde") {
		res.send(req.query['hub.challenge']);
    console.log('verified!');
  }
	res.send("Wrong token");
})

app.post('/webhook/', function(req, res) {
  console.log('post to the webhook')
	let messaging_events = req.body.entry[0].messaging
	for (let i = 0; i < messaging_events.length; i++) {
		let event = messaging_events[0];
		let sender = event.sender.id;
		if (event.message && event.message.text) {
			let text = event.message.text
			botConnector.sendText(sender, "Hello " + USER_ID)
		}
	}
	res.sendStatus(200)
})

// start login
app.get('/', function(req, res){
  let code_url = code.url + '?' +querystring.stringify(code.qs)
  res.redirect(code_url)
})

// return to the facebook messenger page
app.get('/callback', function(req,res){
  token.form.code = querystring.parse(req.url)['/callback?code']
  request.post(token, function(error, response, body) {
    AUTH_INFO = JSON.parse(body)
    // console.log(AUTH_INFO['access_token'])
    ACCESS_TOKEN = AUTH_INFO['access_token']
    USER_ID = AUTH_INFO['user_id']
    REFRESH_TOKEN = AUTH_INFO['refresh_token']
    var Profile = getData.GetProfile(ACCESS_TOKEN, '-')
    // res.send(getData.GetProfile(ACCESS_TOKEN, '-'))
    // res.redirect(process.env.MESSENGER_URL);
    res.send(Profile)
  });
})

app.get('/stat', function (req, res) {
  console.log("this is the /index directory");
  res.render('pages/index', {user: user_identity});

});

app.get('/planning_page', function (req, res) {
  console.log("this is the dirname" + __dirname);

  res.render('pages/planning', {user: user_identity});
});


app.listen(app.get('port'), function(){
  console.log('the server is running on 5000');
})
