var body = d3.select("body");
var svg = d3.select("svg");
var container = d3.select("#map-container");

var layer0 = svg.append('g');
var layer1 = svg.append('g');
var layer2 = svg.append('g');
var layer3 = svg.append('g');
var layer4 = svg.append('g');

var width = window.innerWidth - 360;
if (width < 400) {
  width = 400;
}
var height = window.innerHeight - 70;
if (height < 400) {
  height = 400;
}
var scale = 2 * (width - 3) / (Math.PI);
var scaleRatio = scale / 675;

layer0.append("rect")
  .attr("class", "background")
  .attr("width", width)
  .attr("height", height);

svg.style("height", height)
  .style("width", width);

container.style("height", height)
  .style("width", width);

var projection = d3.geoMercator()
  .scale(scale)
  .translate([1.55 * width, height]);
var path = d3.geoPath().projection(projection);

var colorScale = d3.scaleLinear()
  .domain([0, 1])
  .range(["#FFEB3B", "#F44336"]);

var showReportTooltips = true;
var showFlightPaths = false;

var zoom = d3.zoom()
  .scaleExtent([.5, 8])
  .on("zoom", zoomed);

svg.call(zoom);

var planeString = "";

var reportTooltip = d3.tip()
  .attr("class", "d3-tip")
  .offset([-12, 0])
  .html(function(d) {
    inv = projection.invert(d[0]);
    time = new Date(d[2]);
    var timeOptions = {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    };
    return "<h5 style='color:white'>(" + inv[1].toFixed(4) + ", " + inv[0].toFixed(4) + ")<h5>" +
      "<h5 style='color:white'>" + time.toLocaleTimeString("en-US", timeOptions) + "<h5>";
  })
  .style("fill", "white");

svg.call(reportTooltip);

function ready(error, map, plane) {
  if (error) throw error;

  planeString = plane.path;

  // Creates a legend for the color scale
  makeColorLegend(height - 60, width - 325, 300, 15, 0.75, colorScale);

  var doReports = true;
  var doFlights = true;

  // Initialize data
  setMapData(map);
  updateData(doReports, doFlights);

  // Update data every 5 seconds
  setInterval(function() {
    updateData(doReports, doFlights)
  }, 5000);
}

function resize() {
  width = window.innerWidth - 360;
  if (width < 400) {
    width = 400;
  }
  height = window.innerHeight - 70;
  if (height < 400) {
    height = 400;
  }

  svg.style("height", height)
    .style("width", width);

  container.style("height", height)
    .style("width", width);

  layer0.select("rect").remove();
  layer0.append("rect")
    .attr("class", "background")
    .attr("width", width)
    .attr("height", height);

  makeColorLegend(height - 60, width - 325, 300, 15, 0.75, colorScale);
}

