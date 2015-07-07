// appease the jshint gods
/*eslint no-console:0*/
var mongoscope = window.mongoscopeClient;
var $ = window.$;
var infer = window.mongodbInfer;

mongoscope.configure({
  endpoint: 'http://scope.mongodb.land'
});

mongoscope.sample('canada.service_requests', {
  size: 20
}, function(err, res) {
  if (err) return console.error(err);

  $('.raw').text(JSON.stringify(res, null, 2));

  var schemas = res.map(infer);
  $('.schema-raw').text(JSON.stringify(schemas, null, 2));
});
