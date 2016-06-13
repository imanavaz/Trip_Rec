//Code credit to Andrew Simmons asimmons@swin.edu.au

// dependencies: d3, leaflet, jquery

function hubChart() {
  // initialize config with defaults
  var config = {
    tileLayer: '',
    attribution: '',
    mapCenter: [-37.8124, 144.9661], // Melbourne, Australia
    mapZoom: 12,
    hubData: function(d) {return d.hubs; },
    hubLat: function(d) {return d.lat; },
    hubLng: function(d) {return d.lng; },
    hubRadius: 5.0,
    hubColor: 'black',
    armData: function(d) {return d.arms; },
    armAngle: function(d) {return d.angle; },
    armWidth: 1.0,
    armLength1: 10.0,
    armLength2: 20.0,
    armColor1: 'white',
    armColor2: 'black',
    padding: 500 // Maximum hub dimensions. Used for calculating SVG bounds. May result in clipping if exceeded.
  }

  // Utility function to evaluate value of an attribute bound to d3 data
  function extractVal(val, thisObj, d, i) {
    if (typeof(val) === "function") {
      return val.call(thisObj, d, i);
    }
    // val is a constant
    return val;
  }

  // function to generate / update chart
  function chart(selection) {

    // setup map once for each element in selection
    selection.each(function(data) {
      var rootElm = this;

      // Select the map overlay element, if it exists.
      var overlay = selection.selectAll(".overlay")
        .data([data]);

      // Otherwise, create the map.
      var oEnter = overlay.enter()
        .call(function (d) {
          var map = new L.Map(rootElm, {center: config.mapCenter, zoom: config.mapZoom});
          map.addLayer(new L.TileLayer(config.tileLayer, {attribution: config.attribution}));
          var svg = d3.select(map.getPanes().overlayPane).append("svg");
          svg.style("position", "relative");
          svg.append("g").attr("class", "overlay leaflet-zoom-hide");

          // Use JQuery to attach the map object to the DOM so that we can update the map object later
          jQuery.data(rootElm, "mapObj", map);
        });

      // Extract the map object from the DOM
      var map = jQuery.data(rootElm, "mapObj");
      var svg = selection.select("svg");
      var g = selection.select(".overlay");

      var hub = selection.select(".overlay").selectAll(".hub")
      .data(config.hubData) // extract hubData from network (using function specified in config)
        .enter().append("g")
        .attr("transform", pinPoint);

      var hubLayer1 = hub.append("g");
      var hubLayer2 = hub.append("g"); // appears on top of layer 1

      hubLayer2.append("circle")
      .attr("class", "hub")
      .style("stroke", "none")
      .style("fill", config.hubColor)
      .attr("r", config.hubRadius);

      var arm = hubLayer1.selectAll(".arm")
      .data(function (hubData, i) {
        // We need access to attributes in the outer hubData in addition to the inner armData.
        //
        // Specifically, we need access to the radius from within the arms.
        // Thus we create a custom data object that wraps an armObj alongside with the radius.
        var r = extractVal(config.hubRadius, this, hubData, i);
        var armData = extractVal(config.armData, this, hubData, i);
        return armData.map(function(armObj) {return {armObj: armObj, r: r}; });
      })
      .enter().append("g")
      .attr("class", function(d, i) {console.log("add arm"); return "arm"; });

      arm.append("line")
      .attr("stroke", function(d, i) {return extractVal(config.armColor2, this, d.armObj, i); })
      .attr("stroke-width", function(d, i) {return extractVal(config.armWidth, this, d.armObj, i); })
      .attr("stroke-linecap", "butt") // it's important the the stroke doesn't make the line any longer than it should be.
      .attr("x1", 0)
      .attr("y1", function(d, i) {return d.r + extractVal(config.armLength1, this, d.armObj, i); })
      .attr("x2", 0)
      .attr("y2", function(d, i) {return d.r + extractVal(config.armLength2, this, d.armObj, i); })
      .attr("transform", function(d, i) {return "rotate(" + extractVal(config.armAngle, this, d.armObj, i) + ")"; });

      arm.append("line")
      .attr("stroke", function(d, i) {return extractVal(config.armColor1, this, d.armObj, i); })
      .attr("stroke-width", function(d, i) {return extractVal(config.armWidth, this, d.armObj, i); })
      .attr("stroke-linecap", "butt") // it's important the the stroke doesn't make the line any longer than it should be.
      .attr("x1", 0)
      .attr("y1", function(d) {return d.r; })
      .attr("x2", 0)
      .attr("y2", function(d, i) {return d.r + extractVal(config.armLength1, this, d.armObj, i); })
      .attr("transform", function(d, i) {return "rotate(" + extractVal(config.armAngle, this, d.armObj, i) + ")"; });

      map.on("viewreset", mapViewReset);
      mapViewReset();

      // projected bounding box
      function boundsPoints(pointSelection) {
        var xmin = NaN;
        var xmax = NaN;
        var ymin = NaN;
        var ymax = NaN;

        pointSelection.each(function(d, i) {
          var latLng = new L.LatLng(extractVal(config.hubLat, this, d, i), extractVal(config.hubLng, this, d, i));
          var point = map.latLngToLayerPoint(latLng);
          if (isNaN(xmin) || point.x < xmin) {
            xmin = point.x
          }
          if (isNaN(xmax) || point.x > xmax) {
            xmax = point.x
          }
          if (isNaN(ymin) || point.y < ymin) {
            ymin = point.y
          }
          if (isNaN(ymax) || point.y > ymax) {
            ymax = point.y
          }
        });

        return [[xmin, ymin],[xmax, ymax]];
      }

      function padBounds(bounds, pad) {
        var xmin = bounds[0][0] - pad;
        var xmax = bounds[1][0] + pad;
        var ymin = bounds[0][1] - pad;
        var ymax = bounds[1][1] + pad;

        return [[xmin, ymin],[xmax, ymax]];
      }

      // returns svg translation for d3 data object
      function pinPoint(d, i) {
        var latLng = new L.LatLng(extractVal(config.hubLat, this, d, i), extractVal(config.hubLng, this, d, i));
        var point = map.latLngToLayerPoint(latLng);
        return "translate(" + point.x + "," + point.y + ")";
      }

      function mapViewReset() {
        var bounds = boundsPoints(hub);
        bounds = padBounds(bounds, config.padding);
        var topLeft = bounds[0], bottomRight = bounds[1];

        svg.attr("width", bottomRight[0] - topLeft[0])
        .attr("height", bottomRight[1] - topLeft[1])
        .style("left", topLeft[0] + "px")
        .style("top", topLeft[1] + "px");
        g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

        hub.attr("transform", pinPoint);
      }
    });
  }

  // Define accessor functions for all config variables
  Object.keys(config).forEach(function(varname) {
    chart[varname] = accessor(varname);
  })

  // Creates acessor function for a config variable
  //
  // Usage:
  // chart.width = accessor("width");
  // chart.width(5); => chart
  // chart.width(); => 5
  function accessor(varname) {
    return function(value) {
      if (!arguments.length) return config[varname];
      config[varname] = value;
      return chart;
    }
  }

  return chart;
}
