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
const utils = require('./utils.js');

const app = express();

app.set('port', (process.env.PORT || 5000));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(express.static(__dirname + '/.'));
app.use(express.static(__dirname + '/public'));//app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

let code = authorization.code;
let token = authorization.token;

let AUTH_INFO;
let ACCESS_TOKEN;
let REFRESH_TOKEN;
let USER_ID;

app.get('/testtesttest/', function(req, res) {// test
    res.writeHead(200, {"Content-Type": "text/plain"});
    res.end("Hello World!");
})


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
  console.log('logged in. redirect to :'+code_url)
  res.redirect(code_url)
})

// return to the facebook messenger page
app.get('/callback', function(req,res){
	req.connection.setTimeout( 1000 * 60 );
  console.log('USER login to callback')
  let PARSEDQRY = querystring.parse(req.url.split('?')[1]);
  //console.log(PARSEDQRY)
  token.form.code = PARSEDQRY['code'];  //in fact is not token. it's the code set which would be used to get token
    //XZ append
  request.post(token, function(error, response, body) {//post to front-end request
    AUTH_INFO = JSON.parse(body);
    ACCESS_TOKEN = AUTH_INFO['access_token'];
    USER_ID = AUTH_INFO['user_id'];
    REFRESH_TOKEN = AUTH_INFO['refresh_token'];
    getData.saveProfile(ACCESS_TOKEN, REFRESH_TOKEN, USER_ID).then(()=>{
			res.render('pages/index', {user: USER_ID, port:app.get('port')});
			//console.log('SHOULD have saved Profiles now!');
			//res.redirect('http://localhost:5000/getactivity?userid=52KG66&daysBefore=2&today=2017-10-01');
		})
  });
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

//http://localhost:5000/getactivity?userid=52KG66&daysBefore=2&today=2017-10-01
app.get('/getactivity', function(req,res){
		//req.connection.setTimeout( 1000 * 60);
    let PARSEDQRY = querystring.parse(req.url.split('?')[1])
    var userID = PARSEDQRY['userid']
    var daysBefore = PARSEDQRY['daysBefore']
    var resourceType = ['steps','calories']// since we get all resource type, and LET THE FRONT END DO THE FILTERING, we won't pick up a single one here
	//	var daysFilter = PARSEDQRY['daysFilter']
		var today = new Date(PARSEDQRY['today'])
		today = today.toISOString().split('T')[0]
		//var hoursFilterStart = PARSEDQRY['startTime']
		//var hoursFilterEnd = PARSEDQRY['endTime']
    var yesterday = new Date(PARSEDQRY['today'])
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday = yesterday.toISOString().split('T')[0]
    var aMonAgo = new Date(PARSEDQRY['today'])
    aMonAgo.setDate(aMonAgo.getDate() - daysBefore)
    aMonAgo = aMonAgo.toISOString().split('T')[0]
		console.log('yesterday is ' + yesterday + 'aMonAgo is ' + aMonAgo)
//    var dayFilter = daysFilter === 'weekends' ? [6,0] : (daysFilter === 'weekdays' ? [1,2,3,4,5] : [])
		var dayFilter = [] // we do the filtering on frontend
    //var hourFilter = ['11:00','14:30']//[hoursFilterStart,hoursFilterEnd]

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
				var savedAct = dbHandler.getActDataFromLocalDB(userID, resourceType, aMonAgo,values[1],dayFilter);//, hourFilter)
				//get data and save through background operation, unsavedDates to render to user at once, but need to save all data (as opposed to filtered dates)
        var newAct = getData.getActDataFromFitbitAPI(['steps','calories'], values[0], unsavedStartDate, today, dayFilter);//, hourFilter)
				//considering that we want to give data to user as soon as possible, we do the save-newly-fetch-data separately
        Promise.all([savedAct, newAct]).then(vals=>{
					if(vals == undefined || typeof(vals) === undefined){
						console.log('vals undefined')
					}
					if(vals[0] == undefined) {
							console.log('trie to get saved data, but undefined returned:' + vals[0])
							res.send(utils.filterOnActArr(vals[1]));//,hourFilter))
					} else {//if no saved data,vals[0] should be [] here
							console.log('vals length : ' + vals.length);
							console.log('types:' + typeof(vals[0]), typeof(vals[1]));
							console.log('lengths:' + vals[0].length + ', ' + vals[1].length);
							var concatData = vals[0].concat(utils.filterOnActArr(vals[1]));
							console.log('length of concatenated data:' + concatData.length);
							res.send(concatData);//,hourFilter)));
							res.end();
					}
            //res.send(vals[0].concat(vals[1]));
        }).catch(reason=>{
					console.log('err when wait for savedAct and newAct'+reason)
				});
			//	savedAct.then(val=>{console.log('savedAct got : ' + val.length)}).catch(reason=>{console.log('savedAct value wrong' + reason)})
			//	newAct.then(val=>{console.log('newAct got : ' + val.length)}).catch(reason=>{console.log('newAct value wrong' + reason)})
				//if lastLogin == today, then unsavedStartDate == today, so in saveFitbitAct2Local, no date would be filtered out
        Promise.all([lastLogin,newAct]).then((vals)=>{
					console.log('tosave')
					console.log(vals[1].length + " items")
					return dbHandler.save2DB(userID, 'activity',2, vals[1]);
				}).then(()=>{
					console.log('start updating lastLogin')
					if(lastLogin < today){
						dbHandler.updateLastLogin(userID,today);
					}
				}).catch(reason=>{
					console.log('error when try to save data and update the lastLogin '+reason)
				})
    }).catch(reason=>{console.log('ERROR in getactivity: at least one of tok & lastLogin is not available')})
});
//http://localhost:5000/insertLabel
//if don't want to update a certain term ,should pass '' as the value of that column
app.post('/insertLabel', function(req,res){
		var label = req.body;
		var userID = label.user_id,
				sTime = label.periodStart,
				eTime = label.periodEnd,
				lblN = label.labelName,
				steps = label.steps,
				cal = label.cals,
				subj = label.subjTag;
		dbHandler.updateLabels(userID, [[sTime, eTime, lblN, steps, cal, subj]]).then(()=>{
			res.send('ok, label saved');
			res.end();
			console.log('new label recorded');
		}).catch(reason=>{console.log('failed to record new label: ',reason)});
});

app.get('/getLabel',function(req,res){
	dbHandler.queryLabels(req.query.user_id).then(val=>{
	//	console.log(val);
		res.send(val);
		res.end();
		//return val;
	}).catch(reason=>{ console.log('fail to get labels: ', reason); });
});

//get data from Fitbit API
//test what if startDate > endDate
//http://localhost:5000/getactFitbitAPI?userid=52KG66&resourceType=calories
app.get('/getactFitbitAPIusing1dayfunc', function(req,res){
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

//get data from Fitbit API
//test what if startDate > endDate
//http://localhost:5000/getactFitbitAPI?userid=52KG66&resourceType=calories
app.get('/getactFitbitAPIcontinuous', function(req,res){
    let PARSEDQRY = querystring.parse(req.url.split('?')[1])
    var userID = PARSEDQRY['userid']
    var resourceType = PARSEDQRY['resourceType']
		var daysFilter = PARSEDQRY['daysFilter']
		var startDate = '2017-09-29'
		var endDate = '2017-09-30'
    var tok = dbHandler.getToken(userID)//access token
    tok.then((value)=>{
				var newAct = getData.getActInPeriodFromFitbitAPI(value, userID, startDate, endDate, resourceType)
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
