'use strict'

require('dotenv').config();
const express = require('express');
const querystring = require('querystring');
const dbHandler = require('./dbHandler')
const moment = require('moment');
//const async = require('async')
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
  let PARSEDQRY = querystring.parse(req.url.split('?')[1])
  //console.log(PARSEDQRY)
  token.form.code = PARSEDQRY['code']  //in fact is not token. it's the code set which would be used to get token
    //XZ append
  request.post(token, function(error, response, body) {//post to front-end request
    AUTH_INFO = JSON.parse(body)
    ACCESS_TOKEN = AUTH_INFO['access_token']
    USER_ID = AUTH_INFO['user_id']
    REFRESH_TOKEN = AUTH_INFO['refresh_token']
    getData.saveProfile(ACCESS_TOKEN, REFRESH_TOKEN, USER_ID)
    //var memberSince = dbHandler.getMemberSinceDate(USER_ID)
    //console.log('member since: '+USER_ID)
    /*var act = getData.get1dayActFromFitbitAPI(ACCESS_TOKEN, '2017-09-30', 'calories','13:30', '14:00')
    act.then((value)=>{
        console.log(value)
    })*/
    /*var fullData = getData.getActDataFromFitbitAPI(['steps','calories'], ACCESS_TOKEN, '2017-09-30', '2017-10-15', [0,1,3],['10:30','14:00'])
    fullData.then(value=>{
        console.log(value)
    }).catch(reason=>{console.log('reason here:'+reason)})*/

    res.send('redirecting')
  });
  //res.redirect('/getUserProfile')
});

app.get('/getUserProfile', function(req,res){
    console.log('get user profile ...')
    let PARSEDQRY = querystring.parse(req.url.split('?')[1])
    var userID = PARSEDQRY['userid']
    var userProfile = dbHandler.getProfile(userID)
    userProfile.then((value)=>{
        console.log('user profile fetched:')
        console.log(value)
        res.send('user profile fetched')
    })
});

//TODO we cannot make sure all data of date before lastLogin saved , if it was long long ago
//http://localhost:5000/getactivity?userid=52KG66&resourceType=steps&daysBefore=2&today=2017-10-01
app.get('/getactivity', function(req,res){
    let PARSEDQRY = querystring.parse(req.url.split('?')[1])
    var userID = PARSEDQRY['userid']
    var daysBefore = PARSEDQRY['daysBefore']
    var resourceType = PARSEDQRY['resourceType']
		var daysFilter = PARSEDQRY['daysFilter']
		var today = new Date(PARSEDQRY['today'])
		today = today.toISOString().split('T')[0]
		//var hoursFilterStart = PARSEDQRY['startTime']
		//var hoursFilterEnd = PARSEDQRY['endTime']
    //console.log(PARSEDQRY)
    //console.log('req url:'+req.url)
    var yesterday = new Date(PARSEDQRY['today'])
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday = yesterday.toISOString().split('T')[0]
    var aMonAgo = new Date(PARSEDQRY['today'])
    aMonAgo.setDate(aMonAgo.getDate() - daysBefore)
    aMonAgo = aMonAgo.toISOString().split('T')[0]
    //should get from url
		console.log('yesterday is ' + yesterday + 'aMonAgo is ' + aMonAgo)
    var dayFilter = daysFilter === 'weekends' ? [6,0] : (daysFilter === 'weekdays' ? [1,2,3,4,5] : [])
    var hourFilter = ['11:00','14:30']//[hoursFilterStart,hoursFilterEnd]

    var lastLogin = dbHandler.getLastLogin(userID)//could be a date or a label meaning "1st time, no data saved"
    var tok = dbHandler.getToken(userID)//access token

    Promise.all([tok, lastLogin]).then(values=>{
        console.log('lastLogin:' + values[1])
        var unsavedStartDate = values[1] > aMonAgo ? values[1] : aMonAgo//lastLogin = 0 if no data saved, we don't use memberSinceDate here, coz aMonAgo could be any date (even actually no data available for pre-membership dates)
        /*var oneDayBeforeLastLogin = new Date(values[1])
        oneDayBeforeLastLogin.setDate(oneDayBeforeLastLogin.getDate() - 1)
        //oneDayBeforeLastLogin = oneDayBeforeLastLogin.toISOString().split('T')[0]
				console.log("one day before lastLogin is:" + oneDayBeforeLastLogin)*/
        //with lastLogin = 0 if no data saved, we don't query local DB either DB empty or lastLogin too long time ago
				console.log(`savedAct : [${aMonAgo}, ${values[1]}), online data from [${unsavedStartDate}, ${today})`)
				var savedAct = dbHandler.getActDataFromLocalDB(userID, resourceType, aMonAgo,values[1],dayFilter, hourFilter)
				//get data and save through background operation, unsavedDates to render to user at once, but need to save all data (as opposed to filtered dates)
        var newAct = getData.getActDataFromFitbitAPI(resourceType, values[0], unsavedStartDate, today, dayFilter, hourFilter)
				//considering that we want to give data to user as soon as possible, we do the save-newly-fetch-data separately
        Promise.all([savedAct, newAct]).then(vals=>{
					if(vals[0] == undefined) {
							console.log('no saved data:' + vals[0])
							res.send(vals[1])
					} else {
						  res.send(vals[0].concat(vals[1]));
					}
            //res.send(vals[0].concat(vals[1]));
        }).catch(reason=>{console.log('err when wait for savedAct and newAct'+reason)})
				//if lastLogin == today, then unsavedStartDate == today, so in saveFitbitAct2Local, no date would be filtered out
        lastLogin.then(()=>{
					return getData.saveFitbitAct2Local(userID, values[0], unsavedStartDate, today);
				}).then(()=>{
					console.log('start updating lastLogin')
					dbHandler.updateLastLogin(userID,today);
				})
    })
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

//get data from Fitbit API
//test what if startDate > endDate
//http://localhost:5000/getactFitbitAPI?userid=52KG66&resourceType=calories
app.get('/getactFitbitAPI', function(req,res){
    let PARSEDQRY = querystring.parse(req.url.split('?')[1])
    var userID = PARSEDQRY['userid']
    var resourceType = PARSEDQRY['resourceType']
		var daysFilter = PARSEDQRY['daysFilter']
		var startDate = '2017-09-29'
		var endDate = '2017-09-30'
		var dayFilter = daysFilter === 'weekends' ? [6,0] : (daysFilter === 'weekdays' ? [1,2,3,4,5] : [])
    var tok = dbHandler.getToken(userID)//access token
    tok.then((value)=>{
				var newAct = getData.getActDataFromFitbitAPI(resourceType, value, startDate, endDate, dayFilter)
        //console.log('access token:' + value)
        //var act = getData.get1dayActFromFitbitAPI(value, '2017-10-01', 'steps','07:00', '23:10')
        newAct.then((value)=>{
						console.log('getactFitbitAPI data dim' + value.length)
            console.log(value)
        })
    })
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
