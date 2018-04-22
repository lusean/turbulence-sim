var width = 1000;
var height = 700;
var active = d3.select(null);

var tog = false;

var projection = d3.geoMercator()
  .scale(2 * (width - 3) / (Math.PI))
  .translate([1.5 * width, 1.125 * height]);

var path = d3.geoPath() // updated for d3 v4
  .projection(projection);

/*
var container = d3.select("body")
  .append("div")
  .attr("class", "grabbable");
*/

var svg = d3.select("svg");

var zoom = d3.zoom()
  .scaleExtent([1, 8])
  .on("zoom", zoomed);

svg.call(zoom);

svg.append("rect")
  .attr("class", "background")
  .attr("width", width)
  .attr("height", height)
  .on("click", reset);

var layer1 = svg.append('g');
var layer2 = svg.append('g');
var layer3 = svg.append('g');

var planeString = "";

function ready(error, us, airports, plane) {
  if (error) throw error;

  planeString = plane.path;

  // Creates a legend for the color scale
  makeColorLegend(height - 60, width - 325, 300, 15, 0.75, colorScale);

  var doReports = true;
  var doFlights = true;

  // Initialize data
  setMapData(us, airports);
  updateLiveData(doReports, doFlights);

  // Update data every 10 seconds
  setInterval(function(){
    updateLiveData(doReports, doFlights);
  }, 5000);
}

/**
 * Creates a rectangular gradient color legend
 * @param top top coordinate of the legend
 * @param left left coordinate of the legend
 * @param width width of the ledend
 * @param height height of the legend
 * @param maxVal maximum input value of the color function
 * @param colorFun coloring function
 */
function makeColorLegend(top, left, width, height, maxVal, colorFun) {
  /*
  var rects = svg.selectAll(".rects")
    .data(d3.range(width))
    .enter()
    .append("rect")
    .attr("y", top)
    .attr("height", height)
    .attr("x", (d, i) => left + i)
    .attr("width", 2)
    .attr("fill", d => colorFun(maxVal / width * d));
  */

  svg.append("g")
    .attr("class", "legendSequential")
    .attr("transform", "translate(" + left.toString() + "," + top.toString() + ")");

  var legendSequential = d3.legendColor()
    .shapeWidth(width / 4)
    .shapeHeight(height)
    .cells(4)
    .orient("horizontal")
    .scale(colorFun)
    .title("Turbulence Intensity Scale")
    .labels(["Low", "Moderate", "Severe", "Extreme"])
    .labelFormat(d3.format(".2f"))

  svg.select(".legendSequential")
    .call(legendSequential);
}

function setMapData(us, airports) {
  layer1.selectAll("path")
    .data(us.features)
    .enter().append("path")
    .attr("d", path)
    .attr("class", "feature");

  layer1.append("path")
    .datum(topojson.mesh(us, us.features, function(a, b) { return a !== b; }))
    .attr("class", "mesh")
    .attr("d", path);

  // Uncomment to see all of the airports
  // g.append("path")
  //     .datum(topojson.feature(airports, airports.objects.airports))
  //     .attr("class", "points")
  //     .attr("d", path);
}


/**
 * Updates the live map data
 * @param reports whether or not to add weather reports
 * @param aircraft whether or not to add aircraft
 */
function updateLiveData(reports, aircraft) {
    if (reports) {
      makeQuery(-1, 1, 'reports', makeTurbulence);
    }
    if (aircraft) {
      makeQuery(-1, 1, 'flights', makeFlights);
    }
}

/**
 * Makes call to retrieve information from server
 * @param max the maximum number of rows of information to receive back
 * @param start the starting index of information
 * @param table the type of table from which to retrieve information
 * @param callback the function to call with the response results
 */
function makeQuery(max, start, table, callback) {
    var xhttp = new XMLHttpRequest();
    var url = "http://127.0.0.1:8000/query";
    var params;
    if (max > 0) {
      params = queryString({"max": max, "start": start, "table": table});
    } else {
      params = queryString({"start": start, "table": table});
    }
    url = url + params;
    xhttp.onreadystatechange = processRequest;
    function processRequest() {
      if (xhttp.readyState === 4 && xhttp.status === 200) {
        var response = JSON.parse(xhttp.response);
        callback(response.entries);
      }
    }
    xhttp.open("GET", url, true);
    xhttp.send();
}

/**
 * Generates a GET request string with the given arguments
 * @param args dictionary with entries form name: value, where name is a GET
               request argument name, and value is its value
 */
