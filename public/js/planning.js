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
var labeldata;
var planSchedule = [];
// var data_summary = $("#data_summary").text();
// console.log(data_summary[0,10]);
// console.log(typeof(JSON.parse(data_summary)));


function overlap(currLbl, currentPlan) {
  return currentPlan.reduce(function(tot, curr){
    let earlyStart = curr.stime.toTimeString().split(' ')[0] <= (currLbl[0]).split(' ')[4],
    lateEnd = curr.etime.toTimeString().split(' ')[0] >= currLbl[1].split(' ')[4];
    return tot || (earlyStart
    && lateEnd);
  }, false);
}

var getStatUrl = `http://localhost:${port}/getPlan?userID=52KG66&sdate=2017-10-08&edate=2017-10-15&planset=A`;
//console.log(getStatUrl);

var data = d3.json(getStatUrl,
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

		var dateDim = exs.dimension(function (d) {
        //("%Y-%m-%d")
        return d.date;
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

  svg.selectAll(".bar").remove();
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

    //bars.exit().remove();
}

var generateLabels = function (user_id) {
  $('#labels').empty();//
  $('#addLabel').empty();
  $.get(`http://localhost:${port}/getLabel`, {'user_id': user_id}, function (data) {
    console.log(data[0]);
    //console.log(data.length);
    labeldata = data;
    for (item in data) {
      var labelInfo = data[item];
      console.log(labelInfo)
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
      //console.log(currLbl[0].split(' ')[4]);
      if(!overlap(currLbl, planSchedule)){//if can add this plan
          //constructing new plan
          let newPlanFromLbl = {};
          newPlanFromLbl.date = calendarChart.currDate;
          newPlanFromLbl.stime = parseTime(currLbl[0].split(' ')[4]);
          newPlanFromLbl.etime = parseTime(currLbl[1].split(' ')[4]);
          //TODO currently we use JSON.parse(labelArray)[0] as label name, don't consider multi-label
          newPlanFromLbl.planName = JSON.parse(currLbl[2])[0];//currLbl[2];
          newPlanFromLbl.intensity = (+currLbl[4])/(Math.round((newPlanFromLbl.etime - newPlanFromLbl.stime)/(1000*60)));
          console.log(currLbl);
          console.log(newPlanFromLbl);
          planSchedule.push(newPlanFromLbl);
          updateIntraday('redraw');
          //newPlanFromLbl.stime =
      } else {//error or promption
          console.log('arranged already!')
      }

    //  planSchedule = planSchedule.concat(plan4today1);
      //console.log(planSchedule);

      //updateIntraday('redraw');
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
    console.log("entered")
    $.post(`http://localhost:${port}/setPlan`, tosave, function (data) {
      console.log(data);
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
        //filter existed plan for today
            var plan4today1 = timeDim.filter([p_start_time, p_end_time]).top(Infinity)
        //    plan4today1.map((curr)=>{console.log(curr.stime)});

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
