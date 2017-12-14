dc.calendarChart = function (parent, chartGroup) {

var thisYear = new Date().getFullYear();
var _chart = dc.marginMixin(dc.baseMixin({}));
var color;
var width = 900,
	height = 120,
	cellSize = 16; // cell size
	_chart.AVAILABLE_CLASS = "day-available";
	_chart.UNAVAILABLE_CLASS = "day-unavailable"
	_chart.SELECTED_CLASS = "day-selected";
	_chart.DESELECTED_CLASS = "day-deselected";
	_chart.OFFSET = 20;
	_chart.range = d3.range(thisYear, thisYear + 1);
	_chart.currDate = new Date();
	_chart.maxHeat = 10000;
	_chart.CLICKOnNoData = false;

var day = d3.time.format("%w"),
	week = d3.time.format("%U"),
	percent = d3.format(".1%"),
	format = d3.time.format("%Y-%m-%d"),
	fullMonth = d3.time.format("%b");

var dowMap = {
	"Sun" : 1,//"M","T","W","R","F","S"
	"Mon" : 2,
	"Tue" : 3,
	"Wed" : 4,
	"Thu" : 5,
	"Fri" : 6,
	"Sat" : 7
	};

_chart._doRedraw = function() {
	_chart._doRender();

	return _chart;
};

_chart._doRender = function () {
	d3.select("#"+ _chart.anchorName())
		.selectAll("svg")
		.remove();

	var svg = d3.select("#"+ _chart.anchorName())
		.selectAll("svg")
		.data(_chart.range)
		.enter().append("svg")
		.style("padding",'3px')
		.attr("width", width + _chart.margins().left + (cellSize * 3))
		.attr("height", height + _chart.margins().top + cellSize)
		.attr("class", "RdYlGn")
		.append("g")
		.attr("transform", "translate(" + _chart.margins().left + "," + _chart.margins().top + ")");

	svg.append("text")
		.attr("transform", "translate(-16," + cellSize * 3.5 + ")rotate(-90)")
		.style("text-anchor", "middle")
		.text(function(d) { return d; });//y axis year

	if(_chart.renderTitle()){
		var dowLabel = svg.selectAll('.dowLabel')
			.data(function(d){return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];})
			.enter().append("text")
			.attr('transform', function(d){

			return "translate(-15," + parseInt((cellSize * dowMap[d]) - 3) + ")";})
			.text(function(d) { return d; })
			.attr("style","font-weight : bold");
	}

	var rect = svg.selectAll(".day")
		.data(function(d) { return d3.time.days(new Date(d, 0, 1), new Date(d + 1, 0, 1)); })
		.enter()
		.append("rect")
		.attr("class", "day")
		.attr("width", cellSize)
		.attr("height", cellSize)
		.attr("x", function(d) { return week(d) * cellSize + _chart.OFFSET; })
		.attr("y", function(d) { return day(d) * cellSize; });
		//.datum(format);
		// .attr("data-ot",function(d){
		//   return d;
		// });

	if(_chart.renderTitle()){
		rect.append("title")
			.text(function(d) { return d; });
	}

	var monthLabel = svg.selectAll(".monthLabel")
		.data(function(d) { return d3.time.months(new Date(d, 0, 1), new Date(d + 1, 0, 1)); })
		.enter().append("text")
		.text(function(d){ return fullMonth(d);})
		.attr("x", function(d){return week(d) * cellSize + _chart.OFFSET/*+ cellSize*/;})
		.attr("y", -3)
		.attr("class","monthLabel");

	var data = d3.nest()
		.key(function(d) { return d.key; })
		.rollup(function(d) {
		return _chart.valueAccessor()(d);
		})
		.map(_chart.data());

		console.log(data);

	if(!color){
		color = d3.scale.quantize()
			.domain([0,_chart.maxHeat])
			.range(d3.range(11).map(function(d) {
				return "q" + d + "-11";
			}));
	}

	rect.filter(function(d) {
			var date = simpleDate(d);
			return date in data;
		})
		.attr("class", function(d) {
			var date = simpleDate(d);
			return "day " + color(data[date]); })
				.on('click', onClick);

	if(_chart.CLICKOnNoData){
	//	console.log(_chart.clickOnNoData);
		rect.filter(function(d) {
				var date = simpleDate(d);
				return !(date in data);
			})
			.attr("class", function(d) {
				var date = simpleDate(d);
				return "day " + color(data[date]); })
					.on('click', onClickNoData);
	}

		// .attr("data-ot",function(d){
		// 	var date = simpleDate(d);
		// 	return d + ": " + data[date].toFixed(2) + " Daily Average";
		// });

	if(_chart.renderTitle()){
		rect.filter(function(d) {
			var date = simpleDate(d);
			return date in data; })
		.select("title")
		.text(function(d) {
			var date = simpleDate(d);
			return date + ": " + data[date] + " cals";
		});
	}
	_highlightFilters();//ZX note : must do it here, shouldn't render only in redraw
	return _chart;
};

