'use strict'

require('dotenv').config();
const express = require('express')
const request = require('request')
const querystring = require('querystring')
const db_handler = require('./db_handler')
var moment = require('moment');
const bodyParser = require('body-parser')


var app = express();

app.set('port', (process.env.PORT || 5000))
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

var AUTH_INFO;
var ACCESS_TOKEN;
var REFRESH_TOKEN
var USER_ID


const code = {
  url: 'https://www.fitbit.com/oauth2/authorize',
  qs: {
    response_type: 'code',
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.CALLBACK_URL,
    expires_in: '604800',
    scope: 'activity heartrate location nutrition profile settings sleep social weight'
  }
}

const token = {
  headers: {
    'Authorization': process.env.AUTHORIZATION,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  url: 'https://api.fitbit.com/oauth2/token',
  form: {
    clientId: process.env.CLIENT_ID,
    grant_type: 'authorization_code',
    redirect_uri: process.env.CALLBACK_URL,
    code: ''
  }
};

let messenger_token = process.env.MESSENGER_TOKEN

app.get('/webhook/', function(req, res) {
	if(req.query['hub.verify_token'] === "blonde") {
		res.send(req.query['hub.challenge'])
    console.log('verified!')
  }
	res.send("Wrong token")
})

app.post('/webhook/', function(req, res) {
  console.log('post to the webhook')
	let messaging_events = req.body.entry[0].messaging
	for (let i = 0; i < messaging_events.length; i++) {
		let event = messaging_events[0];
		let sender = event.sender.id;
		if (event.message && event.message.text) {
			let text = event.message.text
			sendText(sender, "Text echo: " + text.substring(0, 100))
		}
	}
	res.sendStatus(200)
})


function sendText(sender, text) {
	let messageData = {text: text}
	request({
		url:"https://graph.facebook.com/v2.6/me/messages",
		qs: {access_token: messenger_token},
		method: "post",
		json: {
			recipient: {id: sender},
			message: messageData
		}
	}, function(error, response, body) {
		if (error) {
			console.log("sending error");
		} else if (response.body.error) {
			console.log("response body error")
		}
	})
}

// start login
app.get('/', function(req, res){
  var code_url = code.url + '?' +querystring.stringify(code.qs)
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
    // console.log(AUTH_INFO)
    GetProfile(ACCESS_TOKEN, '-')
    // console.log(GetProfile(ACCESS_TOKEN, '-'))
    // res.send(GetProfile(ACCESS_TOKEN, '-'))
    res.redirect(process.env.MESSENGER_URL);
  });
})

app.listen(app.get('port'), function(){
  // console.log('the server is running on 5000');
})

var GetProfile = function(AccessToken, UserId){
  const profile = {
    headers: {
      'Authorization':' Bearer ' + AccessToken
    },
    url: 'https://api.fitbit.com/1/user/'+ UserId +'/profile.json'
  };

  request.get(profile, function(error, response, body) {

    var Profile = JSON.parse(body)

    db_handler.CreateTable(USER_ID,AccessToken,REFRESH_TOKEN,moment().format(),body)
    return JSON.parse(body)
  })

}
