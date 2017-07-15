'use strict'

require('dotenv').config();
const express = require('express')
const request = require('request')
const querystring = require('querystring')
var app = express();
var AUTH_INFO;
var ACCESS_TOKEN;

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

// start login
app.get('/', function(req, res){
  var code_url = code.url + '?' +querystring.stringify(code.qs)
  console.log(code_url)
  res.redirect(code_url)
})

// return to the facebook messenger page
app.get('/callback', function(req,res){
  token.form.code = querystring.parse(req.url)['/callback?code']
  console.log(token);
  request.post(token, function(error, response, body) {
    AUTH_INFO = JSON.parse(body)
    console.log(AUTH_INFO['access_token'])
    ACCESS_TOKEN = AUTH_INFO['access_token']
    GetProfile(ACCESS_TOKEN, '-')
    res.redirect(process.env.MESSENGER_URL);
  });
})

app.listen(5000, function(){
  console.log('the server is running on 5000');
})

var GetProfile = function(AccessToken, UserId){
  const profile = {
    headers: {
      'Authorization':' Bearer ' + AccessToken
    },
    url: 'https://api.fitbit.com/1/user/'+ UserId +'/profile.json'
  };

  request.get(profile, function(error, response, body) {
    // console.log(typeof(body))
    return JSON.parse(body)
  })

}
