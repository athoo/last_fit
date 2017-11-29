//var weekdayView = dc.rowChart('#plan_weekday_view');
//var frequencyView = dc.pieChart('#plan_frequency_view');
var calendarChart = dc.calendarChart('#plan_calendar_view');
//var intradayView = dc.barChart('#intraday_plan');
//var width = document.getElementById('intraday_activity').offsetWidth;
var week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var parseDate = d3.time.format("%Y-%m-%d").parse;
var parseTime = d3.time.format("%H:%M:%S").parse;
var parseWhole = d3.time.format("%Y-%m-%dT%H:%M:%S").parse;
var activityLabels = ['Study', 'Walking', 'Lecture Time', 'Meeting', 'Running', 'Swimming', 'Walking the dog', 'Playing with children at the backyard'];
var id = $("#identity").text();
var port = $("#portNo").text();
var env = $("#environment").text();
var host;
if (env == 'development') {
    host = `localhost` + `:${port}`;
}
if (env === 'production') {
    host = 'health-companion-uiuc.azurewebsites.net';
}
//console.log(host);

var labeldata;
var planSchedule = [];
// var data_summary = $("#data_summary").text();
// console.log(data_summary[0,10]);
// console.log(typeof(JSON.parse(data_summary)));

function overlap(winA, winB) {
    let A1st = winA.etime <= winB.stime, B1st = winB.etime <= winA.stime;
    //console.log(curr, earlyStart || lateEnd);
    return !(A1st || B1st);
}

function compareStartTime(a,b) {
  if (a.stime < b.stime)
    return -1;
  if (a.stime > b.stime)
    return 1;
  return 0;
}

var binSrcr = d3.bisector(function(d) { return d.stime; }).left;
function binarySearch(ar, el, compare_fn) {//TODO use bisectRight or bisectLeft instead
  //  console.log(ar);
  //  console.log(el);
    var lo = 0;
    var hi = ar.length - 1;
    let cnt = 0;
    while (lo < hi && cnt < ar.length) {
        let mid = lo + (hi - lo >> 1);
        console.log(lo, mid, hi);
        var cmp = compare_fn(ar[mid], el);
        if (cmp < 0) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
  //      console.log(lo, mid, hi);
        cnt++;
    }
    if (compare_fn(ar[hi], el) < 0) {
      hi += 1;
    }
  //  console.log('finally get', hi);
    return hi;
}

