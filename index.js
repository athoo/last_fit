'use strict'

require('dotenv').config();
const express = require('express');
const querystring = require('querystring');
const dbHandler = require('./dbHandler')
const moment = require('moment');
const async = require('async')
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


app.get('/webhook/', function(req, res) {//XZNOTE: toask
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
  console.log(code_url)
  res.redirect(code_url)
})

// return to the facebook messenger page
app.get('/callback', function(req,res){
  console.log('USER login')
  let PARSEDQRY = querystring.parse(req.url)
  //console.log(PARSEDQRY)
  token.form.code = PARSEDQRY['/callback?code']  //in fact is not token. it's the code set which would be used to get token
    //XZ append
  request.post(token, function(error, response, body) {//post to front-end request
    AUTH_INFO = JSON.parse(body)
    ACCESS_TOKEN = AUTH_INFO['access_token']
    USER_ID = AUTH_INFO['user_id']
    REFRESH_TOKEN = AUTH_INFO['refresh_token']
    console.log('userID: '+USER_ID)        
    res.send('redirecting')    
  });
  //res.redirect('/getUserProfile')
});

app.get('/getUserProfile', function(req,res){
    console.log('get user profile ...')
    var Profile = getData.GetProfile(ACCESS_TOKEN, REFRESH_TOKEN, USER_ID)
});

app.get('/getactivity', function(req,res){
    console.log('req url:'+req.url)
    var date = (new Date()).toISOString().split('T')[0]
    console.log('date is' + date)
    var activity = getData.Get1dayActSeries3Resources1min(ACCESS_TOKEN, date, USER_ID)
});

app.get('/insertLabel', function(req,res){
    var toInsert = [['2017-09-2700:00:00','2017-09-2710:00:00','sleeping'],['2017-09-2709:00:00','2017-09-2713:30:00','swimming']]
    var toUpdate = [['2017-09-2700:00:00','2017-09-2710:00:00','laughing'],['2017-09-2709:00:00','2017-09-2713:30:00','swimming']]
    var createEssentialTables = dbHandler.createTables(USER_ID)
    console.log('insert data for user ' + USER_ID)
    createEssentialTables.then(()=>{
        dbHandler.updateLabels(USER_ID, toUpdate)
    })/*.then((results)=>{
        dbHandler.updateLabels(USER_ID, toUpdate)
    })*/
});

app.get('/stat', function (req, res) {
  console.log("this is the /index directory");
  res.render('pages/index', {user: user_identity});

});

app.get('/planning_page', function (req, res) {
  console.log("this is the dirname" + __dirname);

  res.render('pages/planning', {user: user_identity});
});


app.listen(app.get('port'), function(){
  console.log('the server is running on', app.get('port'));
})