function queryString(args) {
  var first = true;
  var str = "";
  for (var arg in args) {
    if (first) {
      first = false;
      str = str + "?" + arg + "=" + args[arg]
    } else {
      str = str + "&" + arg + "=" + args[arg]
    }
  }
  return str;
}

/**
 * Color scale yellow to red
 * t in range of [0, 1]
 */
var colorScale = d3.scaleLinear()
  .domain([0, 1]) //can change domain
  .range(["yellow", "red"]);

/**
 * Adds turbulence information to the map
 * @param reports the weather reports to be displayed on the map
 */
function makeTurbulence(reports) {
  layer2.selectAll("#report").remove();
  layer2.selectAll("circle")
    .data(
      reports.map(r => [projection([r.longitude, r.latitude]), r.tke, r.time])
             .filter(a => a[0] !== null)
    ).enter()
    .append("circle")
    .attr("id", "report")
    .attr("fill", function (x) { return colorScale(x[1]); })
    .attr("cx", function (x) { return x[0][0]; })
    .attr("cy", function (x) { return x[0][1]; })
    .attr("r", 8)
    .attr("opacity", 1.0)
    .on("mouseover", reportTooltip.show) // Add mouse hover tooltip listeners
    .on("mouseout", reportTooltip.hide);
}

/**
 * Adds flight data to the map
 * @param flights the aircraft flights to be displayed on the map
 */

function makeFlights(flights) {
  layer3.selectAll("#flight").remove();

  layer3.selectAll("path")
    .data(
      flights.map(r => [projection([r.longitude, r.latitude]), r.bearing])
             .filter(x => x[0] !== null)
    ).enter()
    .append("path")
    .attr("id", "flight")
    .attr("d", planeString)
    .attr("fill", "black")
    .attr("transform", function (x) {
      return "translate(" + x[0][0] + "," + x[0][1] + ") rotate(" + x[1] + ") scale(0.25)"; });
}

var reportTooltip = d3.tip()
  .attr("class", "d3-tip")
  .offset([-12, 0])
  .html(function(d) {
    inv = projection.invert(d[0]);
    time = new Date(d[2]);
    var timeOptions = {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    };
    if (tog == true) {
      return "<h5 style='color:white'>(" + inv[1].toFixed(4) + ", " + inv[0].toFixed(4) + ")<h5>"
        + "<h5 style='color:white'>" + time.toLocaleTimeString("en-US", timeOptions) + "<h5>";
    }
  })
  .style("fill", "white");

svg.call(reportTooltip);

function clicked(d) {
    if (active.node() === this) return reset();
    active.classed("active", false);
    active = d3.select(this).classed("active", true);

    var bounds = path.bounds(d),
        dx = bounds[1][0] - bounds[0][0],
        dy = bounds[1][1] - bounds[0][1],
        x = (bounds[0][0] + bounds[1][0]) / 2,
        y = (bounds[0][1] + bounds[1][1]) / 2,
        scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height))),
        translate = [width / 2 - scale * x, height / 2 - scale * y];

    svg.transition()
        .duration(750)
        // .call(zoom.translate(translate).scale(scale).event); // not in d3 v4
        .call( zoom.transform, d3.zoomIdentity.translate(translate[0],translate[1]).scale(scale) ); // updated for d3 v4
}

function reset() {
    active.classed("active", false);
    active = d3.select(null);

    svg.transition()
      .duration(750)
      // .call( zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1) ); // not in d3 v4
      .call( zoom.transform, d3.zoomIdentity ); // updated for d3 v4
}

function zoomed() {
    layer1.style("stroke-width", 1.5 / d3.event.transform.k + "px");
    layer1.attr("transform", d3.event.transform);
    layer2.style("stroke-width", 1.5 / d3.event.transform.k + "px");
    layer2.attr("transform", d3.event.transform);
    layer3.style("stroke-width", 1.5 / d3.event.transform.k + "px");
    layer3.attr("transform", d3.event.transform);
}


// If the drag behavior prevents the default clicks from passing through,
// also stop propagation so click-to-zoom is not triggered.
function stopped() {
    if (d3.event.defaultPrevented) d3.event.stopPropagation();
}


document.addEventListener('DOMContentLoaded', function () {
  var checkbox = document.querySelector('input[type="checkbox"]');

  checkbox.addEventListener('change', function () {
    if (checkbox.checked) {
      // do this
      console.log('Checked');
      tog = true;
    } else {
      // do that
      console.log('Not checked');
      tog = false;
    }
  });
});
