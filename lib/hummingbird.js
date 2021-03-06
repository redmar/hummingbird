var sys = require('sys'),
  fs = require('fs'),
  View = require('view').View,
  Metric = require('metric').Metric,
  Aggregates = require('aggregates').Aggregates,
  Buffer = require('buffer').Buffer,
  arrays = require('deps/arrays'),
  querystring = require('querystring');

var Hummingbird = function(db, callback) {
  var pixelData = fs.readFileSync(__dirname + "/../images/tracking.gif", 'binary');
  this.pixel = new Buffer(43);
  this.pixel.write(pixelData, 'binary', 0);

  this.metrics = [];
  this.init(db, callback);
};

Hummingbird.prototype = {
  init: function(db, callback) {
    this.setupDb(db, function() {
      callback();
    });

    this.addAllMetrics(db);
  },

  setupDb: function(db, callback) {
    var self = this;
    db.createCollection('visits', function(err, collection) {
      db.collection('visits', function(err, collection) {
        self.collection = collection;
        callback();
      });
    });
  },

  addAllMetrics: function(db) {
    var self = this;

    Metric.allMetrics(function(metric) {
      metric.init(db);
      self.metrics.push(metric);
    });
  },

  addClient: function(client) {
    for(var i = 0; i < this.metrics.length; i++) {
      this.metrics[i].clients.push(client);
    }
  },

  removeClient: function(client) {
    for(var i = 0; i < this.metrics.length; i++) {
      this.metrics[i].clients.remove(client);
    }
  },

  serveRequest: function(req, res) {
    var env = querystring.parse(req.url.split('?')[1]);
    env.timestamp = new Date();
    // sys.log(JSON.stringify(env, null, 2));

    this.writePixel(res);

    var view = new View(env);

    env.url_key = view.urlKey();
    env.product_id = view.productId();

    this.collection.insertAll([env]);

    for(var i = 0; i < this.metrics.length; i++) {
      this.metrics[i].incrementCallback(view);
    }
  },

  writePixel: function(res) {
    res.writeHead(200, { 'Content-Type': 'image/gif',
                         'Content-Disposition': 'inline',
                         'Content-Length': '43' });
    res.end(this.pixel);
  },

  serveAggregates: function(client) {
    var aggregates = new Aggregates(this.collection);
    aggregates.lastHour(function(values) {
       client.write(JSON.stringify({ metric: 'lastHour', values: values }));
    });
    /*
    aggregates.lastDay(client, function(values) {
      client.write({ metric: 'lastDay', values: values });
    });
    aggregates.lastWeek(client, function(values) {
      client.write({ metric: 'lastWeek', values: values });
    });
    */
  },

  handleError: function(req, res, e) {
    res.writeHead(500, {});
    res.write("Server error");
    res.close();

    e.stack = e.stack.split('\n');
    e.url = req.url;
    sys.log(JSON.stringify(e, null, 2));
  }
};

exports.Hummingbird = Hummingbird;
