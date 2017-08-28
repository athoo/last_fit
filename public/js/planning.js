var baseUrl = "http://localhost:8080/api";
var id = $("#identity").text();

console.log("this is planning js");
console.log("id is " + id);

$(
    function () {

        $("#have_plan").on("click", function () {
            console.log("clicked have plan");

            // $( this ).after( "<p>Another paragraph! " + (++count) + "</p>" );
        });

        $("#no_plan").on("click", function () {
            console.log("no plan");
        })

        var labels_addr = baseUrl + "/labels/" + id;
        $.get(labels_addr, function (data) {
            var labels = JSON.parse(data)

            var table = "<table class='table table-hover table-striped'>";

            table += "<thead><th>Activity</th><th>From</th><th>To</th><th>Duration</th><th>Intensity(Steps)</th></thead><tbody id='labels'>";
// class='connectedSortable' 
            for (var i = 0; i < labels.length; i++) {

                var row =
                    "<tr class='label'>" +
                    "<td>" + labels[i]['activity'] + "</td>" +
                    "<td>" + labels[i]['start_point'] + "</td>" +
                    "<td>" + labels[i]['end_point'] + "</td>" +
                    "<td>" + labels[i]['duration'] + "</td>" +
                    "<td>" + labels[i]['steps'] + "</td>" +
                    "</tr>";
                table += row;
            }
            table += "</tbody></table>";


            $("#user_labels").append(table);

            $(".label").draggable({
                connectToSortable:".connectedSortable",
                helper: "clone",
                revert: "invalid"
            });

            $("#weekend, #weekday").sortable({
                // connectWith: ".connectedSortable"
            }).disableSelection();

        });
    }
)
// $.get( "ajax/test.html", function( data ) {
//   $( ".result" ).html( data );
//   alert( "Load was performed." );
// });