function zoomed() {
  layer1.style("stroke-width", 1.5 / d3.event.transform.k + "px");
  layer1.attr("transform", d3.event.transform);
  layer2.style("stroke-width", 1.5 / d3.event.transform.k + "px");
  layer2.attr("transform", d3.event.transform);
  layer3.style("stroke-width", 1.5 / d3.event.transform.k + "px");
  layer3.attr("transform", d3.event.transform);
  layer4.style("stroke-width", 1.5 / d3.event.transform.k + "px");
  layer4.attr("transform", d3.event.transform);
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
  svg.select("#legend").remove();

  svg.append("g")
    .attr("id", "legend")
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

/**
 * Sets the world map data
 * @param map world map json data
 */
function setMapData(map) {
  layer1.selectAll("#map_path").remove();
  layer1.selectAll("path")
    .data(map.features)
    .enter().append("path")
    .attr("id", "map_path")
    .attr("d", path)
    .attr("class", "feature");
}

/**
 * Updates the live map data
 * @param reports whether or not to add weather reports
 * @param aircraft whether or not to add aircraft
 */
function updateData(reports, aircraft) {
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
    params = queryString({
      "max": max,
      "start": start,
      "table": table
    });
  } else {
    params = queryString({
      "start": start,
      "table": table
    });
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
 * Makes call to retrieve information from server
 * @param table the type of table from which to retrieve information
 * @param id database id of the entry to retrieve
 * @param callback the function to call with the response results
 */
function makeQueryById(table, id, callback) {
  var xhttp = new XMLHttpRequest();
  var url = "http://127.0.0.1:8000/query";
  var params;
  params = queryString({
    "table": table,
    "id": id
  });
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
    .attr("fill", function(x) {
      return colorScale(x[1]);
    })
    .attr("cx", function(x) {
      return x[0][0];
    })
    .attr("cy", function(x) {
      return x[0][1];
    })
    .attr("r", 8 * scaleRatio)
    .on("mouseover", function(x) {
      if (showReportTooltips) {
        reportTooltip.show(x);
      }
    }) // Add mouse hover tooltip listeners
    .on("mouseout", reportTooltip.hide);
}

/**
 * Adds flight data to the map
 * @param flights the aircraft flights to be displayed on the map
 */
function makeFlights(flights) {
  layer4.selectAll("#flight").remove();

  layer4.selectAll("path")
    .data(
      flights.map(r => [projection([r.longitude, r.latitude]), r.bearing, r.origin, r.destination])
      .filter(x => x[0] !== null)
    ).enter()
    .append("path")
    .attr("id", "flight")
    .attr("d", planeString)
    .attr("fill", "black")
    .attr("transform", function(x) {
      return "translate(" + x[0][0] + "," + x[0][1] + ") rotate(" + x[1] + ") scale(" + (0.25 * scaleRatio) + ")";
    })
    .on("mouseover", x => updateFlightPath(x));
}

/**
 * Adds flight path data to the map
 * @param flightArr the flight object array to display the path of
 */
function updateFlightPath(flightArr) {
  if (showFlightPaths) {
    var origin;
    makeQueryById("airports", flightArr[2],
      function(x) {
        if (x.length == 0) {
          return;
        }
        var origin = x[0];
        makeQueryById("airports", flightArr[3],
          function(y) {
            if (y.length == 0) {
              return;
            }
            var destination = y[0];

            var originCoord = [parseFloat(origin.longitude), parseFloat(origin.latitude)];
            var destCoord = [parseFloat(destination.longitude), parseFloat(destination.latitude)];
            var originProj = projection(originCoord);
            var destProj = projection(destCoord);

            var lineData = [{
              "type": "Feature",
              "geometry": {
                "type": "LineString",
                "coordinates": [originCoord, destCoord]
              }
            }];

            layer3.selectAll("#flight_path").remove();

            layer3.selectAll("path")
              .data(lineData)
              .enter().append("path")
              .attr("d", path)
              .attr("id", "flight_path")
              .attr("fill", "none")
              .attr("stroke-width", "1.5")
              .attr("stroke", "#3F51B5");

            layer3.append("circle")
              .attr("cx", originProj[0])
              .attr("cy", originProj[1])
              .attr("id", "flight_path")
              .attr("fill", "#3F51B5")
              .attr("r", 2);

            layer3.append("circle")
              .attr("cx", destProj[0])
              .attr("cy", destProj[1])
              .attr("id", "flight_path")
              .attr("fill", "#3F51B5")
              .attr("r", 2);
          });
      });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Add turbulence tooltip toggle switch listener
  var turbToggle = document.getElementById("tubulence-info-toggle");
  turbToggle.addEventListener('change', function() {
    if (turbToggle.checked) {
      showReportTooltips = true;
    } else {
      showReportTooltips = false;
    }
  });
  showReportTooltips = turbToggle.checked;

  // Add flight path toggle switch listener
  var pathToggle = document.getElementById("flight-path-toggle");
  pathToggle.addEventListener('change', function() {
    if (pathToggle.checked) {
      showFlightPaths = true;
    } else {
      showFlightPaths = false;
      layer3.selectAll("#flight_path").remove();
    }
  });
  showFlightPaths = pathToggle.checked;
});