function onClick(d, i) {
	var dateClicked = simpleDate(d);
	_chart.currDate = dateClicked;
	_chart.group().all().forEach(function(datum){
		if(datum.key === dateClicked){
			//_chart.onClick(datum, i);//check source code here: //https://github.com/dc-js/dc.js/blob/develop/src/base-mixin.js
			//check for the reason of modification here:https://dc-js.github.io/dc.js/docs/html/dc.baseMixin.html#hasFilterHandler
			/*to be more specific, the reason is "Each toggle is executed by checking if the value is already present using the hasFilterHandler; if it is not present, it is added using the addFilterHandler; if it is already present, it is removed using the removeFilterHandler."*/
			var filter = _chart.keyAccessor()(datum);
			if(!_chart.hasFilter(filter))
        dc.events.trigger(function () {
        _chart.filter(filter);
				//console.log(_chart.hasFilter());
        _chart.redrawGroup();
      });
		}
	});
}

function onClickNoData(d, i) {
	var dateClicked = simpleDate(d);
	_chart.currDate = dateClicked;
	console.log(dateClicked);
	//can check https://github.com/dc-js/dc.js/blob/develop/src/base-mixin.js
	//here if we use code in onClick, since the === would never occur, nothing would happen basically cannot filter the
	dc.events.trigger(function () {
      _chart.filter(dateClicked);
      _chart.redrawGroup();
  });
}

function prefixZero(value) {
	var s = value + "";
	if(s.length === 1){
		return "0" + value;
	}else{
		return value;
	}
}

function simpleDate(date){
	return date.getFullYear() + "-" + prefixZero(date.getMonth() + 1) + "-" + prefixZero(date.getDate());
}

_chart.legendables = function () {
	// do nothing in base, should be overridden by sub-function
	return [];
};

_chart.legendHighlight = function (d) {
	// do nothing in base, should be overridden by sub-function
};

_chart.legendReset = function (d) {
	// do nothing in base, should be overridden by sub-function
};

_chart.legendToggle = function (d) {
	// do nothing in base, should be overriden by sub-function
};

_chart.isLegendableHidden = function (d) {
	// do nothing in base, should be overridden by sub-function
	return false;
};

//custom overrides for calendarChart since standard selected and deselected
//classes for DC make the chart look bad


_chart.highlightAvailable = function (e) {
	d3.select(e).classed(_chart.AVAILABLE_CLASS, true);
	d3.select(e).classed(_chart.SELECTED_CLASS, false);
	d3.select(e).classed(_chart.UNAVAILABLE_CLASS, false);
};

_chart.darkSelected = function (e) {
	d3.select(e).classed(_chart.AVAILABLE_CLASS, false);
	d3.select(e).classed(_chart.SELECTED_CLASS, true);
	d3.select(e).classed(_chart.UNAVAILABLE_CLASS, false);
};

_chart.fadeUnavailable = function (e) {
	d3.select(e).classed(_chart.AVAILABLE_CLASS, false);
	d3.select(e).classed(_chart.SELECTED_CLASS, false);
	d3.select(e).classed(_chart.UNAVAILABLE_CLASS, true);
};

_chart.resetAvailable = function (e) {
	d3.select(e).classed(_chart.AVAILABLE_CLASS, false);
	d3.select(e).classed(_chart.SELECTED_CLASS, false);
	d3.select(e).classed(_chart.UNAVAILABLE_CLASS, false);
};

_chart.rangeYears = function(range){
	_chart.range = d3.range(range[0], range[1]);
	return _chart;
}

_chart.currSelectedDate = function(date){
	_chart.currDate = date;
	return _chart;
}

_chart.clickOnNoData = function(clickOrNo){
	_chart.CLICKOnNoData = clickOrNo;
	return _chart;
}

var binSrcr = d3.bisector(function(d) { return d.key; }).left;//add mode selection to support both

function _highlightFilters() {
	if (_chart.hasFilter()) {//TODO try to use this to eliminate fake data
		//console.log('has filter!')
		var chartData = _chart.group().all();
		_chart.root().selectAll('.day').each(function (d) {
			var simpD = simpleDate(d), loc = binSrcr(_chart.data(), simpD), available = false;
			//console.log(loc);
			if(loc >= 0 && loc < _chart.data().length){
				if(_chart.data()[loc].key == simpD){
//					console.log(simpD);
					available = true;
				}
			}
			if (_chart.hasFilter(simpD)) {//add selected here
				_chart.darkSelected(this);
			} else if(available){
				console.log('true');
				_chart.highlightAvailable(this);
			}
			else {
				_chart.fadeUnavailable(this);
			}
		});
	}
	else {
			console.log('no filter!')
	  	_chart.root().selectAll('.day').each(function (d) {
	    _chart.resetAvailable(this);
	  });
	}
}

return _chart.anchor(parent, chartGroup);
};
