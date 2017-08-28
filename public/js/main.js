var exerciseOverview = dc.barChart("#exercise_overview");
var weekdayView = dc.rowChart('#weekday_view');
var frequencyView = dc.pieChart('#frequency_view');
var intradayView = dc.barChart('#intraday_activity');
var width = document.getElementById('exercise_overview').offsetWidth;
var week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var parseDate = d3.time.format("%Y-%m-%d").parse;
var parseTime = d3.time.format("%H:%M:%S").parse;
var activityLabels = ['Study', 'Walking', 'Lecture Time', 'Meeting', 'Running', 'Swimming', 'Walking the dog', 'Playing with children at the backyard'];
var baseUrl = "http://localhost:8080/api";
var id = $("#identity").text();
// var data_summary = $("#data_summary").text();
// console.log(data_summary[0,10]);
// console.log(typeof(JSON.parse(data_summary)));

// var data = d3.json("./modified_steps_summary.json",
var data = d3.json(baseUrl + "/summary/" + id,
	function (error, data) {
		// console.log(data[0]['id']);

		// console.log(data[0]['summary']);
		data[0]['summary']
			// data
			.forEach(function (x) {
				x.steps_value = +x.steps_value;
				x.dateTime = parseDate(x.dateTime);
				x.time = parseTime(x.time);
				x.steps_all = +x.steps_all;
				x.weekDay = x.dateTime.getDay();
				// console.log(x);
			});

		var exs = crossfilter(data[0]['summary']);
		var dateDim = exs.dimension(function (d) {
			return d.dateTime;
		});
		var exercise_all = dateDim.group().reduceSum(function (d) {
			return d.steps_value;
		});
		var minDate = dateDim.bottom(1)[0].dateTime;
		var maxDate = dateDim.top(1)[0].dateTime;


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

		exerciseOverview
			.width(width).height(200)
			.dimension(dateDim)
			.group(exercise_all)
			.x(d3.time.scale().domain([minDate, maxDate]))
			.elasticY(true)
			.elasticX(true)
			.xUnits(function () {
				return 100;
			})
			.brushOn(true)
			.on('renderlet', function (chart) {
				chart.selectAll('rect').on("click", function (d) {
					console.log("click!", d);
				});
			});

		$("#data-brush").on('click', function (d) {
			if (exerciseOverview.brushOn() == false) {
				exerciseOverview.brushOn(true);
				d.target.innerHTML = "Turn off data brush";
			} else {
				exerciseOverview.brushOn(false);
				d.target.innerHTML = "Turn on data brush";
			};
			dc.renderAll()
		});

		var generateLabels = function () {
			$('#labels').empty();
			$('#addLabel').empty();
			for (item in activityLabels) {
				$('#labels').append("<button class='btn btn-primary life-label' style='margin:5px;'>" + activityLabels[item] + "</button>");
			}
			$('#addLabel').append("<input type='text' id='newLabel' placeholder='Walking to Shopping Mall'></input>");
			$('#addLabel').append("<input type='button' class='btn' id='submitLabel' value='Submit New Label'></input>");
		}

		var uploadLabel = function (user_id, activity, start_point, end_point, duration, steps_value_start_end) {
			var label = {
				'user_id': user_id,
				'activity': activity,
				'start_point': start_point,
				'end_point': end_point,
				'duration': duration,
				'steps': steps_value_start_end
			}

			$.post(baseUrl + "/labels", label, function (data) {
				console.log(data.user_id);
				console.log(data.duration);
			}, "json");
		}


		var weekDayDim = exs.dimension(function (d) {
			return 'day' + '.' + week[d.weekDay];
		});
		var weekDayGroup = weekDayDim.group().reduceSum(function (d) {
			return d.steps_value;
		});

		weekdayView
			.width(width).height(300)
			.dimension(weekDayDim)
			.group(weekDayGroup)
			.elasticX(true)
			.label(function (d) {
				return d.key.split('.')[1];
			})
			.xAxis()
			.ticks(4);

		var exerciseDim = exs.dimension(function (d) {
			return d.steps_all;
		});
		var exerciseGroup = exerciseDim.group(function (d) {
			return Math.floor(d / 3000) * 3000;
		}).reduceCount();
		// var minExercise = exerciseDim.bottom(1)[0].steps_all;
		// var maxExercise = exerciseDim.top(1)[0].steps_all;

		frequencyView
			.width(width).height(400)
			.dimension(exerciseDim)
			.group(exerciseGroup)
			.innerRadius(100)
			.legend(dc.legend());

		var intradayDim = exs.dimension(function (d) {
			return d.time;
		});

		// var aggre_value = 0;

		var intradayGroup = intradayDim.group().reduceSum(function (d) {

			// aggre_value = aggre_value + d.steps_value;

			return d.steps_value;
		});
		var start_time = intradayDim.bottom(1)[0].time;
		var end_time = intradayDim.top(1)[0].time;


		intradayView
			.dimension(intradayDim)
			.group(intradayGroup)
			.xAxisLabel("Intraday activities")
			.elasticY(true)
			.elasticX(true)
			.brushOn(true)
			.x(d3.time.scale().domain([start_time, end_time]))
			.on('renderlet', function (chart) {

				generateLabels();

				console.log(chart.brush().extent());

				start_time = intradayDim.bottom(1)[0].time;
				end_time = intradayDim.top(1)[0].time;

				var steps_value_start_end = intradayDim.filter([start_time, end_time]).top(Infinity)
				.reduce(function(prev, curr) {
					return prev+parseInt(curr.steps_value);
				}, 0);
				
				console.log(steps_value_start_end);
			
				var start_point = start_time.toLocaleTimeString();

				var end_point = end_time.toLocaleTimeString();

				var duration = Math.round((end_time - start_time) / 60000);

				$('#submitLabel').on('click', function () {
					if ($('#newLabel').val().match(/\S/) && start_point !== "06:00:00 AM" && end_point !== "10:00:00 PM") {
						activityLabels.push($('#newLabel').val());
						$('#labels').append("<button class='btn btn-primary life-label' style='margin:5px;'>" + $('#newLabel').val() + "</button>");
						uploadLabel(id, $('#newLabel').val(), start_point, end_point, duration, steps_value_start_end);
						// var label = {
						// 	'user_id': $('#newLabel').val(),
						// 	'start_point': start_point,
						// 	'end_point': end_point,
						// 	'duration': duration
						// }

						// $.post(baseUrl + "/labels", label, function (data) {
						// 	console.log(data.user_id);
						// 	console.log(data.duration);
						// }, "json");

						// console.log([$('#newLabel').val(), start_point, end_point, duration]);

					} else {
						alert("Please type in the activity before hit the submit button!");
					}
				});

				$('.life-label').on('click', function (d) {

					if (d.target.innerText.match(/\S/) && start_point !== "06:00:00 AM" && end_point !== "10:00:00 PM") {
						// console.log([d.target.innerText, start_point, end_point, duration]);
						// var label = {
						// 	'user_id': d.target.innerText,
						// 	'start_point': start_point,
						// 	'end_point': end_point,
						// 	'duration': duration
						// }

						// $.post(baseUrl + "/labels", label, function (data) {
						// 	console.log(data.user_id);
						// 	console.log(data.duration);
						// }, "json");
						uploadLabel(id, d.target.innerText, start_point, end_point, duration, steps_value_start_end);


					} else {
						alert("Please select the time interval before hit the activity!");
					}

					// Add listener to object?
					// var plan = '<p class="tasks">' + d.target.innerText + '&nbsp;&nbsp;From: ' + intradayDim.bottom(1)[0].time.toLocaleTimeString(navigator.language, {
					// 		hour: '2-digit',
					// 		minute: '2-digit'
					// 	})
					// 	.replace(/(:\d{2}| [AP]M)$/, "") + '&nbsp;&nbsp;To: ' + intradayDim.top(1)[0].time.toLocaleTimeString(navigator.language, {
					// 		hour: '2-digit',
					// 		minute: '2-digit'
					// 	})
					// 	.replace(/(:\d{2}| [AP]M)$/, "") + '</p>'
					// $('#taskPlan').append(plan);
					// console.log(d.target.innerText);
					// console.log(plan);
				});

			});


		dc.renderAll()

	});