var getStatUrl = `http://` + host + `/getPlan?userID=52KG66&sdate=2017-10-08&edate=2017-10-25&planset=A`;
//console.log(getStatUrl);
function getPlanFromDBAndRender(){
  var jsondata = d3.json(getStatUrl,
  	function (error, dataArr) {
  		var sumTmp = 0;
  		console.log(dataArr[0])

  		var data = [];
  		dataArr
  			// data
  			.forEach(function (x) {
          //startTime, endTime, planLblName(cal/minute), aveIntensity, **planSet**
  				var tmpX = {};
  				tmpX.date = (x[0].split('T')[0]);//ok without parseDate, if take intra-day view out
  				tmpX.stime = parseTime(x[0].split('T')[1]);//parseTime(x.time);
          tmpX.etime = parseTime(x[1].split('T')[1]);
          tmpX.intensity = (+x[3]);//*Math.round((tmpX.etime - tmpX.stime)/(1000*60));
          tmpX.planName = x[2];
          tmpX.weekDay = parseDate(tmpX.date).getDay();//(new Date(tmpX.date)).getDay();
  				var tmpD = new Date();
  				tmpD.setDate(tmpD.getDate() - tmpD.getDay() + 1);
  				tmpX.weekInMon = Math.ceil(tmpD.getDate()/7);
  				data.push(tmpX);
  			});
  		var exs = crossfilter(data);

  		var dateDim = exs.dimension(function (d) {
  			return d.date;
  		});
  		var exercise_all = dateDim.group().reduceSum(function (d) {
  			return d.intensity;
  		});
  		var minDate = dateDim.bottom(1)[0].date;
  		var maxDate = dateDim.top(1)[0].date;
    //  parseDate(maxDate).setDate(parseDate(maxDate).getDate() + 1);//otherwise cannot show the last date

  		var exerciseCount = dc.dataCount('#dc-data-count');
  		// var ndx = crossfilter(data);
  		var all = exs.groupAll();

  		exerciseCount
  			.dimension(exs)
  			.group(all)
  			.html({
  				some: '<strong>%filter-count</strong> selected out of <strong>%total-count</strong> records' +
  					' | <a href=\'javascript:dc.filterAll(); dc.renderAll();\'>Reset All</a>',
  				all: 'All records selected. Please click on the graph to apply filters.'
  			});

      var timeDim = exs.dimension((d)=>{return d.stime;})

  		console.log(maxDate)
      console.log(dateDim.top(1)[0].date)
      console.log(dateDim.top(1)[0].intensity)

      ////////////////////////  start draw intraday plan  /////////////////////
          var margin = {top: 10, right: 30, bottom: 20, left: 50},
          intraDChartWidth = 900,// - margin.left - margin.right,
          intraDChartHeight = 300;// - margin.top - margin.bottom;
          var svg = d3.select("#plan_intra_day").append("svg")
          .attr("width", intraDChartWidth + margin.left + margin.right)
          .attr("height", intraDChartHeight + margin.top + margin.bottom)
          .append("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

          var xScale = d3.time.scale().domain([parseTime('00:00:00'),parseTime('23:59:59')])
      .range([0,intraDChartWidth]);

          var yScale = d3.scale.linear().domain([10,0]).range([0,intraDChartHeight]);

          var xAxis = d3.svg.axis()
                  .orient("bottom")
                  .scale(xScale)
                  .tickFormat(d3.time.format("%H"));
          var yAxis = d3.svg.axis()
                  .orient("left")
                  .scale(yScale);

          svg.append("g")
      		  .attr("class", "y axis")
      		  .call(yAxis);

      	//bottom axis
        	svg.append("g")
        		.attr("class", "x axis")
        		.attr("transform", "translate(0,"+intraDChartHeight+")")
        		.call(xAxis);
      //////////////////////end drawing initial fig/////////////////////

  //I know this is very stupid, actually I tried using exit().remove() / remove().exit() and failed
  function updateIntraday(mode){
    //$("#plan_intra_day").empty();
  	//set domain for y axis

    console.log(planSchedule);
    let newYmax = d3.max(planSchedule, function(d){
  //    console.log(d.intensity);
      return d.intensity; });
    let oldYmax = yScale.domain()[0];
  //    console.log(newYmax,oldYmax)
    newYmax = newYmax > oldYmax ? newYmax : oldYmax;
  	yScale.domain([newYmax, 0 ]);
    yAxis.scale(yScale);

    svg.select('.y')
  		  .call(yAxis);

  	//get the width of each bar
    let dur = (xScale.domain()[1] - xScale.domain()[0]);
    let totMinutes = Math.round(dur/(1000*60));
    var unitx = xScale.range()[1]/totMinutes;

    //svg.selectAll(".bar").remove();
    //ZX note above is a key line!
  	var bars = svg.selectAll(".bar").data(planSchedule,function(d){return d.date+d.stime;});

  	bars.enter()
  		.append("rect")
  		.attr("class", "bar")
  		.attr("x", function(d, i){
          return xScale(d.stime)
       })
  		.attr("y", function(d){ return yScale( d.intensity); })
  		.attr("height", function(d,i){
        return intraDChartHeight - yScale( d.intensity);//100*i//
       })
  		.attr("width", (d,i)=>{
        return unitx*Math.round((d.etime - d.stime)/(1000*60))//100*i
      })
  		.attr("fill", function(d){
  			if(mode === 'redraw'){
  				return "rgb(251,180,174)";
  			}else{
  				return "rgb(179,205,227)";
  			}
  		})
      .call(d3.behavior.drag()
        .on("dragstart", function(d) {
  	        d3.event.sourceEvent.stopPropagation();//supress other event
            d.initx = xScale(d.stime);
        })
        .on("drag", function(d) {
          d3.select(this)
          .attr("x", d.lastx = Math.max(0, Math.min(intraDChartWidth - unitx*Math.round((d.etime - d.stime)/(1000*60)), d3.event.x)));
        })
        .on("dragend", function(d) {
          console.log(d.stime, d.etime);
          let minuteChg = Math.sign(d.lastx - d.initx)*Math.abs(d.lastx - d.initx)/unitx;//KCncWy3K3aZp
          console.log(minuteChg/60);
          d.stime.setMinutes(d.stime.getMinutes() + minuteChg);
          d.etime.setMinutes(d.etime.getMinutes() + minuteChg);
  //        console.log(planSchedule);
        })
      )
      .on("dblclick", function(e, i){
        console.log(e,i);
        planSchedule.splice(i, 1);
        //bars.exit().remove();
        updateIntraday('redraw');
      });

      bars.exit().remove();
  }

  var generateLabels = function (user_id) {
    $('#labels').empty();//
    $('#addLabel').empty();
    $.get(`http://` + host + `/getLabel`, {'user_id': user_id}, function (data) {
    //  console.log(data[0]);
      //console.log(data.length);
      labeldata = data;
      for (item in data) {
        var labelInfo = data[item];
      //  console.log(labelInfo)
        //TODO a brief version, only show labelInfo[2][0], not concatened labelInfo[2] items
        labelName = JSON.parse(labelInfo[2])[0];
        subjFeel = JSON.parse(labelInfo[5])[0];
        $('#labels').append(`<button class='btn btn-primary life-label' style='margin:5px;' value = ${item} >`
        //+`startTime = ${labelInfo[0]}, endTime = ${labelInfo[1]}, labelName = ${labelName}, cals = ${labelInfo[4]}, >`
         + `${labelName},\nin total ${labelInfo[3]} steps,
         consuming around ${labelInfo[4]} calorie,\n feeling ${subjFeel}` + "</button>");
      }
    });
    $('#labels').on("click", "button", function(){
        let currLbl = (labeldata[$(this).val()]);
        var newPlanFromLbl = {};
        newPlanFromLbl.date = calendarChart.currDate;
        newPlanFromLbl.stime = parseTime(currLbl[0].split(' ')[4]);
        newPlanFromLbl.etime = parseTime(currLbl[1].split(' ')[4]);
        //TODO currently we use JSON.parse(labelArray)[0] as label name, don't consider multi-label
        newPlanFromLbl.planName = JSON.parse(currLbl[2])[0];//currLbl[2];
        var dur = Math.round((newPlanFromLbl.etime - newPlanFromLbl.stime)/(1000*60));
        newPlanFromLbl.intensity = (+currLbl[4])/dur;
        console.log(newPlanFromLbl);
        var initLoc = binSrcr(planSchedule, newPlanFromLbl.stime);//binarySearch(planSchedule, newPlanFromLbl, compareStartTime);
        console.log(initLoc);
        //3 condition: no matter which one, the stime should be in a range(0,r)
        //we try from loc and stop if we find a non-overlapping window.
        var loc = -1, plnArrLen = planSchedule.length;
        //the best case is that we don't move it, and leave the stime as it was from label
        if (initLoc == 0 && (!plnArrLen||!overlap(newPlanFromLbl,planSchedule[0]))) {
          loc = 0;
        }else if(initLoc == plnArrLen && !overlap(newPlanFromLbl,planSchedule[plnArrLen - 1]) ){
          loc = plnArrLen;
        } else if(!overlap(newPlanFromLbl, planSchedule[initLoc]) && !overlap(newPlanFromLbl,planSchedule[initLoc-1])){
          loc = initLoc;
        }
      //  console.log(loc);
        if(loc !== -1){//don't need to move it
          planSchedule.splice(loc, 0, newPlanFromLbl);
          console.log(planSchedule);
          updateIntraday('redraw');
        }
        else{//initial location not feasible, need to move. try starting from initLoc and push towards both ends
          var frontEndTouched = false, backEndTouched = false, earliestStart, latestStart;
            let locTmp = initLoc, i = 0;

            function startRangeAt(loca) {
              let eStrt, lStrt;
              console.log(dur);
              if(loca == 0){
                console.log('insert at front end');
                eStrt = parseTime('00:00:00');
                lStrt = new Date (planSchedule[loca].stime);
                lStrt.setMinutes(lStrt.getMinutes() - dur);
              } else if(loca == plnArrLen){
                console.log('insert at back end');
                eStrt = new Date (planSchedule[loca - 1].etime);
                console.log(eStrt);
                lStrt = parseTime('23:59:59');
                lStrt.setMinutes(lStrt.getMinutes() - dur);
                console.log(lStrt);
              } else {// in between a certain period
                console.log('insert at middle position', loca);
                eStrt = new Date (planSchedule[loca - 1].etime);
                //eStrt.setMinutes(eStrt.getMinutes());
                console.log(eStrt);
                lStrt = new Date (planSchedule[loca].stime);
                lStrt.setMinutes(lStrt.getMinutes() - dur);
                console.log(lStrt);
              }
              return [eStrt, lStrt];
            }

            while(!frontEndTouched || !backEndTouched){
              locTmp = initLoc - i;
              if (locTmp >= 0){
                [earliestStart, latestStart] = startRangeAt(locTmp);
                console.log(earliestStart, latestStart);
                if(earliestStart < latestStart){
                  newPlanFromLbl.stime = new Date (earliestStart);
                  newPlanFromLbl.stime.setMinutes(newPlanFromLbl.stime.getMinutes()+Math.round((latestStart - earliestStart)/(2*1000*60)));
                  newPlanFromLbl.etime = new Date (newPlanFromLbl.stime);
                  newPlanFromLbl.etime.setMinutes(newPlanFromLbl.etime.getMinutes() + dur);
                  planSchedule.splice(locTmp, 0, newPlanFromLbl);
                  console.log(planSchedule);
                  updateIntraday('redraw');
                  break;
                }
              } else {
                frontEndTouched = true;
              }
              locTmp = initLoc + i;
              if (locTmp <= plnArrLen){
                [earliestStart, latestStart] = startRangeAt(locTmp);
                console.log(earliestStart, latestStart);
                if(earliestStart < latestStart){
                  newPlanFromLbl.stime = new Date (earliestStart);
                  newPlanFromLbl.stime.setMinutes(newPlanFromLbl.stime.getMinutes()+Math.round((latestStart - earliestStart)/(2*1000*60)));
                  newPlanFromLbl.etime = new Date (newPlanFromLbl.stime);
                  newPlanFromLbl.etime.setMinutes(newPlanFromLbl.etime.getMinutes() + dur);
                  planSchedule.splice(locTmp, 0, newPlanFromLbl);
                  console.log(planSchedule);
                  updateIntraday('redraw');
                  break;
                }
              } else {
                backEndTouched = true;
              }
              i++;
            }
            if(frontEndTouched&&backEndTouched){
              console.log('no feasible location!');
            }
          }
    });
  }

  generateLabels(id);

  var generateSubmitBtn = function(userID){
    $('#submit_plan_btn').empty();
    $('#submit_plan_btn').append(`<button type='button' class='btn btn-success' id='submit_plan' style='padding:10px 50px; text-align:center; margin:50px'>Submit Plan for ${calendarChart.currDate}</button>`);
    $('#submit_plan_btn').off().on("click", "button", function(){
      console.log(planSchedule);//if json stringify, the date format would change here!
      var plan2save = [];
      planSchedule.forEach((d)=>{
        let stm = d.date + 'T' + d.stime.toTimeString().split(' ')[0],
        etm = d.date + 'T' + d.etime.toTimeString().split(' ')[0],
        newPl = [stm, etm, d.planName, d.intensity, 'A'];
        plan2save.push(newPl)
      });
      //
      var tosave = {
        'userID': userID,
        'data':JSON.stringify(plan2save),
        'date':calendarChart.currDate
      };
      console.log("entered");
      $.post(`http://` + host + `/setPlan`, tosave, function (data) {
        exs.remove();
        exs.add(planSchedule);
      });
    });
  }

      //for valueAccessor's sake, must use this instead of reduceSum
  		var calendarGroup = dateDim.group().reduce(
  			(p,v)=>{
  				p.calAll += v.intensity;
  				return p;
  			},
  			(p,v)=>{
  				p.calAll -= v.intensity;
  				return p;
  			},
  			()=>{
  				return {calAll:0};
  			}
  		);

  		calendarChart.width(900)
          .height(130)
          .dimension(dateDim)
          .group(calendarGroup)
          .valueAccessor(function (p) {
              return p[0].value.calAll;
          })
          //.rangeMonth([9,10])
          .currSelectedDate(maxDate)
          .clickOnNoData(true)
          .renderTitle(true)
          .filter(maxDate)
          .on('renderlet', function (chart) {
            //empty intraday data and show what's in plan table of today
            //console.log(timeDim.group().top(Infinity))
            //console.log(timeDim.group().all())
            console.log(timeDim.bottom(1))//this is an array
            //console.log(calendarChart.currDate)
            planSchedule = [];//empty all current plan!
            if(timeDim.bottom(1).length){
              var p_start_time = new Date(timeDim.bottom(1)[0].stime);
      				var p_end_time = new Date(timeDim.top(1)[0].stime);
              p_end_time.setMinutes(p_end_time.getMinutes() + 1);
              console.log(p_start_time,p_end_time)
          //filter existed plan for today, ascending order
              var plan4today1 = timeDim.filter([p_start_time, p_end_time]).bottom(Infinity)
          //    plan4today1.map((curr)=>{console.log(curr.stime)});
              //console.log(plan4today1)
              planSchedule = planSchedule.concat(plan4today1);

            }

            let newYmax = d3.max(planSchedule, function(d){
              return d.intensity; });
            let defaultYdomain = 10;
            newYmax = newYmax > defaultYdomain ? newYmax : defaultYdomain;
          	yScale.domain([newYmax, 0 ]);
            yAxis.scale(yScale);

            updateIntraday('redraw');
            generateSubmitBtn(id);
            timeDim.filterAll();
          });

          calendarChart.addFilterHandler(function (filters, filter) {
      		    filters.length = 0; // empty the array
      		    filters.push(filter);
      		    return filters;
      		});//to make sure that only one day is selected

  		//mothChart,week,
  		//$(#)/.empty
      //update the figures on intraday fig.

  		dc.renderAll()

  	});
}

getPlanFromDBAndRender();
