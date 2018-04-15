var width = 1000,
  height = 700,
  active = d3.select(null);

var projection = d3.geoMercator() // updated for d3 v4
  .scale(2 * (width - 3) / (Math.PI))
  .translate([1.5 * width, 1.125 * height]);

var zoom = d3.zoom()
// no longer in d3 v4 - zoom initialises with zoomIdentity, so it's already at origin
// .translate([0, 0])
// .scale(1)
  .scaleExtent([1, 8])
  .on("zoom", zoomed);

var path = d3.geoPath() // updated for d3 v4
  .projection(projection);

var svg = d3.select("body").append("svg")
  .attr("width", width)
  .attr("height", height)
  .on("click", stopped, true);

svg.append("rect")
  .attr("class", "background")
  .attr("width", width)
  .attr("height", height)
  .on("click", reset);

var g = svg.append("g");

svg.call(zoom); // delete this line to disable free zooming
// .call(zoom.event); // not in d3 v4


function ready(error, us, airports) {
  if (error) throw error;

  // Creates a legend for the color scale
  makeColorLegend(height - 60, width - 325, 300, 15, 0.75, colorScale);

  var doReports = false;
  var doFlights = true;

  // Initialize data
  setMapData(us, airports);
  updateLiveData(doReports, doFlights);

  // Update data every 10 seconds
  setInterval(function(){
    updateLiveData(doReports, doFlights);
  }, 1000);
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
  g.selectAll("path")
    .data(us.features)
    .enter().append("path")
    .attr("d", path)
    .attr("class", "feature");

  g.append("path")
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
  svg.selectAll("circle").remove();
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
      str = str + "?" + arg + "=" + args[arg];
    } else {
      str = str + "&" + arg + "=" + args[arg];
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
  g.selectAll("circle")
    .data(
      reports.map(r => [projection([r.longitude, r.latitude]), r.tke])
             .filter(a => a[0] !== null)
    ).enter()
    .append("circle")
    .attr("fill", function (x) { return colorScale(x[1]); })
    .attr("cx", function (x) { return x[0][0]; })
    .attr("cy", function (x) { return x[0][1]; })
    .attr("r", 8)
    .attr("opacity", 1.0)
    .on('mouseover', toolTip.show) // Add mouse hover tooltip listeners
    .on('mouseout', toolTip.hide);
}

/**
 * Adds flight data to the map
 * @param flights the aircraft flights to be displayed on the map
 */
function makeFlights(flights) {
  g.selectAll("circle")
    .data(
      flights.map(r => projection([r.longitude, r.latitude]))
             .filter(x => x !== null)
    ).enter()
    .append("circle")

    .attr("fill", "black")
    .attr("cx", function (x) { return x[0]; })
    .attr("cy", function (x) { return x[1]; })
    .attr("r", 1)
    .attr("opacity", 1.0)
    ;
}


var toolTip = d3.tip()
    .attr("class", "d3-tip")
    .offset([-12, 0])
    .html(function(d) {
        return "<h5>"+"Longitude: "+d[0] +"</h5>" + "<h5>" + "Latitude: " + d[1] +"<H5>";
    });

 svg.call(toolTip);


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
    g.style("stroke-width", 1.5 / d3.event.transform.k + "px");
    // g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")"); // not in d3 v4
    g.attr("transform", d3.event.transform); // updated for d3 v4
}

// If the drag behavior prevents the default clicks from passing through,
// also stop propagation so click-to-zoom is not triggered.
function stopped() {
    if (d3.event.defaultPrevented) d3.event.stopPropagation();
}
